import { useState, useEffect, useRef } from "react";
import type { CropArea, OutputFormat } from "../types";
import { getCroppedCanvas } from "../lib/cropUtils";
import { encodeCanvas } from "../lib/encoding";
import Pica from "pica";

const pica = new Pica();
const PREVIEW_MAX_DIM = 256;
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
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Load failed"));
          img.src = imageUrl;
        });

        if (abortRef.current !== id) return;

        const cropped = getCroppedCanvas(img, croppedAreaPixels);

        // Scale down for preview estimate
        const scale = Math.min(
          PREVIEW_MAX_DIM / targetWidth,
          PREVIEW_MAX_DIM / targetHeight,
          1,
        );
        const previewW = Math.max(1, Math.round(targetWidth * scale));
        const previewH = Math.max(1, Math.round(targetHeight * scale));

        const previewCanvas = document.createElement("canvas");
        previewCanvas.width = previewW;
        previewCanvas.height = previewH;
        await pica.resize(cropped, previewCanvas);

        if (abortRef.current !== id) return;

        const blob = await encodeCanvas(previewCanvas, format, quality);

        if (abortRef.current !== id) return;

        // Scale estimate up proportionally
        const fullPixels = targetWidth * targetHeight;
        const previewPixels = previewW * previewH;
        const estimated = Math.round(blob.size * (fullPixels / previewPixels));

        setEstimatedSize(estimated);
      } catch {
        if (abortRef.current === id) {
          setEstimatedSize(null);
        }
      } finally {
        if (abortRef.current === id) {
          setEstimating(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [imageUrl, croppedAreaPixels, targetWidth, targetHeight, format, quality]);

  return { estimatedSize, estimating };
}
