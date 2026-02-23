import { useState, useCallback } from "react";
import type { AppPhase, OutputFormat } from "./types";
import { useImageLoader } from "./hooks/useImageLoader";
import { useCropState } from "./hooks/useCropState";
import { useExportPipeline } from "./hooks/useExportPipeline";
import { UploadZone } from "./components/UploadZone";
import { CropEditor } from "./components/CropEditor";
import { Sidebar } from "./components/Sidebar";

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("upload");
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(85);

  const { imageUrl, originalFile, error: loadError, loading, loadFile, reset: resetImage } = useImageLoader();
  const cropState = useCropState();
  const { exporting, error: exportError, exportImage } = useExportPipeline();

  const handleFile = useCallback(
    async (file: File) => {
      await loadFile(file);
      cropState.resetCrop();
      setPhase("edit");
    },
    [loadFile, cropState],
  );

  const handleExport = useCallback(() => {
    if (!imageUrl || !originalFile || !cropState.croppedAreaPixels) return;
    setPhase("exporting");
    exportImage(
      imageUrl,
      originalFile.name,
      cropState.croppedAreaPixels,
      cropState.targetWidth,
      cropState.targetHeight,
      format,
      quality,
    ).finally(() => setPhase("edit"));
  }, [
    imageUrl,
    originalFile,
    cropState.croppedAreaPixels,
    cropState.targetWidth,
    cropState.targetHeight,
    format,
    quality,
    exportImage,
  ]);

  const handleReset = useCallback(() => {
    resetImage();
    cropState.resetCrop();
    setPhase("upload");
  }, [resetImage, cropState]);

  if (phase === "upload" || !imageUrl) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
        <UploadZone onFile={handleFile} loading={loading} error={loadError} />
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <h1 className="font-syne text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          EZCrop
        </h1>
        <div className="text-right">
          <div className="font-mono text-xs text-zinc-400">{originalFile?.name}</div>
          {(cropState.imageDimensions || originalFile) && (
            <div className="font-mono text-xs text-zinc-400">
              {cropState.imageDimensions &&
                `${cropState.imageDimensions.width} × ${cropState.imageDimensions.height}`}
              {cropState.imageDimensions && originalFile && " · "}
              {originalFile &&
                (originalFile.size < 1024
                  ? `${originalFile.size} B`
                  : originalFile.size < 1024 * 1024
                    ? `${(originalFile.size / 1024).toFixed(1)} KB`
                    : `${(originalFile.size / (1024 * 1024)).toFixed(1)} MB`)}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <CropEditor
          imageUrl={imageUrl}
          crop={cropState.crop}
          zoom={cropState.zoom}
          aspect={cropState.aspect}
          onCropChange={cropState.onCropChange}
          onZoomChange={cropState.setCropForZoom}
          onImageLoad={cropState.onImageLoad}
        />
        <Sidebar
          imageUrl={imageUrl}
          activePreset={cropState.activePreset}
          onPresetSelect={cropState.selectPreset}
          customWidth={cropState.customWidth}
          customHeight={cropState.customHeight}
          onCustomChange={cropState.updateCustomDimensions}
          targetWidth={cropState.targetWidth}
          targetHeight={cropState.targetHeight}
          format={format}
          onFormatChange={setFormat}
          quality={quality}
          onQualityChange={setQuality}
          croppedAreaPixels={cropState.croppedAreaPixels}
          exporting={exporting || phase === "exporting"}
          onExport={handleExport}
          onReset={handleReset}
          exportError={exportError}
        />
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-200 px-4 py-2 text-center font-mono text-[10px] tracking-wider text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
      All processing happens in your browser — nothing is uploaded.
    </footer>
  );
}
