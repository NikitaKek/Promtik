import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, Mic } from "lucide-react";
import type { AppStatus } from "../lib/types";
import { statusLabel } from "../lib/formatting";

interface StatusBadgeProps {
  status: AppStatus;
}

export function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  const iconClass = "h-4 w-4";
  const icon = {
    ready: <CheckCircle2 className={iconClass} />,
    recording: <Mic className={iconClass} />,
    "loading-model": <Loader2 className={`${iconClass} animate-spin`} />,
    transcribing: <Loader2 className={`${iconClass} animate-spin`} />,
    copied: <ClipboardCheck className={iconClass} />,
    error: <AlertTriangle className={iconClass} />
  }[status];

  const tone = {
    ready: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    recording: "border-rose-300/40 bg-rose-400/15 text-rose-100",
    "loading-model": "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
    transcribing: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    copied: "border-teal-300/30 bg-teal-300/10 text-teal-100",
    error: "border-red-300/40 bg-red-400/15 text-red-100"
  }[status];

  return (
    <div
      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium shadow-sm ${tone}`}
    >
      {icon}
      {statusLabel(status)}
    </div>
  );
}
