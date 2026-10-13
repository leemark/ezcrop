import { useState, useCallback, useEffect, useRef } from "react";
import * as Comlink from "comlink";
import type { CropArea, OutputFormat, EncodeResult } from "../types";
import type { EncodeWorkerApi } from "../workers/encode.worker";
import { getCroppedCanvas, canvasToImageData } from "../lib/cropUtils";
import { getOutputFilename } from "../lib/fileNaming";
import { downloadBlob } from "../lib/download";
import { encodeCanvas } from "../lib/encoding";
import { assertValidOutputDimensions } from "../lib/exportValidation";
import Pica from "pica";

type PagePica = ReturnType<typeof Pica>;

function createPagePica(): PagePica {
  // The page-side resize path must not create Pica's implicit blob worker.
  // WebKit can leave that worker pending when its supporting assets are not
  // cached, which prevents the dedicated encoder worker from ever starting.
  return new Pica({ features: ["js", "wasm"] });
}

let picaInstance = createPagePica();
let picaUsageCount = 0;
const PICA_RESET_INTERVAL = 5; // Reset pica every 5 exports
const WORKER_TIMEOUT_MS = 20000;
const AVIF_WORKER_TIMEOUT_MS = 120000;
const IMAGE_LOAD_TIMEOUT_MS = 20000;
const RESIZE_TIMEOUT_MS = 20000;
const ENCODE_TIMEOUT_MS = 20000;
const WORKER_RESET_INTERVAL = 2;
const CANCELLED = Symbol("export cancelled");
const AVIF_EXPORT_ERROR =
  "AVIF export couldn't finish. Reconnect and retry, or choose JPEG or WebP.";
const AVIF_TIMEOUT_ERROR =
  "AVIF is taking too long. Try a smaller output size, or choose JPEG or WebP.";
const PREPARATION_TIMEOUT_ERROR =
  "Export couldn't prepare the image in time. Reconnect and retry, or choose JPEG or WebP.";

export type CompletedExport = {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  format: OutputFormat;
  quality: number;
};

class WorkerTimeoutError extends Error {
  constructor() {
    super("Worker timed out");
    this.name = "WorkerTimeoutError";
  }
}

class ExportPreparationTimeoutError extends Error {
  constructor() {
    super(PREPARATION_TIMEOUT_ERROR);
    this.name = "ExportPreparationTimeoutError";
  }
}

type WorkerProxy = Comlink.Remote<EncodeWorkerApi>;

interface ExportJob {
  id: number;
  cancelled: Promise<void>;
  cancel: () => void;
}

function createExportJob(id: number): ExportJob {
  let cancel!: () => void;
  const cancelled = new Promise<void>((resolve) => {
    cancel = resolve;
  });
  return { id, cancelled, cancel };
}

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
    picaInstance = createPagePica();
    picaUsageCount = 0;
  }
  return picaInstance;
}

function loadImageForExport(
  image: HTMLImageElement,
  imageUrl: string,
  job: ExportJob,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      finishError(new ExportPreparationTimeoutError());
    }, IMAGE_LOAD_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
    };
    const finish = (complete: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(complete);
    };
    const finishError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    image.onload = () => finish(true);
    image.onerror = () => {
      finishError(new Error("Failed to load image for export"));
    };
    void job.cancelled.then(() => finish(false));

    try {
      image.src = imageUrl;
    } catch {
      finishError(new Error("Failed to load image for export"));
    }
  });
}

