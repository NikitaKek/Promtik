import { Square } from "lucide-react";
import { AudioLevelMeter } from "./AudioLevelMeter";
import { RecordButton } from "./RecordButton";
import { TranscriptEditor } from "./TranscriptEditor";

interface InputPanelProps {
  text: string;
  audioLevel: number;
  isRecording: boolean;
  isBusy: boolean;
  selectionToken: number;
  onToggleRecording: () => void;
  onCancelTranscription: () => void;
  onTextChange: (text: string) => void;
  onCopy: () => void;
}

export function InputPanel({
  text,
  audioLevel,
  isRecording,
  isBusy,
  selectionToken,
  onToggleRecording,
  onCancelTranscription,
  onTextChange,
  onCopy
}: InputPanelProps): JSX.Element {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-glass backdrop-blur-xl">
      <div className="grid min-h-[520px] items-stretch gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RecordButton
              isRecording={isRecording}
              isBusy={isBusy}
              onToggle={onToggleRecording}
            />

            <div className="w-full max-w-[220px] rounded-lg border border-white/10 bg-black/20 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-300">
                  {isRecording ? "Live-уровень" : "Микрофон"}
                </span>
                <span
                  className={[
                    "h-2 w-2 rounded-full",
                    isRecording && audioLevel > 0.04
                      ? "bg-teal-200 shadow-[0_0_14px_rgba(94,234,212,0.7)]"
                      : "bg-white/20"
                  ].join(" ")}
                />
              </div>
              <AudioLevelMeter audioLevel={audioLevel} active={isRecording} />
            </div>

            {isBusy && !isRecording ? (
              <button
                type="button"
                onClick={onCancelTranscription}
                className="grid h-10 w-10 place-items-center rounded-lg border border-rose-200/30 bg-rose-400/[0.12] text-rose-50 transition hover:bg-rose-400/20"
                title="Остановить ML-задачу"
                aria-label="Остановить ML-задачу"
              >
                <Square className="h-4 w-4 fill-rose-100" />
              </button>
            ) : null}
          </div>
        </div>

        <TranscriptEditor
          text={text}
          disabled={isBusy || isRecording}
          selectionToken={selectionToken}
          placeholder={
            isRecording
              ? "Говорите - live-черновик появится здесь..."
              : undefined
          }
          modeLabel={isRecording ? "Live-черновик" : undefined}
          onChange={onTextChange}
          onCopy={onCopy}
        />
      </div>
    </section>
  );
}
