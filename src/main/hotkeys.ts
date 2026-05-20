import { BrowserWindow, globalShortcut } from "electron";
import type { HotkeyAccelerator } from "./settings";

let registeredAccelerator: HotkeyAccelerator | null = null;

export function registerGlobalHotkeys(
  window: BrowserWindow,
  accelerator: HotkeyAccelerator
): boolean {
  if (
    registeredAccelerator === accelerator &&
    globalShortcut.isRegistered(accelerator)
  ) {
    return true;
  }

  globalShortcut.unregisterAll();

  const registered = globalShortcut.register(accelerator, () => {
    if (!window.isDestroyed()) {
      window.webContents.send("hotkey-pressed");
    }
  });

  if (!registered) {
    registeredAccelerator = null;
    sendWarning(
      window,
      `Не удалось зарегистрировать ${formatHotkeyForUser(accelerator)}. Возможно, сочетание уже занято другой программой.`
    );
    return false;
  }

  registeredAccelerator = accelerator;
  return true;
}

export function unregisterGlobalHotkeys(): void {
  globalShortcut.unregisterAll();
  registeredAccelerator = null;
}

function sendWarning(window: BrowserWindow, message: string): void {
  if (window.isDestroyed()) {
    return;
  }

  if (window.webContents.isLoading()) {
    window.webContents.once("did-finish-load", () => {
      if (!window.isDestroyed()) {
        window.webContents.send("app-warning", message);
      }
    });
    return;
  }

  window.webContents.send("app-warning", message);
}

function formatHotkeyForUser(accelerator: HotkeyAccelerator): string {
  return accelerator
    .replace("CommandOrControl", "Ctrl")
    .replace("Right", "→")
    .split("+")
    .join(" + ");
}
