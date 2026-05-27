import { useCallback, useRef } from "react";
import { calculateRms, encodeWav, mergeFloat32Chunks } from "../lib/wav";
import type { AppSettings } from "../lib/types";

type AudioContextConstructor = typeof AudioContext;

interface AudioSlice {
  startSample: number;
  samples: Float32Array;
}

const MIN_CHUNK_MS = 1000;
const MAX_CHUNK_MS = 5000;
const MIN_WINDOW_MS = 3000;
const MAX_WINDOW_MS = 8000;
const MIN_CHUNK_SECONDS = 0.65;
const MIN_RMS = 0.016;
const FRAME_MS = 30;
const MIN_VOICED_MS = 150;
const MIN_PEAK_FRAME_RMS = 0.02;

export function useLiveTranscription(
  getSettings: () => AppSettings,
  onDraft: (text: string) => void
): {
  startLiveTranscription: (stream: MediaStream) => void;
  stopLiveTranscription: () => void;
} {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const rollingSlicesRef = useRef<AudioSlice[]>([]);
  const liveTextRef = useRef("");
  const sampleRateRef = useRef(48000);
  const recordedSamplesRef = useRef(0);
  const sessionRef = useRef(0);
  const activeRef = useRef(false);
  const transcribingRef = useRef(false);

  const stopLiveTranscription = useCallback(() => {
    activeRef.current = false;
    sessionRef.current += 1;

    if (flushTimerRef.current !== null) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    rollingSlicesRef.current = [];
    liveTextRef.current = "";
    recordedSamplesRef.current = 0;

    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    muteGainRef.current?.disconnect();
    muteGainRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const flushLiveWindow = useCallback(
    async (sessionId: number) => {
      if (!activeRef.current || sessionId !== sessionRef.current) {
        return;
      }

      if (transcribingRef.current) {
        return;
      }

      const activeSettings = getSettings();
      const sampleRate = sampleRateRef.current;
      const chunkMs = normalizeLiveChunkMs(activeSettings.liveChunkMs);
      const windowMs = normalizeLiveWindowMs(
        activeSettings.liveWindowMs,
        chunkMs
      );
      const windowEndSample = recordedSamplesRef.current;
      const windowStartSample = Math.max(
        0,
        windowEndSample - millisecondsToSamples(windowMs, sampleRate)
      );
      const samples = collectWindowSamples(
        rollingSlicesRef.current,
        windowStartSample,
        windowEndSample
      );

      if (samples.length < sampleRate * MIN_CHUNK_SECONDS) {
        return;
      }

      if (!hasSpeechActivity(samples, sampleRate)) {
        return;
      }

      transcribingRef.current = true;
      try {
        const saved = await window.promptik.saveRecording(
          encodeWav(samples, sampleRate),
          "wav"
        );

        if (
          !saved.ok ||
          !saved.filePath ||
          !activeRef.current ||
          sessionId !== sessionRef.current
        ) {
          return;
        }

        const result = await window.promptik.transcribeFile(saved.filePath, {
          modelSize: activeSettings.modelSize,
          language: activeSettings.language,
          deviceMode: activeSettings.deviceMode,
          vadSilenceMs: Math.min(activeSettings.vadSilenceMs, 850),
          beamSize: getLiveBeamSize(activeSettings),
          termHints: activeSettings.termHints,
          promptMode: "live"
        });

        const draftText = (result.text ?? "").trim();
        if (
          !result.ok ||
          draftText.length === 0 ||
          shouldRejectLiveDraft(draftText) ||
          !activeRef.current ||
          sessionId !== sessionRef.current
        ) {
          return;
        }

        liveTextRef.current = mergeRollingTranscript(
          liveTextRef.current,
          draftText
        );
        onDraft(liveTextRef.current);
      } catch {
        // Live transcription is only a draft. Final transcription remains authoritative.
      } finally {
        transcribingRef.current = false;
      }
    },
    [getSettings, onDraft]
  );

  const startLiveTranscription = useCallback(
    (stream: MediaStream) => {
      stopLiveTranscription();

      const AudioContextConstructor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: AudioContextConstructor })
          .webkitAudioContext;

      if (!AudioContextConstructor) {
        return;
      }

      try {
        const audioContext = new AudioContextConstructor();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const muteGain = audioContext.createGain();
        const sessionId = sessionRef.current + 1;
        const settings = getSettings();
        const chunkMs = normalizeLiveChunkMs(settings.liveChunkMs);
        const windowMs = normalizeLiveWindowMs(settings.liveWindowMs, chunkMs);

        sessionRef.current = sessionId;
        activeRef.current = true;
        sampleRateRef.current = audioContext.sampleRate;
        rollingSlicesRef.current = [];
        liveTextRef.current = "";
        recordedSamplesRef.current = 0;
        muteGain.gain.value = 0;

        processor.onaudioprocess = (event) => {
          if (!activeRef.current || sessionId !== sessionRef.current) {
            return;
          }

          const input = event.inputBuffer.getChannelData(0);
          const samples = new Float32Array(input);
          const startSample = recordedSamplesRef.current;
          recordedSamplesRef.current += samples.length;
          rollingSlicesRef.current.push({ startSample, samples });

          pruneAudioSlices(
            rollingSlicesRef.current,
            recordedSamplesRef.current -
              millisecondsToSamples(windowMs + 1000, audioContext.sampleRate)
          );
        };

        source.connect(processor);
        processor.connect(muteGain);
        muteGain.connect(audioContext.destination);

        audioContextRef.current = audioContext;
        sourceRef.current = source;
        processorRef.current = processor;
        muteGainRef.current = muteGain;
        void audioContext.resume().catch(() => undefined);

        flushTimerRef.current = window.setInterval(() => {
          void flushLiveWindow(sessionId);
        }, chunkMs);
      } catch {
        stopLiveTranscription();
      }
    },
    [flushLiveWindow, getSettings, stopLiveTranscription]
  );

  return {
    startLiveTranscription,
    stopLiveTranscription
  };
}

