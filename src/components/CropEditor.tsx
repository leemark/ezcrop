import { useEffect, useRef, useState } from "react";
import ReactCrop, { type PixelCrop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface CropEditorProps {
  imageUrl: string;
  crop: PercentCrop | undefined;
  zoom: number;
  aspect: number | undefined;
  onCropChange: (pixelCrop: PixelCrop, percentCrop: PercentCrop) => void;
  onZoomChange: (zoom: number) => void;
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

export function CropEditor({
  imageUrl,
  crop,
  zoom,
  aspect,
  onCropChange,
  onZoomChange,
  onImageLoad,
}: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [fitToHeight, setFitToHeight] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center">
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center p-4"
      >
        <ReactCrop
          crop={crop}
          onChange={onCropChange}
          {...(aspect ? { aspect } : {})}
          keepSelection
          ruleOfThirds
        >
          <img
            src={imageUrl}
            onLoad={onImageLoad}
            className="block max-w-full rounded-lg"
            style={
              fitToHeight && containerHeight
                ? { maxHeight: containerHeight - 32 }
                : { maxHeight: "70vh" }
            }
            alt="Crop source"
          />
        </ReactCrop>
      </div>
      <div className="flex w-full items-center gap-3 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <label className="font-syne text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
          Zoom
        </label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          aria-label="Zoom"
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-200 dark:bg-zinc-700"
        />
        <span className="w-10 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {zoom.toFixed(1)}×
        </span>
        <button
          onClick={() => setFitToHeight((v) => !v)}
          aria-label={fitToHeight ? "Switch to fit width" : "Switch to fit height"}
          aria-pressed={fitToHeight}
          title={fitToHeight ? "Fit to width" : "Fit to height"}
          className={`rounded p-1 transition-colors ${
            fitToHeight
              ? "text-amber-500"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          >
            <line x1="2" y1="1" x2="12" y2="1" />
            <line x1="7" y1="3" x2="7" y2="11" />
            <polyline points="4,4 7,1 10,4" />
            <polyline points="4,10 7,13 10,10" />
            <line x1="2" y1="13" x2="12" y2="13" />
          </svg>
        </button>
      </div>
    </div>
  );
}
