import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  LoaderCircle,
  Mic,
  type LucideIcon
} from "lucide-react";
import iconUrl from "../../assets/icon.svg";
import type { OverlayState } from "./lib/types";

const INITIAL_STATE: OverlayState = {
  status: "recording",
  message: "Идет запись"
};

export default function MiniRecorder(): JSX.Element {
  const [state, setState] = useState<OverlayState>(INITIAL_STATE);

  useEffect(() => {
    document.documentElement.classList.add("mini-overlay-page");
    document.body.classList.add("mini-overlay-page");

    const unsubscribe = window.promptik.onOverlayState(setState);
    void window.promptik.getOverlayState().then(setState).catch(() => undefined);

    return () => {
      unsubscribe();
      document.documentElement.classList.remove("mini-overlay-page");
      document.body.classList.remove("mini-overlay-page");
    };
  }, []);

  const meta = useMemo(() => getOverlayMeta(state), [state]);
  const isRecording = state.status === "recording";
  const isWorking = state.status === "loading-model" || state.status === "transcribing";
  const bars = useMemo(
    () => createWaveBars(state.audioLevel ?? 0, isRecording),
    [isRecording, state.audioLevel]
  );

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden bg-transparent p-2 text-slate-100">
      <section className="w-full rounded-[28px] border border-white/[0.12] bg-[#0b0f14]/[0.88] p-3.5 shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06]">
            <img src={iconUrl} alt="" className="h-7 w-7" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <meta.Icon className={`h-4 w-4 shrink-0 ${meta.iconClass}`} />
              <p className="truncate text-sm font-semibold">{meta.title}</p>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {meta.subtitle}
            </p>
          </div>
        </div>

        <div className="mt-3 flex h-8 items-end justify-center gap-1.5">
          {bars.map((height, index) => (
            <span
              key={index}
              className={[
                "mini-wave-bar",
                isRecording ? "mini-wave-bar-live" : "",
                isWorking ? "mini-wave-bar-busy" : "",
                !isRecording && !isWorking ? "mini-wave-bar-idle" : ""
              ].join(" ")}
              style={{
                animationDelay: `${index * 54}ms`,
                height: isWorking ? undefined : `${height}px`,
                opacity: isRecording ? Math.max(0.35, Math.min(1, height / 26)) : undefined
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function getOverlayMeta(state: OverlayState): {
  title: string;
  subtitle: string;
  iconClass: string;
  Icon: LucideIcon;
} {
  switch (state.status) {
    case "recording":
      return {
        title: state.message ?? "Идет запись",
        subtitle: `${state.hotkeyLabel ?? "Ctrl + Alt + Space"} - остановить`,
        iconClass: "text-rose-200",
        Icon: Mic
      };
    case "loading-model":
      return {
        title: state.message ?? "Загрузка модели",
        subtitle: "Готовлю локальную ML-модель",
        iconClass: "animate-spin text-cyan-200",
        Icon: LoaderCircle
      };
    case "transcribing":
      return {
        title: state.message ?? "Транскрибация",
        subtitle: "Распознаю запись локально",
        iconClass: "animate-spin text-cyan-200",
        Icon: LoaderCircle
      };
    case "copied":
      return {
        title: state.message ?? "Текст скопирован",
        subtitle: "Можно вставлять в ИИ-чат",
        iconClass: "text-emerald-200",
        Icon: Check
      };
    case "error":
      return {
        title: state.message ?? "Ошибка",
        subtitle: "Откройте Promptik для деталей",
        iconClass: "text-red-200",
        Icon: AlertTriangle
      };
    case "ready":
    default:
      return {
        title: state.message ?? "Готово",
        subtitle: `${state.hotkeyLabel ?? "Ctrl + Alt + Space"} - начать`,
        iconClass: "text-teal-200",
        Icon: Mic
      };
  }
}

function createWaveBars(audioLevel: number, isRecording: boolean): number[] {
  const profile = [
    0.1, 0.28, 0.44, 0.22, 0.62, 0.86, 0.54, 0.34, 0.76,
    0.96, 0.68, 0.38, 0.82, 0.58, 0.24, 0.5, 0.3, 0.14
  ];

  if (!isRecording) {
    return profile.map((value) => 7 + value * 5);
  }

  const level = Math.max(0, Math.min(1, audioLevel));
  const lift = Math.pow(level, 0.72);

  return profile.map((value, index) => {
    const edgeFalloff = 1 - Math.abs(index - (profile.length - 1) / 2) / 16;
    const quietHeight = 5 + value * 4;
    const liveHeight = lift * (10 + value * 22 * edgeFalloff);
    return Math.round(Math.min(30, quietHeight + liveHeight));
  });
}
