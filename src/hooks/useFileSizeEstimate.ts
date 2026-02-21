import { useState, useEffect, useRef } from "react";
import type { CropArea, OutputFormat } from "../types";
import { encodeCanvas } from "../lib/encoding";

const PREVIEW_MAX_DIM = 1024;
const DEBOUNCE_MS = 500;

export function useFileSizeEstimate(
  imageUrl: string | null,
  croppedAreaPixels: CropArea | null,
  targetWidth: number,
  targetHeight: number,
  format: OutputFormat,
  quality: number,
) {
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const abortRef = useRef(0);

  useEffect(() => {
    if (!imageUrl || !croppedAreaPixels) {
      setEstimatedSize(null);
      return;
    }

    const id = ++abortRef.current;
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

        if (abortRef.current !== id) return;

        // Scale down for preview estimate
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

        if (abortRef.current !== id) {
          cleanupCanvas(previewCanvas);
          return;
        }

        const blob = await encodeCanvas(previewCanvas, format, quality);

        if (abortRef.current !== id) {
          cleanupCanvas(previewCanvas);
          return;
        }

        // Scale estimate up using a sub-linear exponent (0.75) rather than a
        // linear pixel ratio, because compressed image size doesn't scale
        // proportionally — larger images compress more efficiently.
        const fullPixels = targetWidth * targetHeight;
        const previewPixels = previewW * previewH;
        const estimated = Math.round(
          blob.size * Math.pow(fullPixels / previewPixels, 0.75),
        );

        setEstimatedSize(estimated);
      } catch {
        if (abortRef.current === id) {
          setEstimatedSize(null);
        }
      } finally {
        if (abortRef.current === id) {
          setEstimating(false);
        }
        if (previewCanvas) {
          cleanupCanvas(previewCanvas);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [imageUrl, croppedAreaPixels, targetWidth, targetHeight, format, quality]);

  return { estimatedSize, estimating };
}

function cleanupCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.width = 0;
  canvas.height = 0;
}
