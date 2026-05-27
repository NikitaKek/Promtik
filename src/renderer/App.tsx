import { useCallback, useEffect, useRef, useState } from "react";
import { AppToast } from "./components/AppToast";
import { HistoryPanel } from "./components/HistoryPanel";
import { InputPanel } from "./components/InputPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { TabsBar, type MainTab } from "./components/TabsBar";
import { TopBar } from "./components/TopBar";
import { WindowTitleBar } from "./components/WindowTitleBar";
import { useAudioLevelMonitor } from "./hooks/useAudioLevelMonitor";
import { useLiveTranscription } from "./hooks/useLiveTranscription";
import {
  DEFAULT_MODEL_CACHE_STATUS,
  DEFAULT_SETTINGS,
  DEFAULT_UPDATE_STATE,
  MODELS,
  modelCacheStatusFor
} from "./lib/appDefaults";
import { copyCleanText, copyWithSettings } from "./lib/clipboard";
import { createId, getErrorMessage } from "./lib/errors";
import { hotkeyLabel } from "./lib/formatting";
import { chooseAudioMimeType, extensionForMimeType } from "./lib/media";
import { createRecordingOverlayState, notifyOverlay } from "./lib/overlay";
import type {
  AppSettings,
  AppStatus,
  GpuStatusResponse,
  HistoryItem,
  HistorySource,
  ModelCacheStatus,
  TranscriptSegment,
  UpdateState
} from "./lib/types";

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
  const toastTimerRef = useRef<number | null>(null);
  const getCurrentSettings = useCallback(() => settingsRef.current, []);
  const appendLiveDraft = useCallback((draftText: string) => {
    const cleanDraft = draftText.replace(/\s+/g, " ").trim();
    if (!cleanDraft) {
      return;
    }

    setTranscript((current) => mergeLiveTranscript(current, cleanDraft));
  }, []);
  const { audioLevel, startAudioLevelMonitor, stopAudioLevelMonitor } =
    useAudioLevelMonitor(getCurrentSettings);
  const { startLiveTranscription, stopLiveTranscription } =
    useLiveTranscription(getCurrentSettings, appendLiveDraft);

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

  const cleanupMedia = useCallback(() => {
    stopLiveTranscription();
    stopAudioLevelMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, [stopAudioLevelMonitor, stopLiveTranscription]);

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
    setModelCacheStatus(modelCacheStatusFor("checking"));

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
      setModelCacheStatus(modelCacheStatusFor("unknown"));
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
      setTranscript("");
      setSegments([]);
      setActiveHistoryId(null);

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
      startLiveTranscription(stream);
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
    startAudioLevelMonitor,
    startLiveTranscription,
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
            <InputPanel
              text={transcript}
              audioLevel={audioLevel}
              isRecording={isRecording}
              isBusy={isBusy}
              selectionToken={selectionToken}
              onToggleRecording={toggleRecording}
              onCancelTranscription={handleCancelTranscription}
              onTextChange={setTranscript}
              onCopy={handleCopy}
            />
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
      {toastMessage ? <AppToast message={toastMessage} /> : null}
    </div>
  );
}

function mergeLiveTranscript(currentText: string, nextText: string): string {
  const current = currentText.trim();
  const next = nextText.trim();

  if (!current) {
    return next;
  }

  if (!next) {
    return current;
  }

  const currentComparable = normalizeLiveText(current);
  const nextComparable = normalizeLiveText(next);

  if (nextComparable.includes(currentComparable)) {
    return dedupeLiveRepeatedPhrases(next);
  }

  if (currentComparable.includes(nextComparable)) {
    return dedupeLiveRepeatedPhrases(current);
  }

  const tooShortToReplace = next.length < current.length * 0.72;
  const doesNotContinuePrefix = !nextComparable.startsWith(
    currentComparable.slice(0, Math.min(80, currentComparable.length))
  );

  if (tooShortToReplace && doesNotContinuePrefix) {
    return dedupeLiveRepeatedPhrases(appendLiveTextWithOverlap(current, next));
  }

  return dedupeLiveRepeatedPhrases(next);
}

function appendLiveTextWithOverlap(currentText: string, nextText: string): string {
  const currentWords = currentText.trim().split(/\s+/);
  const nextWords = nextText.trim().split(/\s+/);
  const currentComparableWords = currentWords.map(normalizeLiveText);
  const nextComparableWords = nextWords.map(normalizeLiveText);
  const maxOverlap = Math.min(18, currentWords.length, nextWords.length);

  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    const currentTail = currentComparableWords.slice(-overlap).join(" ");
    const nextHead = nextComparableWords.slice(0, overlap).join(" ");

    if (currentTail && currentTail === nextHead) {
      return `${currentText.trim()} ${nextWords.slice(overlap).join(" ")}`.trim();
    }
  }

  return `${currentText.trim()} ${nextText.trim()}`.trim();
}

function normalizeLiveText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?…:;'"«»()[\]{}_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeLiveRepeatedPhrases(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return text.trim();
  }

  let changed = true;
  while (changed) {
    changed = false;
    const normalizedWords = words.map(normalizeLiveText);
    const maxLength = Math.min(14, Math.floor(words.length / 2));

    phraseLoop:
    for (let length = maxLength; length >= 2; length -= 1) {
      for (let index = 0; index + length * 2 <= words.length; index += 1) {
        const first = normalizedWords.slice(index, index + length).join(" ");
        const second = normalizedWords
          .slice(index + length, index + length * 2)
          .join(" ");

        if (first && first === second) {
          words.splice(index + length, length);
          changed = true;
          break phraseLoop;
        }
      }
    }
  }

  return words.join(" ").trim();
}