export function useExportPipeline() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<CompletedExport | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerApiRef = useRef<WorkerProxy | null>(null);
  const workerUseCountRef = useRef(0);
  const jobIdRef = useRef(0);
  const activeJobRef = useRef<ExportJob | null>(null);

  const resetWorker = useCallback((expectedWorker?: Worker) => {
    const worker = workerRef.current;
    if (expectedWorker && worker !== expectedWorker) return;

    const api = workerApiRef.current;
    workerRef.current = null;
    workerApiRef.current = null;
    workerUseCountRef.current = 0;

    if (api) {
      try {
        api[Comlink.releaseProxy]();
      } catch {
        // The worker may already have failed; termination still releases it.
      }
    }
    worker?.terminate();
  }, []);

  const invalidateCurrentJob = useCallback((terminateWorker = true) => {
    const hadActiveJob = activeJobRef.current !== null;
    jobIdRef.current += 1;
    activeJobRef.current?.cancel();
    activeJobRef.current = null;
    if (terminateWorker || hadActiveJob) resetWorker();
  }, [resetWorker]);

  const cancelExport = useCallback(() => {
    invalidateCurrentJob();
    setExporting(false);
    setError(null);
  }, [invalidateCurrentJob]);

  const clearLastExport = useCallback(() => {
    setLastExport(null);
  }, []);

  useEffect(() => {
    return () => invalidateCurrentJob();
  }, [invalidateCurrentJob]);

  const exportImage = useCallback(
    async (
      imageUrl: string,
      originalFilename: string,
      cropArea: CropArea,
      targetWidth: number,
      targetHeight: number,
      format: OutputFormat,
      quality: number,
    ): Promise<boolean> => {
      // A new request owns all later state and download effects. Terminate any
      // previous worker request and invalidate work already running on this thread.
      invalidateCurrentJob(activeJobRef.current !== null);
      const job = createExportJob(++jobIdRef.current);
      activeJobRef.current = job;
      const isCurrentJob = () =>
        activeJobRef.current === job && jobIdRef.current === job.id;

      let croppedCanvas: HTMLCanvasElement | null = null;
      setExporting(true);
      setError(null);

      try {
        assertValidOutputDimensions(targetWidth, targetHeight);
        const canResizeInWorker = supportsOffscreenCanvas();

        const image = new Image();
        const loaded = await loadImageForExport(image, imageUrl, job);
        if (!loaded || !isCurrentJob()) return false;

        croppedCanvas = getCroppedCanvas(image, cropArea);
        if (!isCurrentJob()) return false;

        let result: EncodeResult | typeof CANCELLED;

        if (format === "avif" && !canResizeInWorker) {
          // WebKit can run module workers without OffscreenCanvas. Resize on
          // the page using the same Pica/native path as the native encoder
          // fallback, then keep AVIF encoding in the worker.
          const resizedCanvas = await resizeCanvasForExport(
            croppedCanvas,
            targetWidth,
            targetHeight,
            isCurrentJob,
            job.cancelled,
          );
          if (resizedCanvas === CANCELLED) return false;

          let worker: Worker | null = null;
          try {
            if (!isCurrentJob()) return false;
            const imageData = canvasToImageData(resizedCanvas);
            if (!isCurrentJob()) return false;

            let api = workerApiRef.current;
            worker = workerRef.current;
            if (!worker || !api) {
              resetWorker();
              worker = new Worker(
                new URL("../workers/encode.worker.ts", import.meta.url),
                { type: "module" },
              );
              workerRef.current = worker;
              api = Comlink.wrap<EncodeWorkerApi>(worker);
              workerApiRef.current = api;
            }

            const request = api.encodePreview(
              Comlink.transfer(
                { imageData, format, quality },
                [imageData.data.buffer],
              ),
            );
            const blob = await awaitWorkerResult(
              worker,
              request,
              AVIF_WORKER_TIMEOUT_MS,
              job.cancelled,
            );
            if (blob === CANCELLED || !isCurrentJob()) return false;

            result = { blob, width: targetWidth, height: targetHeight };
            workerUseCountRef.current += 1;
            if (workerUseCountRef.current >= WORKER_RESET_INTERVAL) {
              resetWorker(worker);
            }
          } catch (error) {
            if (!isCurrentJob()) return false;
            if (worker) resetWorker(worker);
            throw new Error(
              error instanceof WorkerTimeoutError
                ? AVIF_TIMEOUT_ERROR
                : AVIF_EXPORT_ERROR,
            );
          } finally {
            cleanupExport(resizedCanvas);
          }
        } else if (canResizeInWorker) {
          let worker: Worker | null = null;
          let api: WorkerProxy | null = null;
          try {
            api = workerApiRef.current;
            worker = workerRef.current;
            if (!worker || !api) {
              resetWorker();
              worker = new Worker(
                new URL("../workers/encode.worker.ts", import.meta.url),
                { type: "module" },
              );
              workerRef.current = worker;
              api = Comlink.wrap<EncodeWorkerApi>(worker);
              workerApiRef.current = api;
            }

            const imageData = canvasToImageData(croppedCanvas);
            const request = api.resizeAndEncode(
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

            const workerResult = await awaitWorkerResult(
              worker,
              request,
              format === "avif" ? AVIF_WORKER_TIMEOUT_MS : WORKER_TIMEOUT_MS,
              job.cancelled,
            );
            if (workerResult === CANCELLED || !isCurrentJob()) return false;

            result = workerResult;
            workerUseCountRef.current += 1;
            if (workerUseCountRef.current >= WORKER_RESET_INTERVAL) {
              resetWorker(worker);
            }
          } catch (error) {
            if (!isCurrentJob()) return false;
            if (worker) resetWorker(worker);
            if (format === "avif") {
              throw new Error(
                error instanceof WorkerTimeoutError
                  ? AVIF_TIMEOUT_ERROR
                  : AVIF_EXPORT_ERROR,
              );
            }

            result = await mainThreadExport(
              croppedCanvas,
              targetWidth,
              targetHeight,
              format,
              quality,
              isCurrentJob,
              job.cancelled,
            );
            if (result === CANCELLED || !isCurrentJob()) return false;
          }
        } else {
          result = await mainThreadExport(
            croppedCanvas,
            targetWidth,
            targetHeight,
            format,
            quality,
            isCurrentJob,
            job.cancelled,
          );
          if (result === CANCELLED || !isCurrentJob()) return false;
        }

        if (!isCurrentJob()) return false;
        const filename = getOutputFilename(
          originalFilename,
          result.width,
          result.height,
          format,
        );
        downloadBlob(result.blob, filename);
        if (!isCurrentJob()) return false;
        setLastExport({
          blob: result.blob,
          filename,
          width: result.width,
          height: result.height,
          format,
          quality,
        });
        return true;
      } catch (e) {
        if (isCurrentJob()) {
          setError(e instanceof Error ? e.message : "Export failed");
        }
        return false;
      } finally {
        if (croppedCanvas) cleanupExport(croppedCanvas);
        if (isCurrentJob()) {
          activeJobRef.current = null;
          setExporting(false);
        }
      }
    },
    [invalidateCurrentJob, resetWorker],
  );

  return {
    exporting,
    error,
    exportImage,
    cancelExport,
    lastExport,
    clearLastExport,
  };
}

