export type ModelSize =
  | "tiny"
  | "base"
  | "small"
  | "medium"
  | "large-v3-turbo"
  | "large-v3";
export type LanguageCode = "auto" | "ru" | "en";
export type DeviceMode = "auto" | "cpu" | "cuda";
export type QualityPreset = "fast" | "balanced" | "maximum" | "custom";
export type HotkeyAccelerator =
  | "CommandOrControl+Alt+Space"
  | "CommandOrControl+Shift+Space"
  | "CommandOrControl+Alt+R"
  | "CommandOrControl+Shift+R"
  | "CommandOrControl+Right"
  | "CommandOrControl+`";
export type HistorySource = "microphone" | "file";
export type ModelDownloadState = "checking" | "downloaded" | "missing" | "unknown";
export type AppStatus =
  | "ready"
  | "recording"
  | "loading-model"
  | "transcribing"
  | "copied"
  | "error";
export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface OverlayState {
  status: AppStatus;
  message?: string;
  audioLevel?: number;
  hotkeyLabel?: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface AppSettings {
  qualityPreset: QualityPreset;
  modelSize: ModelSize;
  language: LanguageCode;
  deviceMode: DeviceMode;
  autoCopy: boolean;
  aiFormat: boolean;
  vadSilenceMs: number;
  beamSize: number;
  liveChunkMs: number;
  liveWindowMs: number;
  termHints: string;
  hotkey: HotkeyAccelerator;
}

export interface HistoryItem {
  id: string;
  datetime: string;
  text: string;
  source: HistorySource;
  language: LanguageCode;
  model: ModelSize;
  segments: TranscriptSegment[];
}

export interface TranscriptionResponse {
  ok: boolean;
  text?: string;
  language?: string;
  segments?: TranscriptSegment[];
  error?: string;
}

export interface ModelCacheResponse {
  ok: boolean;
  cache_dir?: string;
  models?: Partial<Record<ModelSize, boolean>>;
  error?: string;
}

export interface GpuStatusResponse {
  ok: boolean;
  cuda_available?: boolean;
  cuda_device_count?: number;
  cuda_dll_dirs?: string[];
  error?: string;
}

export interface WarmupResponse {
  ok: boolean;
  model_size?: ModelSize;
  device?: DeviceMode;
  compute_type?: string;
  error?: string;
}

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  message?: string;
  progress?: number;
  checkedAt?: string;
}

export type ModelCacheStatus = Partial<Record<ModelSize, ModelDownloadState>>;

export interface PromptikApi {
  minimizeWindow: () => Promise<{ ok: boolean }>;
  closeWindow: () => Promise<{ ok: boolean }>;
  isWindowBackground: () => Promise<{ ok: boolean; isBackground: boolean }>;
  cancelTranscription: () => Promise<{ ok: boolean }>;
  warmupModel: (
    settings: Pick<AppSettings, "modelSize" | "deviceMode">
  ) => Promise<WarmupResponse>;
  getModelCacheStatus: () => Promise<ModelCacheResponse>;
  getGpuStatus: () => Promise<GpuStatusResponse>;
  getUpdateState: () => Promise<UpdateState>;
  checkForUpdates: (manual?: boolean) => Promise<UpdateState>;
  installUpdate: () => Promise<UpdateState>;
  startRecording: () => Promise<{ ok: boolean }>;
  stopRecording: () => Promise<{ ok: boolean }>;
  saveRecording: (
    buffer: ArrayBuffer,
    extension: string
  ) => Promise<{ ok: boolean; filePath: string }>;
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
    > & { promptMode?: "default" | "none" | "live" }
  ) => Promise<TranscriptionResponse>;
  copyText: (text: string) => Promise<{ ok: boolean; error?: string }>;
  getOverlayState: () => Promise<OverlayState>;
  updateOverlay: (state: OverlayState) => Promise<{ ok: boolean }>;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
  loadHistory: () => Promise<HistoryItem[]>;
  saveHistory: (history: HistoryItem[]) => Promise<HistoryItem[]>;
  onHotkeyPressed: (callback: () => void) => () => void;
  onAppWarning: (callback: (message: string) => void) => () => void;
  onOverlayState: (callback: (state: OverlayState) => void) => () => void;
  onUpdateState: (callback: (state: UpdateState) => void) => () => void;
}

declare global {
  interface Window {
    promptik: PromptikApi;
  }
}
