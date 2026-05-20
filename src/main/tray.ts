import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import { resolveProjectPath } from "./fileSystem";

let tray: Tray | null = null;
let quitting = false;

export function createAppTray(window: BrowserWindow): void {
  if (tray) {
    return;
  }

  const icon = nativeImage.createFromPath(resolveProjectPath("assets", "icon.ico"));
  tray = new Tray(icon);
  tray.setToolTip("Promptik");
  tray.setContextMenu(createTrayMenu(window));

  tray.on("click", () => {
    showMainWindow(window);
  });

  tray.on("double-click", () => {
    showMainWindow(window);
  });
}

export function shouldHideToTray(): boolean {
  return !quitting;
}

export function markAppQuitting(): void {
  quitting = true;
}

export function destroyAppTray(): void {
  tray?.destroy();
  tray = null;
}

function createTrayMenu(window: BrowserWindow): Menu {
  return Menu.buildFromTemplate([
    {
      label: "Открыть Promptik",
      click: () => showMainWindow(window)
    },
    {
      label: "Выход",
      click: () => {
        markAppQuitting();
        app.quit();
      }
    }
  ]);
}

function showMainWindow(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}
