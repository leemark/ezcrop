import * as Comlink from "comlink";
import Pica from "pica";
import type { EncodeRequest, EncodeResult } from "../types";
import { encodeImageData } from "../lib/encoding";

const pica = new Pica({ features: ["js", "wasm"] });

async function resizeAndEncode(req: EncodeRequest): Promise<EncodeResult> {
  const { imageData, targetWidth, targetHeight, format, quality } = req;

  // Create source OffscreenCanvas from ImageData
  const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) throw new Error("Failed to get source canvas context");
  srcCtx.putImageData(imageData, 0, 0);

  // Create target OffscreenCanvas
  const dstCanvas = new OffscreenCanvas(targetWidth, targetHeight);

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
}

const api = { resizeAndEncode };
export type EncodeWorkerApi = typeof api;

Comlink.expose(api);
