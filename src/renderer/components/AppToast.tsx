import { CheckCircle2 } from "lucide-react";

interface AppToastProps {
  message: string;
}

export function AppToast({ message }: AppToastProps): JSX.Element {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 max-w-[360px] rounded-lg border border-emerald-200/25 bg-[#0b0f14]/90 px-4 py-3 text-emerald-50 shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-200/20 bg-emerald-300/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-200" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Готово</p>
          <p className="mt-0.5 text-sm leading-5 text-slate-300">{message}</p>
        </div>
      </div>
    </div>
  );
}
