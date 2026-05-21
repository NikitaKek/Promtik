# Promptik

Promptik is a minimalist Windows desktop app that turns speech into ready-to-paste text for AI chats. Press a hotkey, speak, stop recording, and Promptik transcribes the audio locally, copies the result to the clipboard, and keeps a short history.

Audio is processed on your machine. Promptik does not send microphone recordings or transcriptions to external servers.

## Features

- Global recording hotkey, default: `Ctrl + Alt + Space`.
- Local speech recognition with Python and `faster-whisper`.
- Russian-first interface with Russian and English recognition modes.
- Automatic clipboard copy after transcription.
- Optional AI prompt format for copied text.
- History of the last 50 transcriptions.
- Quality presets for `large-v3-turbo` and `large-v3`.
- CUDA GPU mode with CPU fallback.
- Windows tray mode and compact recording overlay.
- GitHub Releases auto-update support.

## Install

1. Download `Promptik-Setup-<version>.exe` from GitHub Releases.
2. Install Promptik.
3. Open the installation folder and run:

```bat
install-ml.bat
```

`install-ml.bat` creates `python\.venv` and installs the local ML dependencies. Release builds include a `python\wheelhouse` folder, so the ML setup can install dependencies locally instead of downloading them from PyPI.

After that, start Promptik and use `Ctrl + Alt + Space` to record.

## Dependencies

Runtime:

- Windows 10/11 x64.
- Python 3.11 or newer.
- NVIDIA GPU is recommended for the best experience.
- CPU mode is supported, but large Whisper models can be slow.

Bundled or installed by the project:

- Electron, React, TypeScript, Vite, Tailwind CSS.
- Python `faster-whisper`, `numpy`, `soundfile`.
- NVIDIA CUDA runtime wheels for Windows: `nvidia-cublas-cu12`, `nvidia-cudnn-cu12`, `nvidia-cuda-runtime-cu12`.

Optional:

- `ffmpeg` in `PATH` for broader audio/video file support.

## Development

Install JavaScript dependencies:

```powershell
npm install
```

Create Python environment:

```powershell
cd python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

Run the app:

```powershell
npm run dev
```

Checks:

```powershell
npm run typecheck
npm run build
python\.venv\Scripts\python.exe -m py_compile python\transcriber.py
```

## Release

Local Windows installer:

```powershell
npm run prepare:wheelhouse
npm run dist:win
```

GitHub release flow:

```powershell
npm version patch
git push
git push origin v<version>
```

The `Release` GitHub Actions workflow builds the Windows installer, uploads the `.exe`, `.blockmap`, and `latest.yml`, and publishes them to GitHub Releases. `latest.yml` and `.blockmap` are required by `electron-updater`.

## Notes For Users

- Run `install-ml.bat` once after installing Promptik.
- The first transcription can take longer while the Whisper model is loaded or downloaded.
- For best accuracy, use the `large-v3` model and Russian language mode when speaking Russian.
- If Windows SmartScreen appears, it is expected for unsigned early open-source builds.

## License

MIT