function collectWindowSamples(
  slices: AudioSlice[],
  startSample: number,
  endSample: number
): Float32Array {
  const chunks: Float32Array[] = [];

  for (const slice of slices) {
    const sliceStart = slice.startSample;
    const sliceEnd = slice.startSample + slice.samples.length;
    if (sliceEnd <= startSample || sliceStart >= endSample) {
      continue;
    }

    const from = Math.max(0, startSample - sliceStart);
    const to = Math.min(slice.samples.length, endSample - sliceStart);
    chunks.push(slice.samples.subarray(from, to));
  }

  return mergeFloat32Chunks(chunks);
}

function pruneAudioSlices(slices: AudioSlice[], minStartSample: number): void {
  while (
    slices.length > 0 &&
    slices[0].startSample + slices[0].samples.length < minStartSample
  ) {
    slices.shift();
  }
}

function hasSpeechActivity(samples: Float32Array, sampleRate: number): boolean {
  if (calculateRms(samples) < MIN_RMS) {
    return false;
  }

  const frameSize = Math.max(1, Math.round(sampleRate * (FRAME_MS / 1000)));
  const frameRmsValues: number[] = [];

  for (let offset = 0; offset + frameSize <= samples.length; offset += frameSize) {
    frameRmsValues.push(calculateRms(samples.subarray(offset, offset + frameSize)));
  }

  if (frameRmsValues.length === 0) {
    return false;
  }

  const sorted = [...frameRmsValues].sort((left, right) => left - right);
  const noiseSampleCount = Math.max(1, Math.floor(sorted.length * 0.3));
  const noiseFloor =
    sorted.slice(0, noiseSampleCount).reduce((sum, value) => sum + value, 0) /
    noiseSampleCount;
  const voiceThreshold = Math.max(MIN_RMS, noiseFloor * 3.2);
  const voicedFrames = frameRmsValues.filter((value) => value >= voiceThreshold);
  const voicedMs = voicedFrames.length * FRAME_MS;
  const peakFrameRms = Math.max(...frameRmsValues);

  return voicedMs >= MIN_VOICED_MS && peakFrameRms >= MIN_PEAK_FRAME_RMS;
}

function shouldRejectLiveDraft(text: string): boolean {
  const normalized = normalizeDraftText(text);
  const blockedPhrases = [
    "точная дословная транскрибация",
    "важные термины",
    "распознавай только реально произнесенные слова",
    "не добавляй субтитры",
    "транскрибируй только",
    "transcribe only the words actually spoken",
    "do not add subtitles",
    "accurate verbatim transcription",
    "продолжение следует",
    "спасибо за просмотр",
    "субтитры сделал",
    "субтитры создал",
    "субтитры создавал",
    "редактор субтитров",
    "корректор субтитров",
    "подписывайтесь на канал",
    "ставьте лайки",
    "до новых встреч",
    "thanks for watching",
    "subtitles by",
    "to be continued"
  ];

  return blockedPhrases.some((phrase) => normalized.includes(phrase));
}

