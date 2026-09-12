import * as Comlink from "comlink";
import Pica from "pica";
import type { EncodeRequest, EncodeResult, OutputFormat } from "../types";
import { encodeImageData } from "../lib/encoding";
import { assertValidOutputDimensions } from "../lib/exportValidation";

const pica = new Pica({
  features: ["js", "wasm"],
  // Pica's default factory uses document, which is unavailable in a worker.
  createCanvas: (width, height) =>
    new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement,
});

interface EncodePreviewRequest {
  imageData: ImageData;
  format: OutputFormat;
  quality: number;
}

async function encodePreview(req: EncodePreviewRequest): Promise<Blob> {
  return encodeImageData(req.imageData, req.format, req.quality);
}

async function resizeAndEncode(req: EncodeRequest): Promise<EncodeResult> {
  const { imageData, targetWidth, targetHeight, format, quality } = req;
  assertValidOutputDimensions(targetWidth, targetHeight);

  // Create source OffscreenCanvas from ImageData
  const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  let dstCanvas: OffscreenCanvas | null = null;
  try {
    const srcCtx = srcCanvas.getContext("2d");
    if (!srcCtx) throw new Error("Failed to get source canvas context");
    srcCtx.putImageData(imageData, 0, 0);

    // Create target OffscreenCanvas
    dstCanvas = new OffscreenCanvas(targetWidth, targetHeight);

    const isDownscale =
      targetWidth <= imageData.width && targetHeight <= imageData.height;

    if (isDownscale) {
      // Pica Lanczos for downscaling
      await pica.resize(srcCanvas as unknown as HTMLCanvasElement, dstCanvas as unknown as HTMLCanvasElement, {
        unsharpAmount: 80,
        unsharpRadius: 0.6,
        unsharpThreshold: 2,
      });
    } else {
      // Native drawImage for upscaling (pica is extremely slow at upscaling)
      const dstCtx2 = dstCanvas.getContext("2d");
      if (!dstCtx2) throw new Error("Failed to get dest canvas context");
      dstCtx2.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);
    }

    // Get resized ImageData
    const dstCtx = dstCanvas.getContext("2d");
    if (!dstCtx) throw new Error("Failed to get dest canvas context");
    const resizedData = dstCtx.getImageData(0, 0, targetWidth, targetHeight);

    // Encode
    const blob = await encodeImageData(resizedData, format, quality);

    return { blob, width: targetWidth, height: targetHeight };
  } finally {
    srcCanvas.width = 0;
    srcCanvas.height = 0;
    if (dstCanvas) {
      dstCanvas.width = 0;
      dstCanvas.height = 0;
    }
  }
}

const api = { resizeAndEncode, encodePreview };
export type EncodeWorkerApi = typeof api;

Comlink.expose(api);
