import { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  onFile: (file: File) => void;
  loading: boolean;
  error: string | null;
}

export function UploadZone({ onFile, loading, error }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        className={`flex w-full max-w-lg cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-colors ${
          dragging
            ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/30"
            : "border-zinc-300 bg-white hover:border-indigo-300 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:border-indigo-500"
        }`}
      >
        <svg
          className="h-12 w-12 text-zinc-400 dark:text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>

        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading image...
          </p>
        ) : (
          <>
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-300">
              Drop an image here or click to browse
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF
            </p>
          </>
        )}

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
