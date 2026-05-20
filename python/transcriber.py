from __future__ import annotations

import json
import logging
import os
import site
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


try:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except AttributeError:
    pass


logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(asctime)s %(levelname)s %(message)s",
)


MODEL_SIZES = {"tiny", "base", "small", "medium", "large-v3-turbo", "large-v3"}
LANGUAGES = {"auto", "ru", "en"}
DEVICES = {"auto", "cpu", "cuda"}
MODEL_REPO_IDS = {
    "tiny": "Systran/faster-whisper-tiny",
    "base": "Systran/faster-whisper-base",
    "small": "Systran/faster-whisper-small",
    "medium": "Systran/faster-whisper-medium",
    "large-v3-turbo": "mobiuslabsgmbh/faster-whisper-large-v3-turbo",
    "large-v3": "Systran/faster-whisper-large-v3",
}
ModelKey = Tuple[str, str, str]
MODEL_CACHE: Dict[ModelKey, Any] = {}
CUDA_FALLBACK_MARKERS = (
    "cublas",
    "cudnn",
    "cuda",
    "cublas64_12.dll",
    "cudnn_ops",
)
CUDA_DLL_HANDLES: List[Any] = []


def emit(payload: Dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def configure_cuda_dll_search_paths() -> List[str]:
    added_paths: List[str] = []
    candidate_roots: List[Path] = []

    for package_dir in site.getsitepackages():
        candidate_roots.append(Path(package_dir) / "nvidia")

    user_site = site.getusersitepackages()
    if user_site:
        candidate_roots.append(Path(user_site) / "nvidia")

    for root in candidate_roots:
        for relative in (
            Path("cublas") / "bin",
            Path("cudnn") / "bin",
            Path("cuda_runtime") / "bin",
            Path("cuda_nvrtc") / "bin",
        ):
            dll_dir = root / relative
            if not dll_dir.exists():
                continue

            dll_dir_str = str(dll_dir)
            if dll_dir_str not in added_paths:
                added_paths.append(dll_dir_str)
                os.environ["PATH"] = dll_dir_str + os.pathsep + os.environ.get("PATH", "")
                if hasattr(os, "add_dll_directory"):
                    CUDA_DLL_HANDLES.append(os.add_dll_directory(dll_dir_str))

    return added_paths


CUDA_DLL_DIRS = configure_cuda_dll_search_paths()


def detect_device(preferred_device: str = "auto") -> Tuple[str, str]:
    if preferred_device == "cpu":
        return "cpu", "int8"

    try:
        import ctranslate2  # type: ignore

        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda", "float16"
    except Exception as exc:
        logging.info("CUDA detection skipped: %s", exc)

    if preferred_device == "cuda":
        logging.warning(
            "CUDA was requested, but ctranslate2 does not see a CUDA device. Falling back to CPU int8."
        )

    return "cpu", "int8"


def load_model(model_size: str, preferred_device: str = "auto") -> Tuple[Any, str, str]:
    if model_size not in MODEL_SIZES:
        raise ValueError(
            f"Неверный размер модели '{model_size}'. Доступно: tiny, base, small, medium, large-v3-turbo, large-v3."
        )

    if preferred_device not in DEVICES:
        raise ValueError("Неверное устройство. Доступно: auto, cpu, cuda.")

    device, compute_type = detect_device(preferred_device)

    key = (model_size, device, compute_type)
    if key in MODEL_CACHE:
        return MODEL_CACHE[key], device, compute_type

    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Не установлен faster-whisper. Запустите install-ml.bat в папке Promptik "
            "или вручную создайте python/.venv и выполните pip install -r python/requirements.txt."
        ) from exc

    logging.info(
        "Loading faster-whisper model=%s device=%s compute_type=%s",
        model_size,
        device,
        compute_type,
    )

    try:
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
    except Exception:
        if device != "cuda":
            raise

        logging.exception("CUDA model loading failed, falling back to CPU int8.")
        device = "cpu"
        compute_type = "int8"
        key = (model_size, device, compute_type)
        model = WhisperModel(model_size, device=device, compute_type=compute_type)

    MODEL_CACHE[key] = model
    return model, device, compute_type


def is_cuda_runtime_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in CUDA_FALLBACK_MARKERS)


