import { BrowserWindow, clipboard, ipcMain } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveTempPath, safeTimestamp, sanitizeExtension } from "./fileSystem";
import { registerGlobalHotkeys } from "./hotkeys";
import {
  getMiniOverlayState,
  updateMiniOverlay,
  type MiniOverlayState
} from "./miniOverlay";
import type { PythonBridge } from "./pythonBridge";
import {
  loadHistory,
  loadSettings,
  saveHistory,
  saveSettings,
  type AppSettings,
  type DeviceMode,
  type HistoryItem,
  type LanguageCode,
  type ModelSize
} from "./settings";

interface SaveRecordingPayload {
  buffer: ArrayBuffer;
  extension: string;
}

interface TranscribePayload {
  filePath: string;
  modelSize: ModelSize;
  language: LanguageCode;
  deviceMode: DeviceMode;
  vadSilenceMs: number;
  beamSize: number;
  termHints: string;
  promptMode?: "default" | "none" | "live";
}

type OverlayPayload = MiniOverlayState;

export function registerIpcHandlers(
  window: BrowserWindow,
  bridge: PythonBridge
): void {
  [
    "recording:start",
    "recording:stop",
    "recording:save",
    "transcribe:file",
    "clipboard:copy",
    "settings:load",
    "settings:save",
    "history:load",
    "history:save",
    "window:is-background",
    "window:minimize",
    "window:close",
    "ml:cancel",
    "ml:warmup",
    "overlay:get-state",
    "overlay:update",
    "models:cache-status",
    "gpu:status"
  ].forEach((channel) => ipcMain.removeHandler(channel));

  ipcMain.handle("window:minimize", async () => {
    window.minimize();
    return { ok: true };
  });

  ipcMain.handle("window:close", async () => {
    window.close();
    return { ok: true };
  });

  ipcMain.handle("window:is-background", async () => ({
    ok: true,
    isBackground: !window.isVisible() || window.isMinimized()
  }));

  ipcMain.handle("ml:cancel", async () => {
    bridge.cancelPending();
    return { ok: true };
  });

  ipcMain.handle(
    "ml:warmup",
    async (
      _event,
      payload: Pick<TranscribePayload, "modelSize" | "deviceMode">
    ) => {
      try {
        return await bridge.warmupModel(payload.modelSize, payload.deviceMode);
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось прогреть локальную ML-модель."
        };
      }
    }
  );

  ipcMain.handle("models:cache-status", async () => {
    try {
      return await bridge.getModelCacheStatus([
        "large-v3-turbo",
        "large-v3"
      ]);
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось проверить статус локальных моделей."
      };
    }
  });

  ipcMain.handle("gpu:status", async () => {
    try {
      return await bridge.getGpuStatus();
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось проверить CUDA GPU."
      };
    }
  });

  ipcMain.handle("recording:start", async () => {
    await updateMiniOverlay({
      status: "recording",
      message: "Идет запись"
    });
    return { ok: true };
  });

  ipcMain.handle("recording:stop", async () => {
    await updateMiniOverlay({
      status: "transcribing",
      message: "Запись завершена"
    });
    return { ok: true };
  });

  ipcMain.handle("overlay:update", async (_event, payload: OverlayPayload) => {
    await updateMiniOverlay(payload);
    return { ok: true };
  });

  ipcMain.handle("overlay:get-state", async () => getMiniOverlayState());

  ipcMain.handle(
    "recording:save",
    async (_event, payload: SaveRecordingPayload) => {
      const extension = sanitizeExtension(payload.extension);
      const filePath = resolveTempPath(`recording-${safeTimestamp()}.${extension}`);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, Buffer.from(new Uint8Array(payload.buffer)));
      return { ok: true, filePath };
    }
  );

  ipcMain.handle(
    "transcribe:file",
    async (_event, payload: TranscribePayload) => {
      try {
        return await bridge.transcribe(
          payload.filePath,
          payload.modelSize,
          payload.language,
          payload.deviceMode,
          payload.vadSilenceMs,
          payload.beamSize,
          payload.termHints,
          payload.promptMode ?? "default"
        );
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось запустить локальную транскрибацию."
        };
      }
    }
  );

  ipcMain.handle("clipboard:copy", async (_event, text: string) => {
    const textToCopy = text.trim();

    if (textToCopy.length === 0) {
      return { ok: false, error: "Нечего копировать: текст пустой." };
    }

    clipboard.writeText(textToCopy);
    const copiedText = clipboard.readText();

    if (copiedText !== textToCopy) {
      clipboard.writeText(textToCopy);
    }

    return {
      ok: clipboard.readText() === textToCopy,
      error:
        clipboard.readText() === textToCopy
          ? undefined
          : "Windows не подтвердил запись текста в буфер обмена."
    };
  });

  ipcMain.handle("settings:load", async () => loadSettings());
  ipcMain.handle("settings:save", async (_event, settings: AppSettings) => {
    const savedSettings = await saveSettings(settings);
    registerGlobalHotkeys(window, savedSettings.hotkey);
    return savedSettings;
  });

  ipcMain.handle("history:load", async () => loadHistory());
  ipcMain.handle("history:save", async (_event, history: HistoryItem[]) =>
    saveHistory(history)
  );
}
