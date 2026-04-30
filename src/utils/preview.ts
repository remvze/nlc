export function toLoggable(input: unknown): string {
  try {
    if (typeof input === "string") return input;
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

export function previewText(text: string, maxLines = 12, maxCharsPerLine = 160) {
  const lines = text.split("\n");
  const clipped = lines.slice(0, maxLines).map((line) => {
    if (line.length <= maxCharsPerLine) return line;
    return `${line.slice(0, maxCharsPerLine - 3)}...`;
  });

  if (lines.length > maxLines) {
    clipped.push(`... (${lines.length - maxLines} more lines)`);
  }

  return clipped.join("\n");
}
