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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const bracketColor = dragging
    ? "border-amber-500"
    : "border-zinc-300 dark:border-zinc-600";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 p-4">
      {/* App branding */}
      <div className="text-center">
        <h1 className="font-syne text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          EZCrop
        </h1>
        <p className="mt-1.5 font-mono text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          Crop · Resize · Download
        </p>
      </div>

      {/* Drop zone with viewfinder corners */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Upload image"
        className={`relative flex w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-5 px-12 py-14 transition-colors ${
          dragging ? "bg-amber-500/5" : ""
        }`}
      >
        {/* Corner brackets */}
        <div
          className={`absolute left-0 top-0 h-7 w-7 border-l-2 border-t-2 transition-colors ${bracketColor}`}
        />
        <div
          className={`absolute right-0 top-0 h-7 w-7 border-r-2 border-t-2 transition-colors ${bracketColor}`}
        />
        <div
          className={`absolute bottom-0 left-0 h-7 w-7 border-b-2 border-l-2 transition-colors ${bracketColor}`}
        />
        <div
          className={`absolute bottom-0 right-0 h-7 w-7 border-b-2 border-r-2 transition-colors ${bracketColor}`}
        />

        {/* Icon */}
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
            dragging
              ? "bg-amber-500/10 text-amber-500"
              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
          }`}
        >
          <svg
            className="h-6 w-6"
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
        </div>

        {loading ? (
          <p aria-live="polite" className="font-mono text-xs text-zinc-400">Loading image…</p>
        ) : (
          <>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Drop an image here
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                or click to browse
              </p>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-300 dark:text-zinc-700">
              JPEG · PNG · WebP · AVIF · GIF · BMP · TIFF
            </p>
          </>
        )}

        {error && (
          <p role="alert" className="text-center text-xs text-red-500 dark:text-red-400">
            {error}
          </p>
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
