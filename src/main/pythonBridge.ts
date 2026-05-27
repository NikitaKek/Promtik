import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { app } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { getProjectRoot, resolveProjectPath } from "./fileSystem";
import type { LanguageCode, ModelSize, TranscriptSegment } from "./settings";
import type { DeviceMode } from "./settings";

interface PendingCommand<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timeout?: NodeJS.Timeout;
}

export interface TranscriptionResponse {
  ok: boolean;
  text?: string;
  language?: string;
  segments?: TranscriptSegment[];
  error?: string;
}

export interface ModelCacheResponse {
  ok: boolean;
  cache_dir?: string;
  models?: Partial<Record<ModelSize, boolean>>;
  error?: string;
}

export interface GpuStatusResponse {
  ok: boolean;
  cuda_available?: boolean;
  cuda_device_count?: number;
  cuda_dll_dirs?: string[];
  error?: string;
}

export interface WarmupResponse {
  ok: boolean;
  model_size?: ModelSize;
  device?: DeviceMode;
  compute_type?: string;
  error?: string;
}

type PythonCommand =
  | {
      action: "transcribe";
      file_path: string;
      model_size: ModelSize;
      language: LanguageCode;
      device: DeviceMode;
      vad_silence_ms: number;
      beam_size: number;
      hotwords: string;
      prompt_mode?: "default" | "none" | "live";
    }
  | {
      action: "model_status";
      model_sizes: ModelSize[];
    }
  | {
      action: "warmup";
      model_size: ModelSize;
      device: DeviceMode;
    }
  | {
      action: "gpu_status";
    };

export class PythonBridge {
  private process?: ChildProcessWithoutNullStreams;
  private pending?: PendingCommand<unknown>;
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private queue: Promise<unknown> = Promise.resolve();

  transcribe(
    filePath: string,
    modelSize: ModelSize,
    language: LanguageCode,
    deviceMode: DeviceMode,
    vadSilenceMs: number,
    beamSize: number,
    termHints: string,
    promptMode: "default" | "none" | "live" = "default"
  ): Promise<TranscriptionResponse> {
    return this.sendCommand<TranscriptionResponse>({
      action: "transcribe",
      file_path: filePath,
      model_size: modelSize,
      language,
      device: deviceMode,
      vad_silence_ms: vadSilenceMs,
      beam_size: beamSize,
      hotwords: termHints,
      prompt_mode: promptMode
    });
  }

  getModelCacheStatus(modelSizes: ModelSize[]): Promise<ModelCacheResponse> {
    return this.sendCommand<ModelCacheResponse>({
      action: "model_status",
      model_sizes: modelSizes
    });
  }

  getGpuStatus(): Promise<GpuStatusResponse> {
    return this.sendCommand<GpuStatusResponse>({
      action: "gpu_status"
    });
  }

  warmupModel(
    modelSize: ModelSize,
    deviceMode: DeviceMode
  ): Promise<WarmupResponse> {
    return this.sendCommand<WarmupResponse>({
      action: "warmup",
      model_size: modelSize,
      device: deviceMode
    });
  }

  cancelPending(reason = "Транскрибация остановлена пользователем."): void {
    const pending = this.pending;
    this.pending = undefined;

    if (pending?.timeout) {
      clearTimeout(pending.timeout);
    }

    if (this.process && !this.process.killed) {
      this.process.kill();
    }

    this.process = undefined;
    pending?.reject(new Error(reason));
  }

  dispose(): void {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.process = undefined;
  }

  private sendCommand<T>(command: PythonCommand): Promise<T> {
    const run = (): Promise<T> => this.runCommand<T>(command);
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private runCommand<T>(command: PythonCommand): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        this.ensureProcess();
      } catch (error) {
        reject(toFriendlyError(error, this.stderrBuffer));
        return;
      }

      if (!this.process) {
        reject(new Error("Python-процесс не запущен."));
        return;
      }

      if (this.pending) {
        reject(new Error("Python backend уже выполняет команду."));
        return;
      }

      const timeout = setTimeout(() => {
        this.cancelPending(
          command.action === "transcribe"
            ? "Транскрибация заняла слишком много времени и была остановлена. Попробуйте пресет Быстро, GPU-режим или более короткий файл."
            : "Операция Python заняла слишком много времени и была остановлена."
        );
      }, getCommandTimeoutMs(command));

