import { useState, useCallback, useRef } from "react";

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

  // No manual EXIF correction here: modern browsers apply EXIF orientation
  // automatically when decoding, keeping <img> rendering, naturalWidth/Height,
  // and canvas drawImage consistent. Rotating again would double-rotate.
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

      const url = URL.createObjectURL(file);
      try {
        // Verify the browser can actually decode the file before entering edit
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = url;
        });

        objectUrlRef.current = url;
        setState({ imageUrl: url, originalFile: file, error: null, loading: false });
      } catch (e) {
        URL.revokeObjectURL(url);
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
