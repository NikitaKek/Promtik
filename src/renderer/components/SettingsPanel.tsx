import {
  CheckCircle2,
  CloudOff,
  Cpu,
  Gauge,
  HelpCircle,
  Keyboard,
  Loader2,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Zap
} from "lucide-react";
import type {
  AppSettings,
  DeviceMode,
  GpuStatusResponse,
  HotkeyAccelerator,
  LanguageCode,
  ModelCacheStatus,
  ModelDownloadState,
  ModelSize,
  QualityPreset
} from "../lib/types";
import { hotkeyLabel, languageLabel, modelLabel } from "../lib/formatting";

interface SettingsPanelProps {
  settings: AppSettings;
  modelCacheStatus: ModelCacheStatus;
  modelCacheDir: string | null;
  gpuStatus: GpuStatusResponse | null;
  isCheckingModels: boolean;
  disabled: boolean;
  onChange: (settings: AppSettings) => void;
  onRefreshModelCacheStatus: () => void;
  onRefreshGpuStatus: () => void;
}

type PresetId = Exclude<QualityPreset, "custom">;

interface QualityPresetConfig {
  id: PresetId;
  title: string;
  caption: string;
  modelSize: ModelSize;
  beamSize: number;
  vadSilenceMs: number;
  deviceMode: DeviceMode;
  requirement: string;
  bestFor: string;
}

const MODELS: ModelSize[] = ["large-v3-turbo", "large-v3"];
const LANGUAGES: LanguageCode[] = ["auto", "ru", "en"];
const DEVICES: DeviceMode[] = ["cuda", "auto", "cpu"];
const HOTKEYS: HotkeyAccelerator[] = [
  "CommandOrControl+Alt+Space",
  "CommandOrControl+Shift+Space",
  "CommandOrControl+Alt+R",
  "CommandOrControl+Shift+R",
  "CommandOrControl+Right",
  "CommandOrControl+`"
];

const QUALITY_PRESETS: QualityPresetConfig[] = [
  {
    id: "fast",
    title: "Быстро",
    caption: "large-v3-turbo · точность 3",
    modelSize: "large-v3-turbo",
    beamSize: 3,
    vadSilenceMs: 850,
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
    deviceMode: "auto",
    requirement: "NVIDIA GPU 16 ГБ VRAM, 32 ГБ RAM.",
    bestFor: "Самый строгий режим для сложной речи, имен и длинных формулировок."
  }
];

