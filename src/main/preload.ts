import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, HistoryItem } from "./settings";
import type {
  GpuStatusResponse,
  ModelCacheResponse,
  TranscriptionResponse,
  WarmupResponse
} from "./pythonBridge";
import type { MiniOverlayState } from "./miniOverlay";
import type { UpdateState } from "./updates";

const api = {
  minimizeWindow: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("window:minimize"),
  closeWindow: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("window:close"),
  isWindowBackground: (): Promise<{ ok: boolean; isBackground: boolean }> =>
    ipcRenderer.invoke("window:is-background"),
  cancelTranscription: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("ml:cancel"),
  warmupModel: (
    settings: Pick<AppSettings, "modelSize" | "deviceMode">
  ): Promise<WarmupResponse> =>
    ipcRenderer.invoke("ml:warmup", {
      modelSize: settings.modelSize,
      deviceMode: settings.deviceMode
    }),
  getModelCacheStatus: (): Promise<ModelCacheResponse> =>
    ipcRenderer.invoke("models:cache-status"),
  getGpuStatus: (): Promise<GpuStatusResponse> =>
    ipcRenderer.invoke("gpu:status"),
  getUpdateState: (): Promise<UpdateState> =>
    ipcRenderer.invoke("updates:get-state"),
  checkForUpdates: (manual = true): Promise<UpdateState> =>
    ipcRenderer.invoke("updates:check", manual),
  installUpdate: (): Promise<UpdateState> =>
    ipcRenderer.invoke("updates:install"),
  startRecording: (): Promise<{ ok: boolean }> => ipcRenderer.invoke("recording:start"),
  stopRecording: (): Promise<{ ok: boolean }> => ipcRenderer.invoke("recording:stop"),
  saveRecording: (
    buffer: ArrayBuffer,
    extension: string
  ): Promise<{ ok: boolean; filePath: string }> =>
    ipcRenderer.invoke("recording:save", { buffer, extension }),
  transcribeFile: (
    filePath: string,
    settings: Pick<
      AppSettings,
      | "modelSize"
      | "language"
      | "deviceMode"
      | "vadSilenceMs"
      | "beamSize"
      | "termHints"
    >
  ): Promise<TranscriptionResponse> =>
    ipcRenderer.invoke("transcribe:file", {
      filePath,
      modelSize: settings.modelSize,
      language: settings.language,
      deviceMode: settings.deviceMode,
      vadSilenceMs: settings.vadSilenceMs,
      beamSize: settings.beamSize,
      termHints: settings.termHints
    }),
  copyText: (text: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("clipboard:copy", text),
  getOverlayState: (): Promise<MiniOverlayState> =>
    ipcRenderer.invoke("overlay:get-state"),
  updateOverlay: (state: MiniOverlayState): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("overlay:update", state),
  loadSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:load"),
  saveSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke("settings:save", settings),
  loadHistory: (): Promise<HistoryItem[]> => ipcRenderer.invoke("history:load"),
  saveHistory: (history: HistoryItem[]): Promise<HistoryItem[]> =>
    ipcRenderer.invoke("history:save", history),
  onHotkeyPressed: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on("hotkey-pressed", listener);
    return () => ipcRenderer.removeListener("hotkey-pressed", listener);
  },
  onAppWarning: (callback: (message: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string): void =>
      callback(message);
    ipcRenderer.on("app-warning", listener);
    return () => ipcRenderer.removeListener("app-warning", listener);
  },
  onOverlayState: (callback: (state: MiniOverlayState) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: MiniOverlayState
    ): void => callback(state);
    ipcRenderer.on("overlay-state", listener);
    return () => ipcRenderer.removeListener("overlay-state", listener);
  },
  onUpdateState: (callback: (state: UpdateState) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: UpdateState
    ): void => callback(state);
    ipcRenderer.on("updates:state", listener);
    return () => ipcRenderer.removeListener("updates:state", listener);
  }
};

contextBridge.exposeInMainWorld("promptik", api);
