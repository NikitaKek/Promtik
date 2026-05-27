import type {
  DeviceMode,
  HotkeyAccelerator,
  LanguageCode,
  ModelSize,
  QualityPreset
} from "../lib/types";
export { MODELS } from "../lib/appDefaults";

export type PresetId = Exclude<QualityPreset, "custom">;

export interface QualityPresetConfig {
  id: PresetId;
  title: string;
  caption: string;
  modelSize: ModelSize;
  beamSize: number;
  vadSilenceMs: number;
  liveChunkMs: number;
  liveWindowMs: number;
  deviceMode: DeviceMode;
  requirement: string;
  bestFor: string;
}

export const LANGUAGES: LanguageCode[] = ["auto", "ru", "en"];
export const DEVICES: DeviceMode[] = ["cuda", "auto", "cpu"];
export const HOTKEYS: HotkeyAccelerator[] = [
  "CommandOrControl+Alt+Space",
  "CommandOrControl+Shift+Space",
  "CommandOrControl+Alt+R",
  "CommandOrControl+Shift+R",
  "CommandOrControl+Right",
  "CommandOrControl+`"
];

export const QUALITY_PRESETS: QualityPresetConfig[] = [
  {
    id: "fast",
    title: "Быстро",
    caption: "large-v3-turbo · точность 3",
    modelSize: "large-v3-turbo",
    beamSize: 3,
    vadSilenceMs: 850,
    liveChunkMs: 1000,
    liveWindowMs: 3000,
    deviceMode: "auto",
    requirement: "NVIDIA GPU 8 ГБ VRAM, 16 ГБ RAM.",
    bestFor: "Хорошее качество, но быстрее основного режима."
  },
  {
    id: "balanced",
    title: "Баланс",
    caption: "large-v3 · точность 5",
    modelSize: "large-v3",
    beamSize: 5,
    vadSilenceMs: 900,
    liveChunkMs: 3000,
    liveWindowMs: 5000,
    deviceMode: "auto",
    requirement: "NVIDIA GPU 12-16 ГБ VRAM, 32 ГБ RAM.",
    bestFor: "Текущий стабильный режим, который хорошо распознает речь."
  },
  {
    id: "maximum",
    title: "Максимум",
    caption: "large-v3 · точность 12",
    modelSize: "large-v3",
    beamSize: 12,
    vadSilenceMs: 1100,
    liveChunkMs: 1000,
    liveWindowMs: 5000,
    deviceMode: "auto",
    requirement: "NVIDIA GPU 16 ГБ VRAM, 32 ГБ RAM.",
    bestFor: "Самый строгий режим для сложной речи, имен и длинных формулировок."
  }
];

export function deviceLabel(device: DeviceMode): string {
  const labels: Record<DeviceMode, string> = {
    cuda: "CUDA GPU - максимум скорости",
    auto: "Auto - GPU, затем CPU",
    cpu: "CPU int8 - совместимый режим"
  };

  return labels[device];
}
