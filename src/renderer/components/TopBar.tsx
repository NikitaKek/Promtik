import { AlertTriangle, Info } from "lucide-react";
import logoUrl from "../../../assets/logo.svg";
import { StatusBadge } from "./StatusBadge";
import type { AppStatus } from "../lib/types";

interface TopBarProps {
  status: AppStatus;
  message?: string;
  messageTone?: "error" | "notice";
  hotkeyLabel: string;
}

export function TopBar({
  status,
  message,
  messageTone = "notice",
  hotkeyLabel
}: TopBarProps): JSX.Element {
  const hasMessage = Boolean(message);
  const isError = messageTone === "error";
  const statusLine = message ?? `Горячая клавиша: ${hotkeyLabel}`;

  return (
    <header className="flex flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-glass backdrop-blur-xl md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <img src={logoUrl} alt="Promptik" className="h-16 w-auto shrink-0" />
      </div>
      <div className="flex h-14 w-full shrink-0 flex-col items-start justify-center gap-1 md:w-[390px] md:items-end">
        <StatusBadge status={status} />
        <div
          className={[
            "flex h-4 max-w-full items-center gap-1.5 text-xs transition-opacity",
            isError ? "text-red-200" : hasMessage ? "text-teal-100" : "text-slate-400"
          ].join(" ")}
          title={statusLine}
          aria-live="polite"
        >
          {isError ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Info className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="min-w-0 truncate">{statusLine}</span>
        </div>
      </div>
    </header>
  );
}
