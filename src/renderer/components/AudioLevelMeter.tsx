import { useEffect, useMemo, useRef, useState } from "react";

interface AudioLevelMeterProps {
  audioLevel: number;
  active: boolean;
  compact?: boolean;
  className?: string;
}

export function AudioLevelMeter({
  audioLevel,
  active,
  compact = false,
  className = ""
}: AudioLevelMeterProps): JSX.Element {
  const segmentCount = compact ? 24 : 32;
  const latestLevelRef = useRef(0);
  const emptyLevels = useMemo(
    () => Array.from({ length: segmentCount }, () => 0),
    [segmentCount]
  );
  const [levels, setLevels] = useState<number[]>(emptyLevels);

  useEffect(() => {
    latestLevelRef.current = active ? normalizeLevel(audioLevel) : 0;
  }, [active, audioLevel]);

  useEffect(() => {
    if (!active) {
      setLevels(emptyLevels);
      return undefined;
    }

    const pushLevel = (): void => {
      setLevels((current) => [
        ...current.slice(1),
        latestLevelRef.current
      ]);
    };

    pushLevel();
    const timer = window.setInterval(pushLevel, 95);
    return () => window.clearInterval(timer);
  }, [active, emptyLevels]);

  return (
    <div
      className={[
        "w-full",
        compact ? "max-w-[186px]" : "max-w-[220px]",
        className
      ].join(" ")}
      aria-label="Индикатор громкости микрофона"
    >
      <div
        className={[
          "grid items-end gap-1",
          compact ? "h-8" : "h-10"
        ].join(" ")}
        style={{
          gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))`
        }}
      >
        {levels.map((level, index) => {
          const isLit = active && level > 0.02;
          const maxHeight = compact ? 28 : 38;
          const minHeight = compact ? 4 : 5;
          const height = minHeight + level * (maxHeight - minHeight);

          return (
            <span
              key={index}
              className={[
                "rounded-full transition-all duration-100",
                isLit
                  ? "bg-gradient-to-t from-rose-300 via-teal-300 to-cyan-200 opacity-100 shadow-[0_0_14px_rgba(94,234,212,0.32)]"
                  : "bg-white/10 opacity-35"
              ].join(" ")}
              style={{
                height: `${Math.round(height)}px`
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function normalizeLevel(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped < 0.025 ? 0 : Math.pow(clamped, 0.72);
}