      this.pending = {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout
      };
      this.stderrBuffer = "";

      try {
        this.process.stdin.write(JSON.stringify(command) + "\n", "utf8");
      } catch (error) {
        if (this.pending?.timeout) {
          clearTimeout(this.pending.timeout);
        }
        this.pending = undefined;
        reject(toFriendlyError(error, this.stderrBuffer));
      }
    });
  }

  private ensureProcess(): void {
    if (this.process && !this.process.killed) {
      return;
    }

    const executable = resolvePythonExecutable();
    const scriptPath = resolveProjectPath("python", "transcriber.py");

    this.stdoutBuffer = "";
    this.stderrBuffer = "";

    this.process = spawn(executable, [scriptPath], {
      cwd: getProjectRoot(),
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUTF8: "1"
      }
    });

    this.process.stdout.setEncoding("utf8");
    this.process.stderr.setEncoding("utf8");

    this.process.stdout.on("data", (chunk: string) => {
      this.stdoutBuffer += chunk;
      this.flushStdoutLines();
    });

    this.process.stderr.on("data", (chunk: string) => {
      this.stderrBuffer += chunk;
    });

    this.process.on("error", (error) => {
      const pending = this.pending;
      this.pending = undefined;
      this.process = undefined;
      if (pending?.timeout) {
        clearTimeout(pending.timeout);
      }
      pending?.reject(toFriendlyError(error, this.stderrBuffer));
    });

    this.process.on("close", (code) => {
      const pending = this.pending;
      this.pending = undefined;
      this.process = undefined;
      if (pending?.timeout) {
        clearTimeout(pending.timeout);
      }

      if (pending) {
        pending.reject(
          new Error(
            [
              `Python backend завершился до ответа (код ${code ?? "unknown"}).`,
              makeStderrHint(this.stderrBuffer)
            ]
              .filter(Boolean)
              .join(" ")
          )
        );
      }
    });
  }

  private flushStdoutLines(): void {
    let nextLineIndex = this.stdoutBuffer.indexOf("\n");

    while (nextLineIndex >= 0) {
      const line = this.stdoutBuffer.slice(0, nextLineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(nextLineIndex + 1);

      if (line.length > 0) {
        this.handleStdoutLine(line);
      }

      nextLineIndex = this.stdoutBuffer.indexOf("\n");
    }
  }

  private handleStdoutLine(line: string): void {
    const pending = this.pending;

    if (!pending) {
      return;
    }

    try {
      const parsed = JSON.parse(line) as unknown;
      this.pending = undefined;
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.resolve(parsed);
    } catch {
      this.pending = undefined;
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(
        new Error(
          [
            "Python backend вернул некорректный JSON.",
            "Проверьте, что transcriber.py пишет служебные логи только в stderr.",
            makeStderrHint(this.stderrBuffer)
          ]
            .filter(Boolean)
            .join(" ")
        )
      );
    }
  }
}

function getCommandTimeoutMs(command: PythonCommand): number {
  if (command.action === "transcribe") {
    return 30 * 60 * 1000;
  }

  if (command.action === "model_status") {
    return 15 * 1000;
  }

  if (command.action === "warmup") {
    return 10 * 60 * 1000;
  }

  return 60 * 1000;
}

function resolvePythonExecutable(): string {
  const root = getProjectRoot();
  const venvPython =
    process.platform === "win32"
      ? path.join(root, "python", ".venv", "Scripts", "python.exe")
      : path.join(root, "python", ".venv", "bin", "python");

  if (existsSync(venvPython)) {
    return venvPython;
  }

  if (app.isPackaged) {
    throw new Error(
      "ML backend не установлен. Закройте Promptik и запустите install-ml.bat в папке установки приложения. Он создаст python\\.venv и установит faster-whisper."
    );
  }

  return process.platform === "win32" ? "python" : "python3";
}

function toFriendlyError(error: unknown, stderr: string): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("ENOENT")) {
    return new Error(
      "Python не найден. Установите Python 3.11+, затем создайте окружение в python/.venv и установите зависимости из python/requirements.txt."
    );
  }

  return new Error([message, makeStderrHint(stderr)].filter(Boolean).join(" "));
}

function makeStderrHint(stderr: string): string {
  const clean = stderr.trim();
  if (!clean) {
    return "";
  }

  return `Детали Python: ${clean.slice(-1200)}`;
}
