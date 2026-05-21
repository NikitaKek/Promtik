import { app, BrowserWindow, session } from "electron";
import path from "node:path";
import { ensureProjectStructure, resolveProjectPath } from "./fileSystem";
import { registerGlobalHotkeys, unregisterGlobalHotkeys } from "./hotkeys";
import { registerIpcHandlers } from "./ipc";
import { destroyMiniOverlay } from "./miniOverlay";
import { PythonBridge } from "./pythonBridge";
import { loadSettings } from "./settings";
import {
  createAppTray,
  destroyAppTray,
  markAppQuitting,
  shouldHideToTray
} from "./tray";
import { registerUpdateHandlers } from "./updates";

let mainWindow: BrowserWindow | null = null;
const pythonBridge = new PythonBridge();
const WINDOW_WIDTH = 1240;
const WINDOW_HEIGHT = 840;

async function createWindow(): Promise<void> {
  await ensureProjectStructure();

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    maxWidth: WINDOW_WIDTH,
    maxHeight: WINDOW_HEIGHT,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0f14",
    title: "Promptik",
    icon: resolveProjectPath("assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  registerIpcHandlers(mainWindow, pythonBridge);
  registerUpdateHandlers(mainWindow);
  createAppTray(mainWindow);

  mainWindow.on("close", (event) => {
    if (shouldHideToTray()) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    await mainWindow.loadURL(rendererUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }

  const settings = await loadSettings();
  registerGlobalHotkeys(mainWindow, settings.hotkey);
}

app.disableHardwareAcceleration();
app.setAppUserModelId("app.promptik.desktop");

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const requestedPermission = String(permission);
    callback(
      requestedPermission === "media" || requestedPermission === "microphone"
    );
  });

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !shouldHideToTray()) {
    app.quit();
  }
});

app.on("before-quit", () => {
  markAppQuitting();
});

app.on("will-quit", () => {
  unregisterGlobalHotkeys();
  destroyMiniOverlay();
  destroyAppTray();
  pythonBridge.dispose();
});
