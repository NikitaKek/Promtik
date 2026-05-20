import { formatForAi } from "./formatting";

export async function copyCleanText(text: string): Promise<void> {
  const result = await window.promptik.copyText(text.trim());
  if (!result.ok) {
    throw new Error(result.error ?? "Не удалось скопировать текст.");
  }
}

export async function copyWithSettings(text: string, aiFormat: boolean): Promise<void> {
  const result = await window.promptik.copyText(
    aiFormat ? formatForAi(text) : text.trim()
  );
  if (!result.ok) {
    throw new Error(result.error ?? "Не удалось скопировать текст.");
  }
}
