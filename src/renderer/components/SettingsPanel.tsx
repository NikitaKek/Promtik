import {
  Gauge,
  Keyboard,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Sparkles
} from "lucide-react";
import type {
  AppSettings,
  DeviceMode,
  GpuStatusResponse,
  HotkeyAccelerator,
  LanguageCode,
  ModelCacheStatus,
  ModelSize
} from "../lib/types";
import { hotkeyLabel, languageLabel, modelLabel } from "../lib/formatting";
import {
  DEVICES,
  HOTKEYS,
  LANGUAGES,
  MODELS,
  QUALITY_PRESETS,
  deviceLabel,
  type QualityPresetConfig
} from "./settingsOptions";
import {
  GpuStatusBadge,
  ModelCacheBadge,
  Toggle
} from "./settingsControls";

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
      liveChunkMs: preset.liveChunkMs,
      liveWindowMs: preset.liveWindowMs,
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

          <div className="rounded-lg border border-white/10 bg-black/[0.18] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <span className="block text-sm font-medium text-slate-200">
                  Live-черновик
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  Как часто обновлять текст во время записи
                </span>
              </div>
              <span className="rounded-md border border-teal-200/20 bg-teal-300/10 px-2 py-1 text-xs font-semibold text-teal-100">
                {(settings.liveChunkMs / 1000).toFixed(
                  settings.liveChunkMs % 1000 === 0 ? 0 : 1
                )} с
              </span>
            </div>
            <input
              type="range"
              min={1000}
              max={5000}
              step={500}
              value={settings.liveChunkMs}
              disabled={disabled}
              onChange={(event) =>
                setCustomQuality({ liveChunkMs: Number(event.target.value) })
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-teal-300 disabled:cursor-not-allowed disabled:opacity-45"
              title="Интервал live-черновика"
            />
            <div className="mt-2 flex justify-between text-[11px] text-slate-500">
              <span>Чаще</span>
              <span>Реже</span>
            </div>

            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <span className="block text-sm font-medium text-slate-200">
                    Контекст live
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">
                    Сколько последних секунд отправлять в модель
                  </span>
                </div>
                <span className="rounded-md border border-teal-200/20 bg-teal-300/10 px-2 py-1 text-xs font-semibold text-teal-100">
                  {(settings.liveWindowMs / 1000).toFixed(
                    settings.liveWindowMs % 1000 === 0 ? 0 : 1
                  )} с
                </span>
              </div>
              <input
                type="range"
                min={3000}
                max={8000}
                step={500}
                value={settings.liveWindowMs}
                disabled={disabled}
                onChange={(event) =>
                  setCustomQuality({ liveWindowMs: Number(event.target.value) })
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-teal-300 disabled:cursor-not-allowed disabled:opacity-45"
                title="Контекст live-черновика"
              />
              <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                <span>Быстрее</span>
                <span>Точнее</span>
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
