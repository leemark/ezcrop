import type { OutputFormat } from "../types";

function nativeMimeType(format: Exclude<OutputFormat, "avif">): string {
  return format === "webp" ? "image/webp" : "image/jpeg";
}

function unsupportedEncoderError(format: OutputFormat): Error {
  const label = format.toUpperCase();
  const alternatives = format === "webp" ? "JPEG or AVIF" : "WebP or AVIF";
  return new Error(
    `This browser could not encode ${label}. Choose ${alternatives}, or try a browser with ${label} support.`,
  );
}

function requireExpectedMime(blob: Blob, format: Exclude<OutputFormat, "avif">): Blob {
  if (blob.type.trim().toLowerCase() !== nativeMimeType(format)) {
    throw unsupportedEncoderError(format);
  }
  return blob;
}

async function encodeAvif(imageData: ImageData, quality: number): Promise<Blob> {
  try {
    const { encode } = await import("@jsquash/avif");
    const encoded = await encode(imageData, {
      quality,
      speed: 6,
    });
    return new Blob([encoded], { type: "image/avif" });
  } catch {
    throw new Error(
      "AVIF encoding failed. Reconnect and retry, or choose JPEG or WebP.",
    );
  }
}

export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  if (format === "avif") {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return encodeAvif(imageData, quality);
  }

  const mimeType = nativeMimeType(format);
  const q = quality / 100;
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(unsupportedEncoderError(format));
            return;
          }
          try {
            resolve(requireExpectedMime(blob, format));
          } catch (error) {
            reject(error);
          }
        },
        mimeType,
        q,
      );
    } catch {
      reject(unsupportedEncoderError(format));
    }
  });
}

export async function encodeImageData(
  imageData: ImageData,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  if (format === "avif") return encodeAvif(imageData, quality);

  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("OffscreenCanvas not available for encoding in worker");
  }

  const oc = new OffscreenCanvas(imageData.width, imageData.height);
  try {
    const ctx = oc.getContext("2d");
    if (!ctx) throw new Error("Failed to get OffscreenCanvas context");
    ctx.putImageData(imageData, 0, 0);

    const mimeType = nativeMimeType(format);
    const blob = await oc.convertToBlob({
      type: mimeType,
      quality: quality / 100,
    });
    return requireExpectedMime(blob, format);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("This browser could not encode")) {
      throw error;
    }
    throw unsupportedEncoderError(format);
  } finally {
    oc.width = 0;
    oc.height = 0;
  }
}
