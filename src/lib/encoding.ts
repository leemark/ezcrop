import type { OutputFormat } from "../types";

export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  const q = quality / 100;

  if (format === "avif") {
    const { encode } = await import("@jsquash/avif");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const encoded = await encode(imageData, {
      quality,
      speed: 6,
    });
    return new Blob([encoded], { type: "image/avif" });
  }

  const mimeType = format === "webp" ? "image/webp" : "image/jpeg";
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Failed to encode as ${format}`));
      },
      mimeType,
      q,
    );
  });
}

export async function encodeImageData(
  imageData: ImageData,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  const q = quality / 100;

  if (format === "avif") {
    const { encode } = await import("@jsquash/avif");
    const encoded = await encode(imageData, {
      quality,
      speed: 6,
    });
    return new Blob([encoded], { type: "image/avif" });
  }

  if (typeof OffscreenCanvas !== "undefined") {
    const oc = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = oc.getContext("2d");
    if (!ctx) throw new Error("Failed to get OffscreenCanvas context");
    ctx.putImageData(imageData, 0, 0);
    const mimeType = format === "webp" ? "image/webp" : "image/jpeg";
    const blob = await oc.convertToBlob({ type: mimeType, quality: q });
    return blob;
  }

  throw new Error("OffscreenCanvas not available for encoding in worker");
}
