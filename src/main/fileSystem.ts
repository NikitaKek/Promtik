import { app } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const PROJECT_DIRS = {
  data: "data",
  temp: "temp"
} as const;

export function getProjectRoot(): string {
  if (app.isPackaged) {
    return path.dirname(process.execPath);
  }

  return process.cwd();
}

export function resolveProjectPath(...parts: string[]): string {
  return path.join(getProjectRoot(), ...parts);
}

export function resolveDataPath(fileName: string): string {
  return resolveProjectPath(PROJECT_DIRS.data, fileName);
}

export function resolveTempPath(fileName: string): string {
  return resolveProjectPath(PROJECT_DIRS.temp, fileName);
}

export async function ensureProjectStructure(): Promise<void> {
  await Promise.all([
    mkdir(resolveProjectPath(PROJECT_DIRS.data), { recursive: true }),
    mkdir(resolveProjectPath(PROJECT_DIRS.temp), { recursive: true })
  ]);

  const historyPath = resolveDataPath("history.json");
  if (!existsSync(historyPath)) {
    await writeFile(historyPath, "[]\n", "utf8");
  }

  const settingsPath = resolveDataPath("settings.json");
  if (!existsSync(settingsPath)) {
    await writeFile(
      settingsPath,
      JSON.stringify(
        {
          qualityPreset: "maximum",
          modelSize: "large-v3",
          language: "ru",
          deviceMode: "auto",
          autoCopy: true,
          aiFormat: false,
          vadSilenceMs: 1100,
          beamSize: 12,
          termHints: "ChatGPT, Claude, Codex, Cursor, OpenAI, Python, TypeScript, React, Electron, Whisper, faster-whisper, CUDA",
          hotkey: "CommandOrControl+Alt+Space"
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  }
}

export function safeTimestamp(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "-" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
}

export function sanitizeExtension(extension: string): string {
  const cleaned = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return cleaned || "webm";
}