def normalize_language(language: str) -> Optional[str]:
    if language not in LANGUAGES:
        raise ValueError("Неверный язык. Доступно: auto, ru, en.")

    return None if language == "auto" else language


def normalize_device(device: str) -> str:
    if device not in DEVICES:
        raise ValueError("Неверное устройство. Доступно: auto, cpu, cuda.")

    return device


def normalize_vad_silence_ms(value: Any) -> int:
    try:
        numeric_value = int(value)
    except (TypeError, ValueError):
        numeric_value = 700

    return min(2000, max(200, round(numeric_value / 50) * 50))


def normalize_beam_size(value: Any) -> int:
    try:
        numeric_value = int(value)
    except (TypeError, ValueError):
        numeric_value = 1

    return min(12, max(1, numeric_value))


def normalize_hotwords(value: Any) -> str:
    if not isinstance(value, str):
        return ""

    return " ".join(value.replace("\n", " ").split())[:2000]


def get_huggingface_cache_dir() -> Path:
    explicit_cache = (
        os.environ.get("HUGGINGFACE_HUB_CACHE")
        or os.environ.get("TRANSFORMERS_CACHE")
    )
    if explicit_cache:
        return Path(explicit_cache).expanduser()

    hf_home = os.environ.get("HF_HOME")
    if hf_home:
        return Path(hf_home).expanduser() / "hub"

    return Path.home() / ".cache" / "huggingface" / "hub"


def is_model_downloaded(model_size: str) -> bool:
    repo_id = MODEL_REPO_IDS[model_size]
    repo_cache_name = f"models--{repo_id.replace('/', '--')}"
    repo_dir = get_huggingface_cache_dir() / repo_cache_name
    snapshots_dir = repo_dir / "snapshots"

    if not snapshots_dir.exists():
        return False

    for snapshot_dir in snapshots_dir.iterdir():
        if not snapshot_dir.is_dir():
            continue
        files = [item for item in snapshot_dir.rglob("*") if item.is_file()]
        if files:
            return True

    return False


def model_status(command: Dict[str, Any]) -> Dict[str, Any]:
    requested = command.get("model_sizes", sorted(MODEL_SIZES))
    if not isinstance(requested, list):
        requested = sorted(MODEL_SIZES)

    statuses: Dict[str, bool] = {}
    for raw_size in requested:
        model_size = str(raw_size)
        if model_size in MODEL_SIZES:
            statuses[model_size] = is_model_downloaded(model_size)

    return {
        "ok": True,
        "cache_dir": str(get_huggingface_cache_dir()),
        "models": statuses,
    }


def warmup_model(command: Dict[str, Any]) -> Dict[str, Any]:
    model_size = str(command.get("model_size", "large-v3")).strip()
    preferred_device = normalize_device(str(command.get("device", "auto")).strip())
    _, device, compute_type = load_model(model_size, preferred_device)

    return {
        "ok": True,
        "model_size": model_size,
        "device": device,
        "compute_type": compute_type,
    }


def transcribe(command: Dict[str, Any]) -> Dict[str, Any]:
    file_path = str(command.get("file_path", "")).strip()
    model_size = str(command.get("model_size", "large-v3")).strip()
    language = str(command.get("language", "auto")).strip()
    preferred_device = normalize_device(str(command.get("device", "auto")).strip())
    vad_silence_ms = normalize_vad_silence_ms(command.get("vad_silence_ms", 700))
    beam_size = normalize_beam_size(command.get("beam_size", 1))
    hotwords = normalize_hotwords(command.get("hotwords", ""))

    if not file_path:
        raise ValueError("Не передан путь к аудио или видео файлу.")

    source = Path(file_path)
    if not source.exists():
        raise FileNotFoundError(f"Файл не найден: {file_path}")

    model, device, compute_type = load_model(model_size, preferred_device)
    language_arg = normalize_language(language)

    try:
        segments, detected_language = run_transcription(
            model=model,
            source=source,
            language=language,
            language_arg=language_arg,
            model_size=model_size,
            device=device,
            compute_type=compute_type,
            vad_silence_ms=vad_silence_ms,
            beam_size=beam_size,
            hotwords=hotwords,
        )
    except Exception as exc:
        if preferred_device == "auto" and device == "cuda" and is_cuda_runtime_error(exc):
            logging.warning(
                "CUDA runtime is unavailable (%s). Falling back to CPU int8.",
                exc,
            )
            model, device, compute_type = load_model(model_size, "cpu")
            segments, detected_language = run_transcription(
                model=model,
                source=source,
                language=language,
                language_arg=language_arg,
                model_size=model_size,
                device=device,
                compute_type=compute_type,
                vad_silence_ms=vad_silence_ms,
                beam_size=beam_size,
                hotwords=hotwords,
            )
        else:
            raise

    text = " ".join(segment["text"] for segment in segments).strip()

    return {
        "ok": True,
        "text": text,
        "language": detected_language,
        "segments": segments,
    }


