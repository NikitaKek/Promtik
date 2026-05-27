import { hotkeyLabel } from "./formatting";
import type { AppSettings, OverlayState } from "./types";

export function createRecordingOverlayState(
  settings: AppSettings,
  audioLevel: number
): OverlayState {
  return {
    status: "recording",
    message: "Идет запись",
    audioLevel,
    hotkeyLabel: hotkeyLabel(settings.hotkey)
  };
}

export function notifyOverlay(state: OverlayState): void {
  void window.promptik.updateOverlay(state).catch(() => undefined);
}
