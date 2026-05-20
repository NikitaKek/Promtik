import type {
  AppStatus,
  HistorySource,
  HotkeyAccelerator,
  LanguageCode,
  ModelSize
} from "./types";

export function formatForAi(text: string): string {
  return `Ответь на следующий голосовой запрос пользователя:\n\n${text.trim()}`;
}

export function statusLabel(status: AppStatus): string {
  const labels: Record<AppStatus, string> = {
    ready: "Готово",
    recording: "Идет запись",
    "loading-model": "Загрузка ML-модели",
    transcribing: "Транскрибация",
    copied: "Текст скопирован",
    error: "Ошибка"
  };

  return labels[status];
}

export function languageLabel(language: LanguageCode): string {
  const labels: Record<LanguageCode, string> = {
    auto: "Auto",
    ru: "Русский",
    en: "English"
  };

  return labels[language];
}

export function modelLabel(model: ModelSize): string {
  const labels: Record<ModelSize, string> = {
    tiny: "tiny - быстрее",
    base: "base - баланс",
    small: "small - точнее",
    medium: "medium - качество",
    "large-v3-turbo": "large-v3-turbo - быстро",
    "large-v3": "large-v3 - максимум"
  };

  return labels[model];
}

export function sourceLabel(source: HistorySource): string {
  return source === "file" ? "Файл" : "Микрофон";
}

export function hotkeyLabel(hotkey: HotkeyAccelerator): string {
  return hotkey
    .replace("CommandOrControl", "Ctrl")
    .replace("Right", "→")
    .split("+")
    .join(" + ");
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Недавно";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function excerpt(text: string, maxLength = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) {
    return clean || "Пустая транскрибация";
  }

  return `${clean.slice(0, maxLength - 1)}…`;
}