def run_transcription(
    *,
    model: Any,
    source: Path,
    language: str,
    language_arg: Optional[str],
    model_size: str,
    device: str,
    compute_type: str,
    vad_silence_ms: int,
    beam_size: int,
    hotwords: str,
) -> Tuple[List[Dict[str, Any]], str]:
    logging.info(
        "Transcribing file=%s model=%s language=%s device=%s compute_type=%s vad_silence_ms=%s beam_size=%s",
        source,
        model_size,
        language,
        device,
        compute_type,
        vad_silence_ms,
        beam_size,
    )

    initial_prompt = build_initial_prompt(language, hotwords)

    segments_iter, info = model.transcribe(
        str(source),
        language=language_arg,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": vad_silence_ms},
        beam_size=beam_size,
        best_of=beam_size,
        patience=1.5 if beam_size >= 10 else 1.2 if beam_size >= 8 else 1,
        initial_prompt=initial_prompt,
        hotwords=hotwords or None,
        temperature=0.0,
        condition_on_previous_text=True,
        language_detection_segments=3 if language == "auto" else 1,
    )

    segments = [
        {
            "start": float(segment.start),
            "end": float(segment.end),
            "text": str(segment.text).strip(),
        }
        for segment in segments_iter
    ]
    detected_language = getattr(
        info,
        "language",
        language if language != "auto" else "auto",
    )

    return segments, str(detected_language)


def build_initial_prompt(language: str, hotwords: str) -> str:
    if language == "en":
        base_prompt = (
            "Accurate verbatim transcription. Preserve names, product names, "
            "technical terms, punctuation, and mixed Russian/English words."
        )
    else:
        base_prompt = (
            "Точная дословная транскрибация русской разговорной речи. "
            "Сохраняй имена собственные, названия продуктов, технические термины, "
            "английские слова и пунктуацию."
        )

    if hotwords:
        return f"{base_prompt} Важные термины: {hotwords}"

    return base_prompt


def gpu_status(_: Dict[str, Any]) -> Dict[str, Any]:
    status: Dict[str, Any] = {
        "ok": True,
        "cuda_dll_dirs": CUDA_DLL_DIRS,
        "cuda_device_count": 0,
        "cuda_available": False,
    }

    try:
        import ctranslate2  # type: ignore

        count = ctranslate2.get_cuda_device_count()
        status["cuda_device_count"] = count
        status["cuda_available"] = count > 0
    except Exception as exc:
        status["ok"] = False
        status["error"] = str(exc)

    return status


def handle_command(command: Dict[str, Any]) -> Dict[str, Any]:
    action = command.get("action")

    if action == "transcribe":
        return transcribe(command)

    if action == "model_status":
        return model_status(command)

    if action == "warmup":
        return warmup_model(command)

    if action == "gpu_status":
        return gpu_status(command)

    return {"ok": False, "error": f"Неизвестное действие: {action}"}


def iter_stdin_lines() -> Iterable[str]:
    while True:
        line = sys.stdin.readline()
        if line == "":
            break
        yield line


def main() -> None:
    for line in iter_stdin_lines():
        clean_line = line.strip()
        if not clean_line:
            continue

        try:
            command = json.loads(clean_line)
            if not isinstance(command, dict):
                raise ValueError("JSON-команда должна быть объектом.")
            emit(handle_command(command))
        except Exception as exc:
            logging.error("Command failed: %s", exc)
            logging.debug("Traceback:\n%s", traceback.format_exc())
            emit({"ok": False, "error": str(exc)})


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUTF8", "1")
    main()
