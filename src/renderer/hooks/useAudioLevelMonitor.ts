import { useCallback, useRef, useState } from "react";
import { createRecordingOverlayState, notifyOverlay } from "../lib/overlay";
import type { AppSettings } from "../lib/types";

type AudioContextConstructor = typeof AudioContext;

export function useAudioLevelMonitor(
  getSettings: () => AppSettings
): {
  audioLevel: number;
  startAudioLevelMonitor: (stream: MediaStream) => void;
  stopAudioLevelMonitor: () => void;
} {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioLevelTimerRef = useRef<number | null>(null);
  const audioLevelRef = useRef(0);
  const audioLevelLastSentRef = useRef(0);

  const stopAudioLevelMonitor = useCallback(() => {
    if (audioLevelTimerRef.current !== null) {
      window.clearInterval(audioLevelTimerRef.current);
      audioLevelTimerRef.current = null;
    }

    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    audioLevelRef.current = 0;
    audioLevelLastSentRef.current = 0;
    setAudioLevel(0);
  }, []);

  const startAudioLevelMonitor = useCallback(
    (stream: MediaStream) => {
      stopAudioLevelMonitor();

      const AudioContextConstructor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: AudioContextConstructor })
          .webkitAudioContext;

      if (!AudioContextConstructor) {
        notifyOverlay(createRecordingOverlayState(getSettings(), 0));
        return;
      }

      try {
        const audioContext = new AudioContextConstructor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();

        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.65;
        const data = new Uint8Array(analyser.fftSize);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        audioSourceRef.current = source;
        void audioContext.resume().catch(() => undefined);

        const tick = (): void => {
          analyser.getByteTimeDomainData(data);

          let sum = 0;
          for (const sample of data) {
            const centered = (sample - 128) / 128;
            sum += centered * centered;
          }

          const rms = Math.sqrt(sum / data.length);
          const normalized = Math.max(0, Math.min(1, (rms - 0.015) * 8.5));
          const smoothed =
            normalized > audioLevelRef.current
              ? normalized
              : audioLevelRef.current * 0.72 + normalized * 0.28;
          const level = smoothed < 0.035 ? 0 : smoothed;
          audioLevelRef.current = level;

          const now = performance.now();
          if (now - audioLevelLastSentRef.current > 90) {
            audioLevelLastSentRef.current = now;
            setAudioLevel(Math.round(level * 100) / 100);
            notifyOverlay(createRecordingOverlayState(getSettings(), level));
          }
        };

        tick();
        audioLevelTimerRef.current = window.setInterval(tick, 80);
      } catch {
        notifyOverlay(createRecordingOverlayState(getSettings(), 0));
      }
    },
    [getSettings, stopAudioLevelMonitor]
  );

  return {
    audioLevel,
    startAudioLevelMonitor,
    stopAudioLevelMonitor
  };
}
