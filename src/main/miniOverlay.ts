import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { resolveProjectPath } from "./fileSystem";

type AppStatus =
  | "ready"
  | "recording"
  | "loading-model"
  | "transcribing"
  | "copied"
  | "error";

export interface MiniOverlayState {
  status: AppStatus;
  message?: string;
  audioLevel?: number;
  hotkeyLabel?: string;
}

let miniWindow: BrowserWindow | null = null;
let currentState: MiniOverlayState = {
  status: "ready",
  message: "Готово"
};
let hideTimer: NodeJS.Timeout | null = null;

const MINI_WIDTH = 336;
const MINI_HEIGHT = 116;
const MINI_MARGIN = 24;

export async function updateMiniOverlay(state: MiniOverlayState): Promise<void> {
  currentState = state;

  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  if (state.status === "ready") {
    hideMiniOverlay();
    return;
  }

  const overlayWindow = await ensureMiniWindow();
  positionMiniWindow(overlayWindow);
  overlayWindow.webContents.send("overlay-state", currentState);

  if (!overlayWindow.isVisible()) {
    overlayWindow.showInactive();
  }

  if (state.status === "copied") {
    hideTimer = setTimeout(hideMiniOverlay, 4600);
  }

  if (state.status === "error") {
    hideTimer = setTimeout(hideMiniOverlay, 4200);
  }
}

export function hideMiniOverlay(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.hide();
  }
}

export function getMiniOverlayState(): MiniOverlayState {
  return currentState;
}

export function destroyMiniOverlay(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.destroy();
  }

  miniWindow = null;
}

async function ensureMiniWindow(): Promise<BrowserWindow> {
  if (miniWindow && !miniWindow.isDestroyed()) {
    return miniWindow;
  }

  miniWindow = new BrowserWindow({
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    focusable: false,
    backgroundColor: "#00000000",
    title: "Promptik Recording",
    icon: resolveProjectPath("assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  miniWindow.setAlwaysOnTop(true, "floating");
  miniWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    await miniWindow.loadURL(`${rendererUrl}?view=mini`);
  } else {
    await miniWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"), {
      query: { view: "mini" }
    });
  }

  miniWindow.webContents.send("overlay-state", currentState);

  miniWindow.on("closed", () => {
    miniWindow = null;
  });

  return miniWindow;
}

function positionMiniWindow(overlayWindow: BrowserWindow): void {
  const { workArea } = screen.getPrimaryDisplay();
  overlayWindow.setBounds({
    x: Math.round(workArea.x + workArea.width - MINI_WIDTH - MINI_MARGIN),
    y: Math.round(workArea.y + workArea.height - MINI_HEIGHT - MINI_MARGIN),
    width: MINI_WIDTH,
    height: MINI_HEIGHT
  });
}