function cleanupExport(canvas: HTMLCanvasElement): void {
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

async function mainThreadExport(
  croppedCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  format: OutputFormat,
  quality: number,
  isCurrentJob: () => boolean,
  cancelled: Promise<void>,
): Promise<EncodeResult | typeof CANCELLED> {
  const resizedCanvas = await resizeCanvasForExport(
    croppedCanvas,
    targetWidth,
    targetHeight,
    isCurrentJob,
    cancelled,
  );
  if (resizedCanvas === CANCELLED) return CANCELLED;

  try {
    if (!isCurrentJob()) return CANCELLED;
    const encoded = await awaitPreparationResult(
      encodeCanvas(resizedCanvas, format, quality),
      ENCODE_TIMEOUT_MS,
      cancelled,
    );
    if (encoded === CANCELLED) return CANCELLED;
    const blob = encoded;
    if (!isCurrentJob()) return CANCELLED;
    return { blob, width: targetWidth, height: targetHeight };
  } finally {
    cleanupExport(resizedCanvas);
  }
}

async function resizeCanvasForExport(
  croppedCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  isCurrentJob: () => boolean,
  cancelled: Promise<void>,
): Promise<HTMLCanvasElement | typeof CANCELLED> {
  assertValidOutputDimensions(targetWidth, targetHeight);
  if (!isCurrentJob()) return CANCELLED;

  const resizedCanvas = document.createElement("canvas");
  try {
    resizedCanvas.width = targetWidth;
    resizedCanvas.height = targetHeight;

    const isDownscale =
      targetWidth <= croppedCanvas.width && targetHeight <= croppedCanvas.height;

    if (isDownscale) {
      const pica = getPicaInstance();
      const resize = pica.resize(croppedCanvas, resizedCanvas, {
        unsharpAmount: 80,
        unsharpRadius: 0.6,
        unsharpThreshold: 2,
      });
      const resizeResult = await awaitPreparationResult(
        resize,
        RESIZE_TIMEOUT_MS,
        cancelled,
      );
      if (resizeResult === CANCELLED) {
        cleanupExport(resizedCanvas);
        return CANCELLED;
      }
    } else {
      const ctx = resizedCanvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(croppedCanvas, 0, 0, targetWidth, targetHeight);
    }

    if (!isCurrentJob()) {
      cleanupExport(resizedCanvas);
      return CANCELLED;
    }
    return resizedCanvas;
  } catch (error) {
    cleanupExport(resizedCanvas);
    throw error;
  }
}

function awaitPreparationResult<T>(
  request: Promise<T>,
  timeoutMs: number,
  cancelled: Promise<void>,
): Promise<T | typeof CANCELLED> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new ExportPreparationTimeoutError());
    }, timeoutMs);

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      action();
    };

    void cancelled.then(() => finish(() => resolve(CANCELLED)));
    request.then(
      (value) => finish(() => resolve(value)),
      (reason: unknown) => finish(() => reject(reason)),
    );
  });
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
      reject(new WorkerTimeoutError());
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
      finish(() => reject(new Error("Worker failed")));
    };
    const onMessageError = () => {
      finish(() => reject(new Error("Worker message could not be read")));
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
