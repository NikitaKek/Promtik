import { Mic, Square } from "lucide-react";

interface RecordButtonProps {
  isRecording: boolean;
  isBusy: boolean;
  onToggle: () => void;
}

export function RecordButton({
  isRecording,
  isBusy,
  onToggle
}: RecordButtonProps): JSX.Element {
  const label = isRecording ? "Остановить" : "Записать";

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={onToggle}
        disabled={isBusy && !isRecording}
        className={[
          "group relative grid h-44 w-44 place-items-center rounded-full border transition duration-300",
          "focus:outline-none focus:ring-4 focus:ring-teal-300/25",
          isRecording
            ? "border-rose-200/50 bg-rose-400/20 shadow-[0_0_72px_rgba(251,113,133,0.34)]"
            : "border-teal-200/40 bg-teal-300/15 shadow-glow",
          isBusy && !isRecording ? "cursor-not-allowed opacity-60" : "hover:scale-[1.02]"
        ].join(" ")}
        aria-label={label}
        title={label}
      >
        <span
          className={[
            "absolute inset-3 rounded-full border",
            isRecording ? "animate-ping border-rose-200/30" : "border-teal-200/10"
          ].join(" ")}
        />
        <span className="grid h-28 w-28 place-items-center rounded-full bg-black/35 backdrop-blur">
          {isRecording ? (
            <Square className="h-12 w-12 fill-rose-100 text-rose-100" />
          ) : (
            <Mic className="h-14 w-14 text-teal-100" />
          )}
        </span>
      </button>
    </div>
  );
}
