import type { OutputFormat } from "../types";

const EXT_MAP: Record<OutputFormat, string> = {
  webp: "webp",
  jpeg: "jpg",
  avif: "avif",
};

export function getOutputFilename(
  originalName: string,
  width: number,
  height: number,
  format: OutputFormat,
): string {
  const base = originalName
    .replace(/[/\\]/g, "_")
    .replace(/\.[^.]+$/, "");
  const ext = EXT_MAP[format];
  return `${base}_${width}x${height}.${ext}`;
}
