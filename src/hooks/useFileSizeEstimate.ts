import { useState, useEffect, useRef } from "react";
import * as Comlink from "comlink";
import type { CropArea, OutputFormat } from "../types";
import type { EncodeWorkerApi } from "../workers/encode.worker";
import { canvasToImageData } from "../lib/cropUtils";
import { encodeCanvas } from "../lib/encoding";

const PREVIEW_MAX_DIM = 1024;
const DEBOUNCE_MS = 500;
const AVIF_ESTIMATE_TIMEOUT_MS = 60000;
const CANCELLED = Symbol("estimate cancelled");

type WorkerProxy = Comlink.Remote<EncodeWorkerApi>;

export function useFileSizeEstimate(
  imageUrl: string | null,
  croppedAreaPixels: CropArea | null,
  targetWidth: number,
  targetHeight: number,
  format: OutputFormat,
  quality: number,
  paused = false,
) {
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const abortRef = useRef(0);

  useEffect(() => {
    const id = ++abortRef.current;
    let cancelled = false;
    let worker: Worker | null = null;
    let workerApi: WorkerProxy | null = null;
    let cancelEstimate!: () => void;
    const cancelledSignal = new Promise<void>((resolve) => {
      cancelEstimate = resolve;
    });
    const isCurrent = () => !cancelled && abortRef.current === id;

    const disposeWorker = () => {
      const currentApi = workerApi;
      const currentWorker = worker;
      workerApi = null;
      worker = null;
      if (currentApi) {
        try {
          currentApi[Comlink.releaseProxy]();
        } catch {
          // Terminating the worker still releases a failed endpoint.
        }
      }
      currentWorker?.terminate();
    };

    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      cancelEstimate();
      disposeWorker();
    };

    if (
      paused ||
      !imageUrl ||
      !croppedAreaPixels ||
      ![targetWidth, targetHeight].every(
        (size) => Number.isInteger(size) && size >= 1 && size <= 7680,
      ) ||
      croppedAreaPixels.width <= 0 ||
      croppedAreaPixels.height <= 0
    ) {
      setEstimatedSize(null);
      setEstimating(false);
      return cancel;
    }

    if (
      format === "avif" &&
      typeof Worker === "undefined"
    ) {
      setEstimatedSize(null);
      setEstimating(false);
      return cancel;
    }

    setEstimating(true);

    const timer = setTimeout(async () => {
      let previewCanvas: HTMLCanvasElement | null = null;
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Load failed"));
          img.src = imageUrl;
        });

        if (!isCurrent()) return;

        // Scale down for preview estimate.
        const scale = Math.min(
          PREVIEW_MAX_DIM / targetWidth,
          PREVIEW_MAX_DIM / targetHeight,
          1,
        );
        const previewW = Math.max(1, Math.round(targetWidth * scale));
        const previewH = Math.max(1, Math.round(targetHeight * scale));

        previewCanvas = document.createElement("canvas");
        previewCanvas.width = previewW;
        previewCanvas.height = previewH;

        const pCtx = previewCanvas.getContext("2d");
        if (!pCtx) throw new Error("Failed to get canvas context");
        pCtx.imageSmoothingEnabled = true;
        pCtx.imageSmoothingQuality = "high";
        pCtx.drawImage(
          img,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          previewW,
          previewH,
        );

        if (!isCurrent()) return;

        let blob: Blob;
        if (format === "avif") {
          const imageData = canvasToImageData(previewCanvas);
          cleanupCanvas(previewCanvas);
          previewCanvas = null;

          worker = new Worker(
            new URL("../workers/encode.worker.ts", import.meta.url),
            { type: "module" },
          );
          workerApi = Comlink.wrap<EncodeWorkerApi>(worker);
          const request = workerApi.encodePreview(
            Comlink.transfer(
              { imageData, format, quality },
              [imageData.data.buffer],
            ),
          );
          const workerResult = await awaitWorkerResult(
            worker,
            request,
            AVIF_ESTIMATE_TIMEOUT_MS,
            cancelledSignal,
          );
          if (workerResult === CANCELLED || !isCurrent()) return;
          blob = workerResult;
        } else {
          blob = await encodeCanvas(previewCanvas, format, quality);
          if (!isCurrent()) return;
        }

        // Estimate size with a sub-linear pixel scale, since compression does
        // not grow in direct proportion to image dimensions.
        const fullPixels = targetWidth * targetHeight;
        const previewPixels = previewW * previewH;
        const estimated = Math.round(
          blob.size * Math.pow(fullPixels / previewPixels, 0.75),
        );

        if (isCurrent()) setEstimatedSize(estimated);
      } catch {
        if (isCurrent()) setEstimatedSize(null);
      } finally {
        disposeWorker();
        if (isCurrent()) setEstimating(false);
        if (previewCanvas) cleanupCanvas(previewCanvas);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      cancel();
    };
  }, [
    imageUrl,
    croppedAreaPixels,
    targetWidth,
    targetHeight,
    format,
    quality,
    paused,
  ]);

  return { estimatedSize, estimating };
}

function awaitWorkerResult<T>(
  worker: Worker,
  request: Promise<T>,
  timeoutMs: number,
  cancelled: Promise<void>,
): Promise<T | typeof CANCELLED> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.removeEventListener("error", onError);
      worker.removeEventListener("messageerror", onMessageError);
      reject(new Error("Estimate worker timed out"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeoutId);
      worker.removeEventListener("error", onError);
      worker.removeEventListener("messageerror", onMessageError);
    };
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      action();
    };
    const onError = (event: ErrorEvent) => {
      event.preventDefault();
      finish(() => reject(new Error("Estimate worker failed")));
    };
    const onMessageError = () => {
      finish(() => reject(new Error("Estimate worker message could not be read")));
    };

    worker.addEventListener("error", onError);
    worker.addEventListener("messageerror", onMessageError);
    void cancelled.then(() => finish(() => resolve(CANCELLED)));
    request.then(
      (value) => finish(() => resolve(value)),
      (reason: unknown) => finish(() => reject(reason)),
    );
  });
}

function cleanupCanvas(canvas: HTMLCanvasElement): void {
  try {
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  } catch {
    // Resetting the dimensions below still releases the backing store.
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