export function SettingsPanel({
  settings,
  modelCacheStatus,
  modelCacheDir,
  gpuStatus,
  isCheckingModels,
  disabled,
  onChange,
  onRefreshModelCacheStatus,
  onRefreshGpuStatus
}: SettingsPanelProps): JSX.Element {
  const selectedPreset = QUALITY_PRESETS.find(
    (preset) => preset.id === settings.qualityPreset
  );

  const applyPreset = (preset: QualityPresetConfig): void => {
    onChange({
      ...settings,
      qualityPreset: preset.id,
      modelSize: preset.modelSize,
      beamSize: preset.beamSize,
      vadSilenceMs: preset.vadSilenceMs,
      deviceMode: preset.deviceMode
    });
  };

  const setCustomQuality = (patch: Partial<AppSettings>): void => {
    onChange({ ...settings, ...patch, qualityPreset: "custom" });
  };

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-glass backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Настройки</h2>
          <p className="text-sm text-slate-400">
            {selectedPreset
              ? `${selectedPreset.title}: ${selectedPreset.caption}`
              : "Ручной режим качества"}
          </p>
        </div>
        <Settings2 className="h-5 w-5 text-slate-400" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Sparkles className="h-4 w-4 text-teal-200" />
              Пресеты качества
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              {QUALITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => applyPreset(preset)}
                  className={[
                    "min-h-[132px] rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45",
                    settings.qualityPreset === preset.id
                      ? "border-teal-200/45 bg-teal-300/[0.12] shadow-[0_0_24px_rgba(94,234,212,0.12)]"
                      : "border-white/10 bg-white/[0.045] hover:border-teal-200/30 hover:bg-white/[0.07]"
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{preset.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{preset.caption}</p>
                    </div>
                    <Gauge className="h-4 w-4 text-teal-200" />
                  </div>
                  <p className="text-xs leading-5 text-slate-300">{preset.bestFor}</p>
                  <p className="mt-2 text-[11px] leading-4 text-slate-500">
                    {preset.requirement}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block rounded-lg border border-white/10 bg-black/[0.18] p-3">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Модель Whisper
              </span>
              <select
                value={settings.modelSize}
                disabled={disabled}
                onChange={(event) =>
                  setCustomQuality({ modelSize: event.target.value as ModelSize })
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-slate-100 outline-none focus:border-teal-200/50 focus:ring-4 focus:ring-teal-300/10"
              >
                {MODELS.map((model) => (
                  <option key={model} value={model}>
                    {modelLabel(model)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block rounded-lg border border-white/10 bg-black/[0.18] p-3">
              <span className="mb-2 block text-sm font-medium text-slate-300">
                Язык
              </span>
              <select
                value={settings.language}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    language: event.target.value as LanguageCode
                  })
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-slate-100 outline-none focus:border-teal-200/50 focus:ring-4 focus:ring-teal-300/10"
              >
                {LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {languageLabel(language)}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[11px] text-slate-500">
                Для русской речи точнее выбрать ru вместо auto.
              </p>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <span className="block text-sm font-medium text-slate-200">
                    Точность поиска
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">
                    Сколько вариантов модель сравнивает
                  </span>
                </div>
                <span className="rounded-md border border-teal-200/20 bg-teal-300/10 px-2 py-1 text-xs font-semibold text-teal-100">
                  {settings.beamSize}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={settings.beamSize}
                disabled={disabled}
                onChange={(event) =>
                  setCustomQuality({ beamSize: Number(event.target.value) })
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-teal-300 disabled:cursor-not-allowed disabled:opacity-45"
                title="Точность поиска"
              />
              <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                <span>Быстрее</span>
                <span>Точнее</span>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <span className="block text-sm font-medium text-slate-200">
                    Разделение фраз
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">
                    Сколько тишины считать концом фразы
                  </span>
                </div>
                <span className="rounded-md border border-teal-200/20 bg-teal-300/10 px-2 py-1 text-xs font-semibold text-teal-100">
                  {settings.vadSilenceMs} мс
                </span>
              </div>
              <input
                type="range"
                min={200}
                max={2000}
                step={50}
                value={settings.vadSilenceMs}
                disabled={disabled}
                onChange={(event) =>
                  setCustomQuality({ vadSilenceMs: Number(event.target.value) })
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-teal-300 disabled:cursor-not-allowed disabled:opacity-45"
                title="Разделение фраз"
              />
              <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                <span>Режет чаще</span>
                <span>Склеивает фразы</span>
              </div>
            </div>
          </div>

          <label className="block rounded-lg border border-white/10 bg-black/[0.18] p-3">
            <span className="mb-2 block text-sm font-medium text-slate-300">
              Словарь терминов
            </span>
            <textarea
              value={settings.termHints}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...settings, termHints: event.target.value })
              }
              className="min-h-[96px] w-full resize-none rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm leading-5 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-teal-200/50 focus:ring-4 focus:ring-teal-300/10 disabled:cursor-not-allowed disabled:opacity-45"
              placeholder="Имена, названия проектов, английские термины..."
              maxLength={2000}
            />
            <p className="mt-2 text-[11px] leading-4 text-slate-500">
              Эти слова передаются Whisper как подсказка: добавь сюда то, что модель
              часто путает.
            </p>
          </label>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <span className="block text-sm font-medium text-slate-200">
                  Устройство
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  CUDA GPU или CPU int8
                </span>
              </div>
              <button
                type="button"
                onClick={onRefreshGpuStatus}
                disabled={disabled}
                title="Проверить CUDA GPU"
                className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.065] text-slate-200 transition hover:border-teal-200/40 hover:bg-teal-300/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <select
              value={settings.deviceMode}
              disabled={disabled}
              onChange={(event) =>
                setCustomQuality({ deviceMode: event.target.value as DeviceMode })
              }
              className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-slate-100 outline-none focus:border-teal-200/50 focus:ring-4 focus:ring-teal-300/10"
            >
              {DEVICES.map((device) => (
                <option key={device} value={device}>
                  {deviceLabel(device)}
                </option>
              ))}
            </select>

            <GpuStatusBadge status={gpuStatus} />
          </div>

          <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <span className="block text-sm font-medium text-slate-200">
                  Статус моделей
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  Локальный cache faster-whisper
                </span>
              </div>
              <button
                type="button"
                onClick={onRefreshModelCacheStatus}
                disabled={disabled || isCheckingModels}
                title="Обновить статус моделей"
                className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.065] text-slate-200 transition hover:border-teal-200/40 hover:bg-teal-300/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <RefreshCw className={`h-4 w-4 ${isCheckingModels ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {MODELS.map((model) => (
                <ModelCacheBadge
                  key={model}
                  model={model}
                  state={modelCacheStatus[model] ?? "unknown"}
                  selected={settings.modelSize === model}
                />
              ))}
            </div>

            {modelCacheDir ? (
              <p className="mt-3 truncate text-[11px] text-slate-500" title={modelCacheDir}>
                Cache: {modelCacheDir}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <SlidersHorizontal className="h-4 w-4 text-teal-200" />
              Поведение
            </div>
            <div className="space-y-2">
              <label className="block rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                  <Keyboard className="h-4 w-4 text-teal-200" />
                  Горячая клавиша
                </span>
                <select
                  value={settings.hotkey}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...settings,
                      hotkey: event.target.value as HotkeyAccelerator
                    })
                  }
                  className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-slate-100 outline-none focus:border-teal-200/50 focus:ring-4 focus:ring-teal-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {HOTKEYS.map((hotkey) => (
                    <option key={hotkey} value={hotkey}>
                      {hotkeyLabel(hotkey)}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs leading-4 text-slate-500">
                  Работает глобально, даже когда основное окно свернуто.
                </span>
              </label>

              <Toggle
                label="Auto-copy"
                description="После распознавания текст сразу попадает в буфер обмена."
                checked={settings.autoCopy}
                disabled={disabled}
                onChange={(checked) => onChange({ ...settings, autoCopy: checked })}
              />

              <Toggle
                label="Формат для ИИ"
                description="Копирует не только текст, а готовую формулировку запроса для AI-чата."
                checked={settings.aiFormat}
                disabled={disabled}
                onChange={(checked) => onChange({ ...settings, aiFormat: checked })}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function deviceLabel(device: DeviceMode): string {
  const labels: Record<DeviceMode, string> = {
    cuda: "CUDA GPU - максимум скорости",
    auto: "Auto - GPU, затем CPU",
    cpu: "CPU int8 - совместимый режим"
  };

  return labels[device];
}

interface GpuStatusBadgeProps {
  status: GpuStatusResponse | null;
}

function GpuStatusBadge({ status }: GpuStatusBadgeProps): JSX.Element {
  if (!status) {
    return (
      <div className="mt-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">
        Проверка CUDA...
      </div>
    );
  }

  if (status.ok && status.cuda_available) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100">
        <Zap className="h-3.5 w-3.5" />
        CUDA доступна: {status.cuda_device_count ?? 0} GPU
      </div>
    );
  }

  return (
    <div
      className="mt-2 flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-xs text-amber-100"
      title={status.error}
    >
      <Cpu className="h-3.5 w-3.5" />
      CUDA пока недоступна
    </div>
  );
}

interface ModelCacheBadgeProps {
  model: ModelSize;
  state: ModelDownloadState;
  selected: boolean;
}

function ModelCacheBadge({
  model,
  state,
  selected
}: ModelCacheBadgeProps): JSX.Element {
  const config: Record<
    ModelDownloadState,
    { label: string; className: string; icon: JSX.Element }
  > = {
    checking: {
      label: "проверка",
      className: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
      icon: <Loader2 className="h-4 w-4 animate-spin" />
    },
    downloaded: {
      label: "скачана",
      className: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
      icon: <CheckCircle2 className="h-4 w-4" />
    },
    missing: {
      label: "не скачана",
      className: "border-slate-300/15 bg-white/[0.045] text-slate-300",
      icon: <CloudOff className="h-4 w-4" />
    },
    unknown: {
      label: "неизвестно",
      className: "border-amber-300/25 bg-amber-300/10 text-amber-100",
      icon: <HelpCircle className="h-4 w-4" />
    }
  };

  const current = config[state];

  return (
    <div
      className={[
        "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition",
        current.className,
        selected ? "ring-2 ring-teal-300/25" : ""
      ].join(" ")}
      title={`${model}: ${current.label}`}
    >
      {current.icon}
      <div className="min-w-0">
        <p className="truncate font-semibold">{model}</p>
        <p className="truncate text-[11px] opacity-80">{current.label}</p>
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange
}: ToggleProps): JSX.Element {
  return (
    <label className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        <span className="mt-1 block text-xs leading-4 text-slate-500">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 rounded border-white/20 bg-black/30 text-teal-300 focus:ring-teal-300/30"
      />
    </label>
  );
}
