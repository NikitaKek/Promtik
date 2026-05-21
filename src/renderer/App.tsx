import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Square } from "lucide-react";
import { HistoryPanel } from "./components/HistoryPanel";
import { RecordButton } from "./components/RecordButton";
import { SettingsPanel } from "./components/SettingsPanel";
import { TabsBar, type MainTab } from "./components/TabsBar";
import { TopBar } from "./components/TopBar";
import { TranscriptEditor } from "./components/TranscriptEditor";
import { WindowTitleBar } from "./components/WindowTitleBar";
import { copyCleanText, copyWithSettings } from "./lib/clipboard";
import { hotkeyLabel } from "./lib/formatting";
import type {
  AppSettings,
  AppStatus,
  GpuStatusResponse,
  HistoryItem,
  HistorySource,
  ModelCacheStatus,
  ModelSize,
  OverlayState,
  TranscriptSegment,
  UpdateState
} from "./lib/types";

const DEFAULT_SETTINGS: AppSettings = {
  qualityPreset: "maximum",
  modelSize: "large-v3",
  language: "ru",
  deviceMode: "auto",
  autoCopy: true,
  aiFormat: false,
  vadSilenceMs: 1100,
  beamSize: 12,
  termHints: "ChatGPT, Claude, Codex, Cursor, OpenAI, Python, TypeScript, React, Electron, Whisper, faster-whisper, CUDA",
  hotkey: "CommandOrControl+Alt+Space"
};

const MODELS: ModelSize[] = ["large-v3-turbo", "large-v3"];

const DEFAULT_MODEL_CACHE_STATUS: ModelCacheStatus = {
  "large-v3-turbo": "checking",
  "large-v3": "checking"
};