function normalizeDraftText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?…:;'"«»()[\]{}_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLiveBeamSize(settings: AppSettings): number {
  if (settings.qualityPreset === "fast") {
    return 3;
  }

  return Math.min(5, Math.max(3, settings.beamSize));
}

function normalizeLiveChunkMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 3000;
  }

  return Math.min(
    MAX_CHUNK_MS,
    Math.max(MIN_CHUNK_MS, Math.round(value / 500) * 500)
  );
}

function normalizeLiveWindowMs(value: number, chunkMs: number): number {
  if (!Number.isFinite(value)) {
    return Math.max(MIN_WINDOW_MS, chunkMs);
  }

  return Math.min(
    MAX_WINDOW_MS,
    Math.max(MIN_WINDOW_MS, chunkMs, Math.round(value / 500) * 500)
  );
}

function millisecondsToSamples(milliseconds: number, sampleRate: number): number {
  return Math.max(1, Math.round(sampleRate * (milliseconds / 1000)));
}

function mergeRollingTranscript(currentText: string, nextText: string): string {
  const current = currentText.trim();
  const next = nextText.trim();

  if (!current) {
    return next;
  }

  if (!next) {
    return current;
  }

  const currentNormalized = normalizeComparableText(current);
  const nextNormalized = normalizeComparableText(next);

  if (currentNormalized.includes(nextNormalized)) {
    return current;
  }

  if (nextNormalized.includes(currentNormalized)) {
    return dedupeAdjacentRepeatedPhrases(next);
  }

  const currentWords = current.split(/\s+/);
  const nextWords = next.split(/\s+/);
  const currentComparableWords = currentWords.map(normalizeComparableText);
  const nextComparableWords = nextWords.map(normalizeComparableText);
  const maxOverlap = Math.min(28, currentWords.length, nextWords.length);

  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    const currentTail = currentComparableWords.slice(-overlap).join(" ");
    const nextHead = nextComparableWords.slice(0, overlap).join(" ");

    if (currentTail && currentTail === nextHead) {
      return dedupeAdjacentRepeatedPhrases(
        `${current} ${nextWords.slice(overlap).join(" ")}`.trim()
      );
    }
  }

  const anchorMerge = mergeByInternalAnchor(
    currentWords,
    nextWords,
    currentComparableWords,
    nextComparableWords
  );

  if (anchorMerge) {
    return dedupeAdjacentRepeatedPhrases(anchorMerge);
  }

  return dedupeAdjacentRepeatedPhrases(`${current} ${next}`.trim());
}

function normalizeComparableText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?…:;'"«»()[\]{}_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeByInternalAnchor(
  currentWords: string[],
  nextWords: string[],
  currentComparableWords: string[],
  nextComparableWords: string[]
): string | null {
  const maxAnchorLength = Math.min(10, currentWords.length, nextWords.length);
  const minAnchorLength = 3;

  for (let length = maxAnchorLength; length >= minAnchorLength; length -= 1) {
    const nextAnchor = nextComparableWords.slice(0, length).join(" ");
    if (!nextAnchor) {
      continue;
    }

    for (
      let currentIndex = Math.max(0, currentWords.length - 40);
      currentIndex <= currentWords.length - length;
      currentIndex += 1
    ) {
      const currentAnchor = currentComparableWords
        .slice(currentIndex, currentIndex + length)
        .join(" ");

      if (currentAnchor === nextAnchor) {
        return [
          ...currentWords.slice(0, currentIndex),
          ...nextWords
        ].join(" ");
      }
    }
  }

  return null;
}

function dedupeAdjacentRepeatedPhrases(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return text.trim();
  }

  let changed = true;
  while (changed) {
    changed = false;
    const normalizedWords = words.map(normalizeComparableText);
    const maxLength = Math.min(14, Math.floor(words.length / 2));

    phraseLoop:
    for (let length = maxLength; length >= 2; length -= 1) {
      for (let index = 0; index + length * 2 <= words.length; index += 1) {
        const first = normalizedWords.slice(index, index + length).join(" ");
        const second = normalizedWords
          .slice(index + length, index + length * 2)
          .join(" ");

        if (first && first === second) {
          words.splice(index + length, length);
          changed = true;
          break phraseLoop;
        }
      }
    }
  }

  return words.join(" ").trim();
}
