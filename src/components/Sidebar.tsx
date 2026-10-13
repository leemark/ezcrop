import { useEffect, useRef, useState } from "react";
import type { CropArea, OutputFormat, Preset } from "../types";
import type { CompletedExport } from "../hooks/useExportPipeline";
import { PresetPicker } from "./PresetPicker";
import { FormatSelector } from "./FormatSelector";
import { QualitySlider } from "./QualitySlider";
import { ExportPreview } from "./ExportPreview";
import { ExportButton } from "./ExportButton";
import { useFileSizeEstimate } from "../hooks/useFileSizeEstimate";

interface SidebarProps {
  imageUrl: string;
  activePreset: Preset;
  onPresetSelect: (preset: Preset) => void;
  customWidth: number;
  customHeight: number;
  customDimensionsRevision: number;
  onCustomChange: (w: number, h: number) => void;
  onCustomValidityChange: (valid: boolean) => void;
  isOutputValid: boolean;
  aspectLocked: boolean;
  onAspectLockChange: (locked: boolean) => void;
  targetWidth: number;
  targetHeight: number;
  format: OutputFormat;
  onFormatChange: (format: OutputFormat) => void;
  quality: number;
  onQualityChange: (quality: number) => void;
  croppedAreaPixels: CropArea | null;
  exporting: boolean;
  onExport: () => void;
  onReplace: () => void;
  onCancel: () => void;
  exportError: string | null;
  loadError: string | null;
  loading: boolean;
  pendingExport: string | null;
  exportStatus: string;
  lastExport: CompletedExport | null;
}

export function Sidebar({
  imageUrl, activePreset, onPresetSelect, customWidth, customHeight, customDimensionsRevision,
  onCustomChange, onCustomValidityChange, isOutputValid, aspectLocked,
  onAspectLockChange, targetWidth, targetHeight, format, onFormatChange,
  quality, onQualityChange, croppedAreaPixels, exporting, onExport,
  onReplace, onCancel, exportError, loadError, loading, pendingExport,
  exportStatus, lastExport,
}: SidebarProps) {
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const exportActionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const actions = exportActionsRef.current;
    const shell = actions?.closest<HTMLElement>(".editor-shell");
    if (!actions || !shell) return;
    const update = () => shell.style.setProperty("--export-actions-height", `${actions.getBoundingClientRect().height}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(actions);
    return () => observer.disconnect();
  }, []);
  const { estimatedSize, estimating } = useFileSizeEstimate(
    imageUrl, croppedAreaPixels, targetWidth, targetHeight, format, quality, exporting,
  );
  const enlarging = croppedAreaPixels && (
    targetWidth > Math.round(croppedAreaPixels.width) ||
    targetHeight > Math.round(croppedAreaPixels.height)
  );
  const status = loading ? "Opening replacement image. Your current crop is kept until it is ready."
    : pendingExport ?? (exportStatus === "Download started." && lastExport
      ? `Download started: ${lastExport.filename} (${formatBytes(lastExport.blob.size)}).`
      : exportStatus);

  return (
    <aside aria-label="Crop options" className="crop-options flex w-full flex-col md:border-l md:border-zinc-200 md:dark:border-zinc-700">
      <div className="crop-settings flex flex-col gap-4 p-4">
        <PresetPicker
          activePreset={activePreset}
          onSelect={onPresetSelect}
          customWidth={customWidth}
          customHeight={customHeight}
          customDimensionsRevision={customDimensionsRevision}
          onCustomChange={onCustomChange}
          onValidityChange={onCustomValidityChange}
          aspectLocked={aspectLocked}
          onAspectLockChange={onAspectLockChange}
        />
        <FormatSelector format={format} onChange={onFormatChange} />
        <QualitySlider quality={quality} onChange={onQualityChange} />
        <ExportPreview targetWidth={targetWidth} targetHeight={targetHeight} estimatedSize={estimatedSize} estimating={estimating} />
        {enlarging && (
          <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            Enlarging from {Math.round(croppedAreaPixels.width)} × {Math.round(croppedAreaPixels.height)} source pixels. Detail may look soft.
          </p>
        )}
        {lastExport && <CompletedPreview result={lastExport} />}
        <button
          onClick={onReplace}
          disabled={loading}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 text-xs text-zinc-700 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Upload a different image
        </button>
        {loadError && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{loadError} Your current crop is unchanged.</p>}
      </div>
      <div ref={exportActionsRef} className="export-actions flex flex-col gap-2 border-t border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {targetWidth} × {targetHeight} · {format.toUpperCase()}
        </p>
        <p role="status" aria-live="polite" aria-atomic="true" className="max-h-24 overflow-y-auto break-words text-xs leading-relaxed text-zinc-600 empty:hidden dark:text-zinc-300">{status}</p>
        {!isOutputValid && <p className="text-xs text-red-700 dark:text-red-400">Correct the custom dimensions to export.</p>}
        {exportError && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{exportError}</p>}
        <div className="flex gap-2">
          <ExportButton buttonRef={exportButtonRef} onClick={onExport} exporting={exporting} disabled={!croppedAreaPixels || !isOutputValid || loading} />
          {exporting && (
            <button onClick={() => {
              onCancel();
              requestAnimationFrame(() => exportButtonRef.current?.focus());
            }} className="min-h-11 shrink-0 rounded-lg border border-zinc-300 px-3 text-xs text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-700 dark:border-zinc-600 dark:text-zinc-200">
              Cancel export
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function formatBytes(bytes: number): string {
  const display = bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${display}; ${bytes.toLocaleString()} bytes`;
}

function CompletedPreview({ result }: { result: CompletedExport }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  useEffect(() => {
    const url = URL.createObjectURL(result.blob);
    // Keep this local resource tied to the completed download, not live settings.
    if (imageRef.current) imageRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [result.blob]);
  return (
    <details className="rounded-lg border border-zinc-200 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">Preview downloaded image</summary>
      <p className="my-2 break-words">{result.filename}</p>
      <p className="mb-2">{result.width} × {result.height} · {result.format.toUpperCase()} · {result.quality}% quality<br />Actual size: {formatBytes(result.blob.size)}</p>
      <img ref={imageRef} alt="Last exported image" hidden={previewFailed} onLoad={() => setPreviewFailed(false)} onError={() => setPreviewFailed(true)} className="max-h-64 w-full rounded object-contain" />
      {previewFailed && <p>This browser cannot preview this format. The download has already started; try opening the file in another image viewer.</p>}
      <p className="mt-2">This is the downloaded result. Export again to compare changed settings.</p>
    </details>
  );
}
