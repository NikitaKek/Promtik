export function chooseAudioMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4"
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  if (mimeType.includes("mp4")) {
    return "mp4";
  }

  return "webm";
}
