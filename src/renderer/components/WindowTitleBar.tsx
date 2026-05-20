import { Minus, Square, X } from "lucide-react";
import iconUrl from "../../../assets/icon.svg";

export function WindowTitleBar(): JSX.Element {
  return (
    <div className="app-drag relative z-20 flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-[#080C11]/90 px-3 text-slate-200 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <img src={iconUrl} alt="" className="h-6 w-6 rounded-md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-4 text-white">Promptik</p>
          <p className="truncate text-[11px] leading-4 text-slate-500">локальная транскрибация</p>
        </div>
      </div>

      <div className="app-no-drag flex items-center gap-1">
        <WindowButton
          label="Свернуть"
          onClick={() => void window.promptik.minimizeWindow()}
          tone="neutral"
        >
          <Minus className="h-4 w-4" />
        </WindowButton>
        <WindowButton label="Размер окна зафиксирован" disabled tone="neutral">
          <Square className="h-3.5 w-3.5" />
        </WindowButton>
        <WindowButton
          label="Закрыть"
          onClick={() => void window.promptik.closeWindow()}
          tone="danger"
        >
          <X className="h-4 w-4" />
        </WindowButton>
      </div>
    </div>
  );
}

interface WindowButtonProps {
  label: string;
  children: JSX.Element;
  tone: "neutral" | "danger";
  disabled?: boolean;
  onClick?: () => void;
}

function WindowButton({
  label,
  children,
  tone,
  disabled = false,
  onClick
}: WindowButtonProps): JSX.Element {
  const toneClass =
    tone === "danger"
      ? "hover:border-red-300/35 hover:bg-red-400/20 hover:text-red-50"
      : "hover:border-teal-200/25 hover:bg-white/10 hover:text-white";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "grid h-8 w-10 place-items-center rounded-md border border-transparent text-slate-400 transition",
        toneClass,
        disabled
          ? "cursor-default opacity-35 hover:border-transparent hover:bg-transparent"
          : ""
      ].join(" ")}
    >
      {children}
    </button>
  );
}
