import { useState, useCallback, useEffect, useRef } from "react";
import * as Comlink from "comlink";
import type { CropArea, OutputFormat, EncodeResult } from "../types";
import type { EncodeWorkerApi } from "../workers/encode.worker";
import { getCroppedCanvas, canvasToImageData } from "../lib/cropUtils";
import { getOutputFilename } from "../lib/fileNaming";
import { downloadBlob } from "../lib/download";
import { encodeCanvas } from "../lib/encoding";
import Pica from "pica";

let picaInstance = new Pica();
let picaUsageCount = 0;
const PICA_RESET_INTERVAL = 5; // Reset pica every 5 exports
const WORKER_TIMEOUT_MS = 20000;
const WORKER_RESET_INTERVAL = 2;

function supportsOffscreenCanvas(): boolean {
  try {
    return typeof OffscreenCanvas !== "undefined";
  } catch {
    return false;
  }
}

function getPicaInstance() {
  picaUsageCount++;
  if (picaUsageCount >= PICA_RESET_INTERVAL) {
    picaInstance = new Pica();
    picaUsageCount = 0;
  }
  return picaInstance;
}

export function useExportPipeline() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerUseCountRef = useRef(0);

  const resetWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    workerUseCountRef.current = 0;
  }, []);

  useEffect(() => {
    return () => resetWorker();
  }, [resetWorker]);

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
      let croppedCanvas: HTMLCanvasElement | null = null;
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
        croppedCanvas = getCroppedCanvas(img, cropArea);

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
            const api = Comlink.wrap<EncodeWorkerApi>(workerRef.current);
            const imageData = canvasToImageData(croppedCanvas);

            result = await withTimeout(
              api.resizeAndEncode(
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
              ),
              WORKER_TIMEOUT_MS,
            );
            workerUseCountRef.current += 1;
            if (workerUseCountRef.current >= WORKER_RESET_INTERVAL) {
              resetWorker();
            }
          } catch {
            resetWorker();
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
        if (croppedCanvas) {
          cleanupExport(croppedCanvas);
        }
      }
    },
    [resetWorker],
  );

  return { exporting, error, exportImage };
}

function cleanupExport(canvas: HTMLCanvasElement): void {
  // Release canvas memory
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  // Force GC hint (not guaranteed but helps)
  canvas.width = 0;
  canvas.height = 0;
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
    const pica = getPicaInstance();
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
  cleanupExport(resizedCanvas);
  return { blob, width: targetWidth, height: targetHeight };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Worker timed out")),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}
