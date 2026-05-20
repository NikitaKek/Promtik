import { Clock3, FileAudio2, Trash2 } from "lucide-react";
import type { HistoryItem } from "../lib/types";
import { excerpt, formatDateTime, modelLabel, sourceLabel } from "../lib/formatting";

interface HistoryPanelProps {
  history: HistoryItem[];
  activeId: string | null;
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export function HistoryPanel({
  history,
  activeId,
  onSelect,
  onClear
}: HistoryPanelProps): JSX.Element {
  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-white/[0.055] p-4 shadow-glass backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">История</h2>
          <p className="text-sm text-slate-400">Последние 50 транскрибаций</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={history.length === 0}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.055] text-slate-300 transition hover:border-red-200/35 hover:bg-red-400/10 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-35"
            title="Очистить всю историю"
            aria-label="Очистить всю историю"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <Clock3 className="h-5 w-5 text-slate-400" />
        </div>
      </div>

      <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
        {history.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-slate-400">
            История пока пуста
          </div>
        ) : (
          history.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={[
                "w-full rounded-lg border p-3 text-left transition",
                activeId === item.id
                  ? "border-teal-200/40 bg-teal-300/10"
                  : "border-white/10 bg-black/[0.18] hover:border-white/20 hover:bg-white/[0.07]"
              ].join(" ")}
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <FileAudio2 className="h-3.5 w-3.5" />
                  {sourceLabel(item.source)}
                </span>
                <span>{formatDateTime(item.datetime)}</span>
              </div>
              <p className="text-sm leading-5 text-slate-100">{excerpt(item.text, 140)}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-slate-400">
                <span className="rounded-md bg-white/5 px-2 py-1">{modelLabel(item.model)}</span>
                <span className="rounded-md bg-white/5 px-2 py-1">{item.language}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
