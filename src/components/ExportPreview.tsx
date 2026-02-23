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
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 dark:border-zinc-700/50 dark:bg-zinc-800/40">
      <div className="flex items-baseline justify-between">
        <span className="font-syne text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          Output
        </span>
        <span className="font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
          {targetWidth}×{targetHeight}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="font-syne text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          Est. size
        </span>
        <span className="font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
          {estimating
            ? "…"
            : estimatedSize !== null
              ? `~${formatBytes(estimatedSize)}`
              : "—"}
        </span>
      </div>
    </div>
  );
}
