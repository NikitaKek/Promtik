import { useEffect, useRef } from "react";
import { Copy } from "lucide-react";

interface TranscriptEditorProps {
  text: string;
  disabled: boolean;
  selectionToken: number;
  onChange: (text: string) => void;
  onCopy: () => void;
}

export function TranscriptEditor({
  text,
  disabled,
  selectionToken,
  onChange,
  onCopy
}: TranscriptEditorProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasText = text.trim().length > 0;

  useEffect(() => {
    if (selectionToken > 0 && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [selectionToken]);

  return (
    <div className="relative min-h-[420px] flex-1">
      <button
        type="button"
        onClick={onCopy}
        disabled={!hasText || disabled}
        title="Скопировать"
        aria-label="Скопировать"
        className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.075] text-slate-100 shadow-sm transition hover:border-teal-200/40 hover:bg-teal-300/10 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Copy className="h-4 w-4" />
      </button>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        className="h-full min-h-[420px] w-full resize-none rounded-lg border border-white/10 bg-black/25 p-4 pr-16 text-base leading-7 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-teal-200/50 focus:ring-4 focus:ring-teal-300/10"
      />
    </div>
  );
}
