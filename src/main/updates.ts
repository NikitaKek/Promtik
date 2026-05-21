import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  message?: string;
  progress?: number;
  checkedAt?: string;
}

let updateWindow: BrowserWindow | null = null;
let eventsRegistered = false;
let state: UpdateState = {
  status: "idle",
  currentVersion: app.getVersion(),
  message: "Проверка обновлений еще не запускалась."
};

export function registerUpdateHandlers(window: BrowserWindow): void {
  updateWindow = window;
  configureAutoUpdater();

  ["updates:check", "updates:install", "updates:get-state"].forEach((channel) =>
    ipcMain.removeHandler(channel)
  );

  ipcMain.handle("updates:get-state", async () => state);
  ipcMain.handle("updates:check", async (_event, manual?: boolean) =>
    checkForUpdates(Boolean(manual))
  );
  ipcMain.handle("updates:install", async () => downloadOrInstallUpdate());
}

async function checkForUpdates(manual: boolean): Promise<UpdateState> {
  if (!app.isPackaged) {
    setState({
      status: "not-available",
      message: "Проверка обновлений работает только в установленной версии.",
      checkedAt: new Date().toISOString()
    });
    return state;
  }

  if (state.status === "checking" || state.status === "downloading") {
    return state;
  }

  setState({
    status: "checking",
    message: manual ? "Проверяем обновления..." : "Автопроверка обновлений..."
  });

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    setState({
      status: "error",
      message: getUpdateErrorMessage(error),
      checkedAt: new Date().toISOString()
    });
  }

  return state;
}

async function downloadOrInstallUpdate(): Promise<UpdateState> {
  if (!app.isPackaged) {
    setState({
      status: "not-available",
      message: "Обновление доступно только в установленной версии.",
      checkedAt: new Date().toISOString()
    });
    return state;
  }

  if (state.status === "downloaded") {
    autoUpdater.quitAndInstall(false, true);
    return state;
  }

  if (state.status !== "available") {
    return checkForUpdates(true);
  }

  setState({
    status: "downloading",
    message: "Скачиваем обновление...",
    progress: 0
  });

  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    setState({
      status: "error",
      message: getUpdateErrorMessage(error),
      checkedAt: new Date().toISOString()
    });
  }

  return state;
}

function configureAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  if (eventsRegistered) {
    return;
  }

  eventsRegistered = true;

  autoUpdater.on("checking-for-update", () => {
    setState({
      status: "checking",
      message: "Проверяем обновления..."
    });
  });

  autoUpdater.on("update-available", (info) => {
    setState({
      status: "available",
      availableVersion: info.version,
      message: `Доступна версия ${info.version}.`,
      progress: undefined,
      checkedAt: new Date().toISOString()
    });
  });

  autoUpdater.on("update-not-available", () => {
    setState({
      status: "not-available",
      availableVersion: undefined,
      message: "Установлена последняя версия.",
      progress: undefined,
      checkedAt: new Date().toISOString()
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    setState({
      status: "downloading",
      message: `Скачиваем обновление: ${Math.round(progress.percent)}%.`,
      progress: progress.percent
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setState({
      status: "downloaded",
      availableVersion: info.version,
      message: `Версия ${info.version} готова к установке.`,
      progress: 100,
      checkedAt: new Date().toISOString()
    });
  });

  autoUpdater.on("error", (error) => {
    setState({
      status: "error",
      message: getUpdateErrorMessage(error),
      checkedAt: new Date().toISOString()
    });
  });
}

function setState(nextState: Partial<UpdateState>): void {
  state = {
    ...state,
    currentVersion: app.getVersion(),
    ...nextState
  };

  updateWindow?.webContents.send("updates:state", state);
}

function getUpdateErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `Не удалось проверить обновления: ${error.message}`;
  }

  return "Не удалось проверить обновления.";
}
