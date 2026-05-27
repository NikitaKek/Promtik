import {
  CheckCircle2,
  CloudOff,
  Cpu,
  HelpCircle,
  Loader2,
  Zap
} from "lucide-react";
import type {
  GpuStatusResponse,
  ModelDownloadState,
  ModelSize
} from "../lib/types";

interface GpuStatusBadgeProps {
  status: GpuStatusResponse | null;
}

export function GpuStatusBadge({ status }: GpuStatusBadgeProps): JSX.Element {
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

export function ModelCacheBadge({
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

export function Toggle({
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
