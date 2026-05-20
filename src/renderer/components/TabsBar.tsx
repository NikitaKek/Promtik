import { Clock3, Mic2, SlidersHorizontal } from "lucide-react";

export type MainTab = "input" | "history" | "settings";

interface TabsBarProps {
  activeTab: MainTab;
  historyCount: number;
  onChange: (tab: MainTab) => void;
}

const tabs: Array<{
  id: MainTab;
  label: string;
  icon: JSX.Element;
}> = [
  { id: "input", label: "Ввод", icon: <Mic2 className="h-4 w-4" /> },
  { id: "history", label: "История", icon: <Clock3 className="h-4 w-4" /> },
  {
    id: "settings",
    label: "Настройки",
    icon: <SlidersHorizontal className="h-4 w-4" />
  }
];

export function TabsBar({
  activeTab,
  historyCount,
  onChange
}: TabsBarProps): JSX.Element {
  return (
    <nav className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.045] p-1 shadow-glass backdrop-blur-xl">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              "inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium transition",
              isActive
                ? "bg-white/[0.11] text-white shadow-sm"
                : "text-slate-400 hover:bg-white/[0.065] hover:text-slate-100"
            ].join(" ")}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.id === "history" && historyCount > 0 ? (
              <span className="rounded-full bg-teal-300/15 px-2 py-0.5 text-[11px] text-teal-100">
                {historyCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
