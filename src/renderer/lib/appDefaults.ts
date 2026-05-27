import type {
  AppSettings,
  ModelDownloadState,
  ModelCacheStatus,
  ModelSize,
  UpdateState
} from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  qualityPreset: "maximum",
  modelSize: "large-v3",
  language: "ru",
  deviceMode: "auto",
  autoCopy: true,
  aiFormat: false,
  vadSilenceMs: 1100,
  beamSize: 12,
  liveChunkMs: 1000,
  liveWindowMs: 5000,
  termHints:
    "ChatGPT, Claude, Codex, Cursor, OpenAI, Python, TypeScript, React, Electron, Whisper, faster-whisper, CUDA",
  hotkey: "CommandOrControl+Alt+Space"
};

export const MODELS: ModelSize[] = ["large-v3-turbo", "large-v3"];

export function modelCacheStatusFor(state: ModelDownloadState): ModelCacheStatus {
  return MODELS.reduce<ModelCacheStatus>((accumulator, model) => {
    accumulator[model] = state;
    return accumulator;
  }, {});
}

export const DEFAULT_MODEL_CACHE_STATUS: ModelCacheStatus =
  modelCacheStatusFor("checking");

export const DEFAULT_UPDATE_STATE: UpdateState = {
  status: "idle",
  currentVersion: "",
  message: "Проверка обновлений еще не запускалась."
};
