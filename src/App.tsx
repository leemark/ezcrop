import { useState, useCallback, useEffect } from "react";
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
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("ezcrop-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("ezcrop-theme", "light");
    }
  }, [isDark]);

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
      <div className="relative min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
        <DarkToggle isDark={isDark} onToggle={() => setIsDark((d) => !d)} className="absolute right-4 top-4" />
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
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-xs text-zinc-500">{originalFile?.name}</div>
            {(cropState.imageDimensions || originalFile) && (
              <div className="font-mono text-xs text-zinc-500">
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
          <DarkToggle isDark={isDark} onToggle={() => setIsDark((d) => !d)} />
        </div>
      </header>

      <main className="flex flex-1 flex-col md:flex-row">
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
      </main>

      <Footer />
    </div>
  );
}

function DarkToggle({
  isDark,
  onToggle,
  className = "",
}: {
  isDark: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${className}`}
    >
      {isDark ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-zinc-200 px-4 py-2 font-mono text-xs tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
      <span>All processing happens in your browser — nothing is uploaded.</span>
      <span>
        &copy; {new Date().getFullYear()}{" "}
        <a
          href="https://themarklee.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Mark Lee
        </a>{" "}-&nbsp;
        <a
          href="https://github.com/leemark/ezcrop"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          github:leemark/ezcrop
        </a>
      </span>
    </footer>
  );
}
