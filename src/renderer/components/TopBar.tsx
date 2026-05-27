import {
  AlertTriangle,
  Download,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw
} from "lucide-react";
import logoUrl from "../../../assets/logo.svg";
import { StatusBadge } from "./StatusBadge";
import type { AppStatus, UpdateState } from "../lib/types";

interface TopBarProps {
  status: AppStatus;
  message?: string;
  messageTone?: "error" | "notice";
  hotkeyLabel: string;
  updateState: UpdateState;
  onCheckUpdates: () => void;
  onInstallUpdate: () => void;
}

export function TopBar({
  status,
  message,
  messageTone = "notice",
  hotkeyLabel,
  updateState,
  onCheckUpdates,
  onInstallUpdate
}: TopBarProps): JSX.Element {
  const hasMessage = Boolean(message);
  const isError = messageTone === "error";
  const updateLine = getUpdateLine(updateState);
  const statusLine = message ?? updateLine ?? `Горячая клавиша: ${hotkeyLabel}`;
  const updateIsBusy =
    updateState.status === "checking" || updateState.status === "downloading";
  const canInstallUpdate =
    updateState.status === "available" || updateState.status === "downloaded";

  return (
    <header className="flex flex-col gap-4 rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-glass backdrop-blur-xl md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <img src={logoUrl} alt="Promptik" className="h-16 w-auto shrink-0" />
      </div>
      <div className="flex h-14 w-full shrink-0 flex-col items-start justify-center gap-1 md:w-[470px] md:items-end">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <button
            type="button"
            onClick={onCheckUpdates}
            disabled={updateIsBusy}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-slate-300 transition hover:border-teal-200/25 hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-50"
            title="Проверить обновление"
            aria-label="Проверить обновление"
          >
            {updateState.status === "checking" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
          {canInstallUpdate ? (
            <button
              type="button"
              onClick={onInstallUpdate}
              className="grid h-9 w-9 place-items-center rounded-lg border border-teal-200/25 bg-teal-300/10 text-teal-100 transition hover:bg-teal-300/20"
              title={
                updateState.status === "downloaded"
                  ? "Установить обновление"
                  : "Скачать обновление"
              }
              aria-label={
                updateState.status === "downloaded"
                  ? "Установить обновление"
                  : "Скачать обновление"
              }
            >
              {updateState.status === "downloaded" ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </div>
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

function getUpdateLine(updateState: UpdateState): string | undefined {
  if (updateState.status === "idle") {
    return undefined;
  }

  if (updateState.status === "not-available" && !updateState.manual) {
    return undefined;
  }

  if (updateState.status === "downloading") {
    const progress =
      typeof updateState.progress === "number"
        ? ` ${Math.round(updateState.progress)}%`
        : "";
    return `Скачиваем обновление${progress}`;
  }

  return updateState.message;
}
