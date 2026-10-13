import { useState, useCallback, useEffect, useRef } from "react";

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
  const requestRef = useRef(0);
  const objectUrlsRef = useRef(new Set<string>());

  const cleanup = useCallback(() => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current.clear();
  }, []);

  useEffect(() => () => {
    requestRef.current++;
    cleanup();
  }, [cleanup]);

  // No manual EXIF correction here: modern browsers apply EXIF orientation
  // automatically when decoding, keeping <img> rendering, naturalWidth/Height,
  // and canvas drawImage consistent. Rotating again would double-rotate.
  const loadFile = useCallback(
    async (file: File): Promise<boolean> => {
      const request = ++requestRef.current;

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setState(previous => ({
          ...previous,
          error: "This file type isn't supported. Try a JPEG, PNG, WebP, AVIF, GIF, or BMP image. TIFF support depends on your browser.",
          loading: false,
        }));
        return false;
      }

      setState(previous => ({ ...previous, error: null, loading: true }));

      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      try {
        // Verify the browser can actually decode the file before entering edit
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => { img.onload = img.onerror = null; resolve(); };
          img.onerror = () => {
            img.onload = img.onerror = null;
            reject(new Error("This browser couldn't open the image. Try a JPEG or PNG copy, and check that the file isn't damaged."));
          };
          img.src = url;
        });

        if (request !== requestRef.current) return false;
        // Retain the previous image until its replacement has decoded. A failed
        // or cancelled chooser must not destroy the current editing session.
        for (const previousUrl of objectUrlsRef.current) {
          if (previousUrl !== url) {
            URL.revokeObjectURL(previousUrl);
            objectUrlsRef.current.delete(previousUrl);
          }
        }
        setState({ imageUrl: url, originalFile: file, error: null, loading: false });
        return true;
      } catch (e) {
        if (objectUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
        if (request !== requestRef.current) return false;
        setState(previous => ({
          ...previous,
          error: e instanceof Error ? e.message : "Failed to load image",
          loading: false,
        }));
        return false;
      } finally {
        if (request !== requestRef.current && objectUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    requestRef.current++;
    cleanup();
    setState({ imageUrl: null, originalFile: null, error: null, loading: false });
  }, [cleanup]);

  return { ...state, loadFile, reset };
}
