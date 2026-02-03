import { useState, useCallback, useRef } from "react";
import * as Comlink from "comlink";
import type { CropArea, OutputFormat, EncodeResult } from "../types";
import type { EncodeWorkerApi } from "../workers/encode.worker";
import { getCroppedCanvas, canvasToImageData } from "../lib/cropUtils";
import { getOutputFilename } from "../lib/fileNaming";
import { downloadBlob } from "../lib/download";
import { encodeCanvas } from "../lib/encoding";
import Pica from "pica";

const pica = new Pica();

function supportsOffscreenCanvas(): boolean {
  try {
    return typeof OffscreenCanvas !== "undefined";
  } catch {
    return false;
  }
}

export function useExportPipeline() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const exportImage = useCallback(
    async (
      imageUrl: string,
      originalFilename: string,
      cropArea: CropArea,
      targetWidth: number,
      targetHeight: number,
      format: OutputFormat,
      quality: number,
    ) => {
      setExporting(true);
      setError(null);

      try {
        // Load the image
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image for export"));
          img.src = imageUrl;
        });

        // Get cropped canvas
        const croppedCanvas = getCroppedCanvas(img, cropArea);

        let result: EncodeResult;

        if (supportsOffscreenCanvas()) {
          // Use worker
          try {
            if (!workerRef.current) {
              workerRef.current = new Worker(
                new URL("../workers/encode.worker.ts", import.meta.url),
                { type: "module" },
              );
            }
            const api =
              Comlink.wrap<EncodeWorkerApi>(workerRef.current);
            const imageData = canvasToImageData(croppedCanvas);

            result = await api.resizeAndEncode(
              Comlink.transfer(
                {
                  imageData,
                  targetWidth,
                  targetHeight,
                  format,
                  quality,
                },
                [imageData.data.buffer],
              ),
            );
          } catch {
            // Fallback to main thread
            result = await mainThreadExport(
              croppedCanvas,
              targetWidth,
              targetHeight,
              format,
              quality,
            );
          }
        } else {
          result = await mainThreadExport(
            croppedCanvas,
            targetWidth,
            targetHeight,
            format,
            quality,
          );
        }

        const filename = getOutputFilename(
          originalFilename,
          result.width,
          result.height,
          format,
        );
        downloadBlob(result.blob, filename);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed");
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  return { exporting, error, exportImage };
}

async function mainThreadExport(
  croppedCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  format: OutputFormat,
  quality: number,
): Promise<EncodeResult> {
  const resizedCanvas = document.createElement("canvas");
  resizedCanvas.width = targetWidth;
  resizedCanvas.height = targetHeight;

  const isDownscale =
    targetWidth <= croppedCanvas.width && targetHeight <= croppedCanvas.height;

  if (isDownscale) {
    await pica.resize(croppedCanvas, resizedCanvas, {
      unsharpAmount: 80,
      unsharpRadius: 0.6,
      unsharpThreshold: 2,
    });
  } else {
    const ctx = resizedCanvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(croppedCanvas, 0, 0, targetWidth, targetHeight);
  }

  const blob = await encodeCanvas(resizedCanvas, format, quality);
  return { blob, width: targetWidth, height: targetHeight };
}
