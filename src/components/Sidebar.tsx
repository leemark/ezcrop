import type { CropArea, OutputFormat, Preset } from "../types";
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
  onCustomChange: (w: number, h: number) => void;
  targetWidth: number;
  targetHeight: number;
  format: OutputFormat;
  onFormatChange: (format: OutputFormat) => void;
  quality: number;
  onQualityChange: (quality: number) => void;
  croppedAreaPixels: CropArea | null;
  exporting: boolean;
  onExport: () => void;
  onReset: () => void;
  exportError: string | null;
}

export function Sidebar({
  imageUrl,
  activePreset,
  onPresetSelect,
  customWidth,
  customHeight,
  onCustomChange,
  targetWidth,
  targetHeight,
  format,
  onFormatChange,
  quality,
  onQualityChange,
  croppedAreaPixels,
  exporting,
  onExport,
  onReset,
  exportError,
}: SidebarProps) {
  const { estimatedSize, estimating } = useFileSizeEstimate(
    imageUrl,
    croppedAreaPixels,
    targetWidth,
    targetHeight,
    format,
    quality,
  );

  return (
    <aside aria-label="Crop options" className="flex w-full flex-col gap-4 overflow-y-auto p-4 md:w-72 md:border-l md:border-zinc-200 md:dark:border-zinc-700">
      <PresetPicker
        activePreset={activePreset}
        onSelect={onPresetSelect}
        customWidth={customWidth}
        customHeight={customHeight}
        onCustomChange={onCustomChange}
      />

      <FormatSelector format={format} onChange={onFormatChange} />

      <QualitySlider quality={quality} onChange={onQualityChange} />

      <ExportPreview
        targetWidth={targetWidth}
        targetHeight={targetHeight}
        estimatedSize={estimatedSize}
        estimating={estimating}
      />

      {exportError && (
        <p role="alert" className="text-xs text-red-500 dark:text-red-400">{exportError}</p>
      )}

      <ExportButton
        onClick={onExport}
        exporting={exporting}
        disabled={!croppedAreaPixels}
      />

      <button
        onClick={onReset}
        className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        Upload a different image
      </button>
    </aside>
  );
}
