function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface ExportPreviewProps {
  targetWidth: number;
  targetHeight: number;
  estimatedSize: number | null;
  estimating: boolean;
}

export function ExportPreview({
  targetWidth,
  targetHeight,
  estimatedSize,
  estimating,
}: ExportPreviewProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Output
        </span>
        <span className="text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
          {targetWidth}&times;{targetHeight}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Est. size
        </span>
        <span className="text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
          {estimating
            ? "..."
            : estimatedSize !== null
              ? `~${formatBytes(estimatedSize)}`
              : "--"}
        </span>
      </div>
    </div>
  );
}