const DEFAULT_UPDATE_STATE: UpdateState = {
  status: "idle",
  currentVersion: "",
  message: "Проверка обновлений еще не запускалась."
};

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [transcript, setTranscript] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [status, setStatus] = useState<AppStatus>("ready");
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectionToken, setSelectionToken] = useState(0);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("input");
  const [modelCacheStatus, setModelCacheStatus] = useState<ModelCacheStatus>(
    DEFAULT_MODEL_CACHE_STATUS
  );
  const [modelCacheDir, setModelCacheDir] = useState<string | null>(null);
  const [isCheckingModels, setIsCheckingModels] = useState(false);
  const [gpuStatus, setGpuStatus] = useState<GpuStatusResponse | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>(
    DEFAULT_UPDATE_STATE
  );

  const settingsRef = useRef(settings);
  const historyRef = useRef(history);
  const recordingRef = useRef(isRecording);
  const busyRef = useRef(isBusy);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelRequestedRef = useRef(false);
  const toggleRecordingRef = useRef<() => void>(() => undefined);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioLevelTimerRef = useRef<number | null>(null);
  const audioLevelRef = useRef(0);
  const audioLevelLastSentRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  const setBusyState = useCallback((value: boolean) => {
    busyRef.current = value;
    setIsBusy(value);
  }, []);

  const setRecordingState = useCallback((value: boolean) => {
    recordingRef.current = value;
    setIsRecording(value);
  }, []);

  const showError = useCallback((message: string) => {
    setError(message);
    setNotice(null);
    setStatus("error");
    notifyOverlay({ status: "error", message });
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 4600);
  }, []);

  const markCopied = useCallback(() => {
    setStatus("copied");
    notifyOverlay({ status: "copied", message: "Текст скопирован" });
    showToast("Текст скопирован в буфер обмена");
    window.setTimeout(() => {
      setStatus((current) => (current === "copied" ? "ready" : current));
    }, 4600);
  }, [showToast]);

  const stopAudioLevelMonitor = useCallback(() => {
    if (audioLevelTimerRef.current !== null) {
      window.clearInterval(audioLevelTimerRef.current);
      audioLevelTimerRef.current = null;
    }

    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    audioLevelRef.current = 0;
    audioLevelLastSentRef.current = 0;
  }, []);

  const startAudioLevelMonitor = useCallback(
    (stream: MediaStream) => {
      stopAudioLevelMonitor();

      const AudioContextConstructor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextConstructor) {
        notifyOverlay(createRecordingOverlayState(settingsRef.current, 0));
        return;
      }

      try {
        const audioContext = new AudioContextConstructor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();

        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.65;
        const data = new Uint8Array(analyser.fftSize);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        audioSourceRef.current = source;
        void audioContext.resume().catch(() => undefined);

        const tick = (): void => {
          analyser.getByteTimeDomainData(data);

          let sum = 0;
          for (const sample of data) {
            const centered = (sample - 128) / 128;
            sum += centered * centered;
          }

          const rms = Math.sqrt(sum / data.length);
          const normalized = Math.max(0, Math.min(1, (rms - 0.015) * 8.5));
          const smoothed =
            normalized > audioLevelRef.current
              ? normalized
              : audioLevelRef.current * 0.72 + normalized * 0.28;
          const level = smoothed < 0.035 ? 0 : smoothed;
          audioLevelRef.current = level;

          const now = performance.now();
          if (now - audioLevelLastSentRef.current > 90) {
            audioLevelLastSentRef.current = now;
            notifyOverlay(createRecordingOverlayState(settingsRef.current, level));
          }

        };

        tick();
        audioLevelTimerRef.current = window.setInterval(tick, 80);
      } catch {
        notifyOverlay(createRecordingOverlayState(settingsRef.current, 0));
      }
    },
    [stopAudioLevelMonitor]
  );

  const cleanupMedia = useCallback(() => {
    stopAudioLevelMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, [stopAudioLevelMonitor]);

  const persistHistory = useCallback(async (nextHistory: HistoryItem[]) => {
    const trimmed = nextHistory.slice(0, 50);
    historyRef.current = trimmed;
    setHistory(trimmed);
    await window.promptik.saveHistory(trimmed);
  }, []);

  const addHistoryItem = useCallback(
    async (item: HistoryItem) => {
      await persistHistory([item, ...historyRef.current].slice(0, 50));
    },
    [persistHistory]
  );

  const clearHistory = useCallback(() => {
    setActiveHistoryId(null);
    void persistHistory([]).catch((caughtError) => {
      showError(getErrorMessage(caughtError, "Не удалось очистить историю."));
    });
  }, [persistHistory, showError]);

  const warmupDownloadedModel = useCallback(async (targetSettings: AppSettings) => {
    try {
      const response = await window.promptik.getModelCacheStatus();
      if (!response.ok || !response.models?.[targetSettings.modelSize]) {
        return;
      }

      await window.promptik.warmupModel({
        modelSize: targetSettings.modelSize,
        deviceMode: targetSettings.deviceMode
      });
    } catch {
      // Background warmup is opportunistic; transcription will still load the model.
    }
  }, []);

  const refreshModelCacheStatus = useCallback(async () => {
    setIsCheckingModels(true);
    setModelCacheStatus({
      "large-v3-turbo": "checking",
      "large-v3": "checking"
    });

    try {
      const response = await window.promptik.getModelCacheStatus();
      if (!response.ok || !response.models) {
        throw new Error(response.error ?? "Не удалось проверить модели.");
      }

      setModelCacheDir(response.cache_dir ?? null);
      setModelCacheStatus(
        MODELS.reduce<ModelCacheStatus>((accumulator, model) => {
          accumulator[model] = response.models?.[model] ? "downloaded" : "missing";
          return accumulator;
        }, { ...DEFAULT_MODEL_CACHE_STATUS })
      );
    } catch {
      setModelCacheStatus({
        "large-v3-turbo": "unknown",
        "large-v3": "unknown"
      });
    } finally {
      setIsCheckingModels(false);
    }
  }, []);

  const refreshGpuStatus = useCallback(async () => {
    try {
      const response = await window.promptik.getGpuStatus();
      setGpuStatus(response);
      return response;
    } catch (caughtError) {
      const response: GpuStatusResponse = {
        ok: false,
        error: getErrorMessage(caughtError, "Не удалось проверить CUDA GPU.")
      };
      setGpuStatus(response);
      return response;
    }
  }, []);

  const transcribeAudio = useCallback(
    async (filePath: string, source: HistorySource) => {
      const activeSettings = settingsRef.current;
      setActiveTab("input");
      setBusyState(true);
      setError(null);
      setNotice("Модель запускается. Зависшую задачу можно остановить.");
      setStatus("loading-model");
      notifyOverlay({ status: "loading-model", message: "Загрузка модели" });

      const statusTimer = window.setTimeout(() => {
        notifyOverlay({ status: "transcribing", message: "Транскрибация" });
        setStatus((current) =>
          current === "loading-model" ? "transcribing" : current
        );
      }, 900);

      try {
        const result = await window.promptik.transcribeFile(filePath, {
          modelSize: activeSettings.modelSize,
          language: activeSettings.language,
          deviceMode: activeSettings.deviceMode,
          vadSilenceMs: activeSettings.vadSilenceMs,
          beamSize: activeSettings.beamSize,
          termHints: activeSettings.termHints
        });

        window.clearTimeout(statusTimer);

        if (!result.ok) {
          throw new Error(
            result.error ?? "Локальная ML-транскрибация завершилась ошибкой."
          );
        }

        const nextText = (result.text ?? "").trim();
        const nextSegments = result.segments ?? [];
        setNotice(null);
        setModelCacheStatus((current) => ({
          ...current,
          [activeSettings.modelSize]: "downloaded"
        }));
        setTranscript(nextText);
        setSegments(nextSegments);
        setActiveHistoryId(null);
        setSelectionToken((value) => value + 1);

        await addHistoryItem({
          id: createId(),
          datetime: new Date().toISOString(),
          text: nextText,
          source,
          language: activeSettings.language,
          model: activeSettings.modelSize,
          segments: nextSegments
        });

        const backgroundState = await window.promptik
          .isWindowBackground()
          .catch(() => ({ ok: false, isBackground: false }));
        const shouldCopy =
          nextText.length > 0 &&
          (activeSettings.autoCopy || backgroundState.isBackground);

        if (shouldCopy) {
          await copyWithSettings(nextText, activeSettings.aiFormat);
          markCopied();
        } else {
          setStatus("ready");
          notifyOverlay({ status: "ready", message: "Готово" });
        }
      } catch (caughtError) {
        window.clearTimeout(statusTimer);
        if (cancelRequestedRef.current) {
          setError(null);
          setNotice("ML-задача остановлена.");
          setStatus("ready");
          notifyOverlay({ status: "ready", message: "Готово" });
        } else {
          showError(getErrorMessage(caughtError, "Не удалось распознать речь."));
        }
      } finally {
        cancelRequestedRef.current = false;
        setBusyState(false);
      }
    },
    [addHistoryItem, markCopied, setBusyState, showError]
  );

  const handleRecordingStop = useCallback(
    async (mimeType: string) => {
      const chunks = chunksRef.current;
      chunksRef.current = [];
      cleanupMedia();

      if (chunks.length === 0) {
        showError("Запись получилась пустой. Проверьте микрофон.");
        return;
      }

      try {
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        const buffer = await blob.arrayBuffer();
        const saved = await window.promptik.saveRecording(
          buffer,
          extensionForMimeType(mimeType)
        );

        if (!saved.ok || !saved.filePath) {
          throw new Error("Не удалось сохранить временный аудиофайл.");
        }

        await transcribeAudio(saved.filePath, "microphone");
      } catch (caughtError) {
        showError(getErrorMessage(caughtError, "Не удалось обработать запись."));
      }
    },
    [cleanupMedia, showError, transcribeAudio]
  );

  const startRecording = useCallback(async () => {
    if (busyRef.current || recordingRef.current) {
      return;
    }

    if (!("MediaRecorder" in window)) {
      showError("MediaRecorder недоступен в этом окружении Electron.");
      return;
    }

    try {
      setActiveTab("input");
      setError(null);
      setNotice(null);
      setStatus("recording");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const mimeType = chooseAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        showError("Ошибка записи с микрофона.");
        setRecordingState(false);
        cleanupMedia();
      };

      recorder.onstop = () => {
        void handleRecordingStop(mimeType);
      };

      recorder.start(250);
      setRecordingState(true);
      startAudioLevelMonitor(stream);
      void window.promptik
        .startRecording()
        .then(() => {
          notifyOverlay(createRecordingOverlayState(settingsRef.current, 0));
        })
        .catch(() => undefined);
    } catch (caughtError) {
      setRecordingState(false);
      cleanupMedia();
      showError(
        getErrorMessage(
          caughtError,
          "Не удалось получить доступ к микрофону."
        )
      );
    }
  }, [
    cleanupMedia,
    handleRecordingStop,
    setRecordingState,
    showError
  ]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) {
      return;
    }

    setRecordingState(false);
    setStatus("transcribing");
    void window.promptik.stopRecording().catch(() => undefined);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanupMedia();
      showError("Запись остановлена, но аудиоданные не получены.");
    }
  }, [cleanupMedia, setRecordingState, showError]);

  const toggleRecording = useCallback(() => {
    if (recordingRef.current) {
      void stopRecording();
    } else {
      void startRecording();
    }
  }, [startRecording, stopRecording]);

  const handleCancelTranscription = useCallback(async () => {
    if (!busyRef.current || recordingRef.current) {
      return;
    }

    cancelRequestedRef.current = true;

    try {
      await window.promptik.cancelTranscription();
    } catch (caughtError) {
      cancelRequestedRef.current = false;
      showError(getErrorMessage(caughtError, "Не удалось остановить ML-задачу."));
    }
  }, [showError]);

  const updateSettings = useCallback(
    (nextSettings: AppSettings) => {
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      void window.promptik.saveSettings(nextSettings).catch((caughtError) => {
        showError(getErrorMessage(caughtError, "Не удалось сохранить настройки."));
      });
    },
    [showError]
  );

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setActiveHistoryId(item.id);
    setTranscript(item.text);
    setSegments(item.segments);
    setActiveTab("input");
    setStatus("ready");
    setError(null);
    setNotice(null);
    setSelectionToken((value) => value + 1);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await copyCleanText(transcript);
      markCopied();
    } catch (caughtError) {
      showError(getErrorMessage(caughtError, "Не удалось скопировать текст."));
    }
  }, [markCopied, showError, transcript]);

  const handleCheckUpdates = useCallback(async () => {
    try {
      const nextState = await window.promptik.checkForUpdates(true);
      setUpdateState(nextState);
    } catch (caughtError) {
      setUpdateState((current) => ({
        ...current,
        status: "error",
        message: getErrorMessage(caughtError, "Не удалось проверить обновления.")
      }));
    }
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    try {
      const nextState = await window.promptik.installUpdate();
      setUpdateState(nextState);
    } catch (caughtError) {
      setUpdateState((current) => ({
        ...current,
        status: "error",
        message: getErrorMessage(caughtError, "Не удалось установить обновление.")
      }));
    }
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    recordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    busyRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    toggleRecordingRef.current = toggleRecording;
  }, [toggleRecording]);

  useEffect(() => {
    let canceled = false;

    async function bootstrap(): Promise<void> {
      try {
        const [loadedSettings, loadedHistory] = await Promise.all([
          window.promptik.loadSettings(),
          window.promptik.loadHistory()
        ]);

        if (canceled) {
          return;
        }

        settingsRef.current = loadedSettings;
        historyRef.current = loadedHistory;
        setSettings(loadedSettings);
        setHistory(loadedHistory);
        void warmupDownloadedModel(loadedSettings);
      } catch (caughtError) {
        showError(
          getErrorMessage(caughtError, "Не удалось загрузить настройки или историю.")
        );
      }
    }

    void bootstrap();
    void refreshModelCacheStatus();
    void refreshGpuStatus();

    const unsubscribeHotkey = window.promptik.onHotkeyPressed(() => {
      toggleRecordingRef.current();
    });
    const unsubscribeWarning = window.promptik.onAppWarning((message) => {
      setNotice(message);
    });
    const unsubscribeUpdateState = window.promptik.onUpdateState(setUpdateState);

    void window.promptik
      .getUpdateState()
      .then(setUpdateState)
      .catch(() => undefined);
    void window.promptik
      .checkForUpdates(false)
      .then(setUpdateState)
      .catch(() => undefined);

    return () => {
      canceled = true;
      unsubscribeHotkey();
      unsubscribeWarning();
      unsubscribeUpdateState();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      cleanupMedia();
    };
  }, [
    cleanupMedia,
    refreshGpuStatus,
    refreshModelCacheStatus,
    showError,
    warmupDownloadedModel
  ]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0B0F14] text-slate-100">
      <div className="app-surface" />
      <WindowTitleBar />
      <div className="app-scrollbar-hidden relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <main className="relative mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-4 p-4 md:p-6">
          <TopBar
            status={status}
            message={error ?? notice ?? undefined}
            messageTone={error ? "error" : notice ? "notice" : undefined}
            hotkeyLabel={hotkeyLabel(settings.hotkey)}
            updateState={updateState}
            onCheckUpdates={handleCheckUpdates}
            onInstallUpdate={handleInstallUpdate}
          />
          <TabsBar
            activeTab={activeTab}
            historyCount={history.length}
            onChange={setActiveTab}
          />

          {activeTab === "input" ? (
            <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-glass backdrop-blur-xl">
              <div className="grid min-h-[520px] items-stretch gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <RecordButton
                      isRecording={isRecording}
                      isBusy={isBusy}
                      onToggle={toggleRecording}
                    />

                    {isBusy && !isRecording ? (
                      <button
                        type="button"
                        onClick={handleCancelTranscription}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-rose-200/30 bg-rose-400/[0.12] text-rose-50 transition hover:bg-rose-400/20"
                        title="Остановить ML-задачу"
                        aria-label="Остановить ML-задачу"
                      >
                        <Square className="h-4 w-4 fill-rose-100" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <TranscriptEditor
                  text={transcript}
                  disabled={isBusy || isRecording}
                  selectionToken={selectionToken}
                  onChange={setTranscript}
                  onCopy={handleCopy}
                />
              </div>
            </section>
          ) : activeTab === "history" ? (
            <HistoryPanel
              history={history}
              activeId={activeHistoryId}
              onSelect={handleHistorySelect}
              onClear={clearHistory}
            />
          ) : (
            <SettingsPanel
              settings={settings}
              modelCacheStatus={modelCacheStatus}
              modelCacheDir={modelCacheDir}
              gpuStatus={gpuStatus}
              isCheckingModels={isCheckingModels}
              disabled={isBusy || isRecording}
              onChange={updateSettings}
              onRefreshModelCacheStatus={refreshModelCacheStatus}
              onRefreshGpuStatus={refreshGpuStatus}
            />
          )}
        </main>
      </div>
      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50 max-w-[360px] rounded-lg border border-emerald-200/25 bg-[#0b0f14]/90 px-4 py-3 text-emerald-50 shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-200/20 bg-emerald-300/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Готово</p>
              <p className="mt-0.5 text-sm leading-5 text-slate-300">
                {toastMessage}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function chooseAudioMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4"
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  if (mimeType.includes("mp4")) {
    return "mp4";
  }

  return "webm";
}

function createId(): string {
  if ("randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRecordingOverlayState(
  settings: AppSettings,
  audioLevel: number
): OverlayState {
  return {
    status: "recording",
    message: "Идет запись",
    audioLevel,
    hotkeyLabel: hotkeyLabel(settings.hotkey)
  };
}

function notifyOverlay(state: OverlayState): void {
  void window.promptik.updateOverlay(state).catch(() => undefined);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}
