import { readFile, writeFile } from "node:fs/promises";
import { resolveDataPath } from "./fileSystem";

export type ModelSize =
  | "tiny"
  | "base"
  | "small"
  | "medium"
  | "large-v3-turbo"
  | "large-v3";
export type LanguageCode = "auto" | "ru" | "en";
export type HistorySource = "microphone" | "file";
export type DeviceMode = "auto" | "cpu" | "cuda";
export type QualityPreset = "fast" | "balanced" | "maximum" | "custom";
export type HotkeyAccelerator =
  | "CommandOrControl+Alt+Space"
  | "CommandOrControl+Shift+Space"
  | "CommandOrControl+Alt+R"
  | "CommandOrControl+Shift+R"
  | "CommandOrControl+Right"
  | "CommandOrControl+`";

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

export const DEFAULT_SETTINGS: AppSettings = {
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

const MODEL_SIZES: ModelSize[] = [
  "tiny",
  "base",
  "small",
  "medium",
  "large-v3-turbo",
  "large-v3"
];
const LANGUAGES: LanguageCode[] = ["auto", "ru", "en"];
const DEVICE_MODES: DeviceMode[] = ["auto", "cpu", "cuda"];
const QUALITY_PRESETS: QualityPreset[] = [
  "fast",
  "balanced",
  "maximum",
  "custom"
];
const HOTKEYS: HotkeyAccelerator[] = [
  "CommandOrControl+Alt+Space",
  "CommandOrControl+Shift+Space",
  "CommandOrControl+Alt+R",
  "CommandOrControl+Shift+R",
  "CommandOrControl+Right",
  "CommandOrControl+`"
];

function normalizeSettings(value: Partial<AppSettings>): AppSettings {
  return {
    qualityPreset: QUALITY_PRESETS.includes(value.qualityPreset as QualityPreset)
      ? (value.qualityPreset as QualityPreset)
      : DEFAULT_SETTINGS.qualityPreset,
    modelSize: MODEL_SIZES.includes(value.modelSize as ModelSize)
      ? (value.modelSize as ModelSize)
      : DEFAULT_SETTINGS.modelSize,
    language: LANGUAGES.includes(value.language as LanguageCode)
      ? (value.language as LanguageCode)
      : DEFAULT_SETTINGS.language,
    deviceMode: DEVICE_MODES.includes(value.deviceMode as DeviceMode)
      ? (value.deviceMode as DeviceMode)
      : DEFAULT_SETTINGS.deviceMode,
    autoCopy:
      typeof value.autoCopy === "boolean"
        ? value.autoCopy
        : DEFAULT_SETTINGS.autoCopy,
    aiFormat:
      typeof value.aiFormat === "boolean"
        ? value.aiFormat
        : DEFAULT_SETTINGS.aiFormat,
    vadSilenceMs: normalizeVadSilence(value.vadSilenceMs),
    beamSize: normalizeBeamSize(value.beamSize),
    termHints:
      typeof value.termHints === "string"
        ? value.termHints.slice(0, 2000)
        : DEFAULT_SETTINGS.termHints,
    hotkey: HOTKEYS.includes(value.hotkey as HotkeyAccelerator)
      ? (value.hotkey as HotkeyAccelerator)
      : DEFAULT_SETTINGS.hotkey
  };
}

function normalizeVadSilence(value: unknown): number {
  const numericValue = typeof value === "number" ? value : DEFAULT_SETTINGS.vadSilenceMs;
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_SETTINGS.vadSilenceMs;
  }

  return Math.min(2000, Math.max(200, Math.round(numericValue / 50) * 50));
}

function normalizeBeamSize(value: unknown): number {
  const numericValue = typeof value === "number" ? value : DEFAULT_SETTINGS.beamSize;
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_SETTINGS.beamSize;
  }

  return Math.min(12, Math.max(1, Math.round(numericValue)));
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(resolveDataPath("settings.json"), "utf8");
    return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    await saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeSettings(settings);
  await writeFile(
    resolveDataPath("settings.json"),
    JSON.stringify(normalized, null, 2) + "\n",
    "utf8"
  );
  return normalized;
}

function normalizeSegment(segment: TranscriptSegment): TranscriptSegment {
  return {
    start: Number.isFinite(segment.start) ? segment.start : 0,
    end: Number.isFinite(segment.end) ? segment.end : 0,
    text: typeof segment.text === "string" ? segment.text : ""
  };
}

function normalizeHistoryItem(item: HistoryItem): HistoryItem | null {
  if (!item || typeof item.id !== "string" || typeof item.text !== "string") {
    return null;
  }

  return {
    id: item.id,
    datetime:
      typeof item.datetime === "string"
        ? item.datetime
        : new Date().toISOString(),
    text: item.text,
    source: item.source === "file" ? "file" : "microphone",
    language: LANGUAGES.includes(item.language) ? item.language : "auto",
    model: MODEL_SIZES.includes(item.model) ? item.model : "large-v3",
    segments: Array.isArray(item.segments)
      ? item.segments.map(normalizeSegment)
      : []
  };
}

export async function loadHistory(): Promise<HistoryItem[]> {
  try {
    const raw = await readFile(resolveDataPath("history.json"), "utf8");
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeHistoryItem)
      .filter((item): item is HistoryItem => item !== null)
      .slice(0, 50);
  } catch {
    await saveHistory([]);
    return [];
  }
}

export async function saveHistory(history: HistoryItem[]): Promise<HistoryItem[]> {
  const normalized = history
    .map(normalizeHistoryItem)
    .filter((item): item is HistoryItem => item !== null)
    .slice(0, 50);

  await writeFile(
    resolveDataPath("history.json"),
    JSON.stringify(normalized, null, 2) + "\n",
    "utf8"
  );

  return normalized;
}
