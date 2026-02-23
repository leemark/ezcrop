import { useState, useCallback, useRef } from "react";
import { getOrientation, correctOrientation } from "../lib/orientation";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/bmp",
  "image/tiff",
];

interface ImageLoaderState {
  imageUrl: string | null;
  originalFile: File | null;
  error: string | null;
  loading: boolean;
}

export function useImageLoader() {
  const [state, setState] = useState<ImageLoaderState>({
    imageUrl: null,
    originalFile: null,
    error: null,
    loading: false,
  });
  const objectUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      cleanup();

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setState({
          imageUrl: null,
          originalFile: null,
          error: `Unsupported file type: ${file.type || "unknown"}. Please use JPEG, PNG, WebP, AVIF, GIF, BMP, or TIFF.`,
          loading: false,
        });
        return;
      }

      setState({ imageUrl: null, originalFile: file, error: null, loading: true });

      try {
        const degrees = await getOrientation(file);

        if (degrees === 0) {
          const url = URL.createObjectURL(file);
          objectUrlRef.current = url;
          setState({ imageUrl: url, originalFile: file, error: null, loading: false });
          return;
        }

        // Need EXIF correction
        const img = new Image();
        const rawUrl = URL.createObjectURL(file);
        try {
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = rawUrl;
          });
        } finally {
          URL.revokeObjectURL(rawUrl);
        }

        const correctedCanvas = correctOrientation(img, degrees);

        const blob = await new Promise<Blob>((resolve, reject) => {
          correctedCanvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Orientation correction failed"))),
            "image/png",
          );
        });

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setState({ imageUrl: url, originalFile: file, error: null, loading: false });
      } catch (e) {
        setState({
          imageUrl: null,
          originalFile: null,
          error: e instanceof Error ? e.message : "Failed to load image",
          loading: false,
        });
      }
    },
    [cleanup],
  );

  const reset = useCallback(() => {
    cleanup();
    setState({ imageUrl: null, originalFile: null, error: null, loading: false });
  }, [cleanup]);

  return { ...state, loadFile, reset };
}
