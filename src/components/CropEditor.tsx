import { useCallback, useEffect, useRef, useState } from "react";
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
  onUseEntireImage: () => void;
  onResetSelection: () => void;
  isFreeform?: boolean;
}

export function CropEditor({
  imageUrl,
  crop,
  zoom,
  aspect,
  onCropChange,
  onZoomChange,
  onImageLoad,
  onUseEntireImage,
  onResetSelection,
  isFreeform = false,
}: CropEditorProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [fitMode, setFitMode] = useState<"view" | "width">("view");
  const [imageMetrics, setImageMetrics] = useState<{
    source: string;
    width: number;
    height: number;
  } | null>(null);
  const [renderedSize, setRenderedSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const naturalSize = imageMetrics?.source === imageUrl ? imageMetrics : null;

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setImageMetrics({
          source: imageUrl,
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      }
      onImageLoad(event);
    },
    [imageUrl, onImageLoad],
  );

  // Keep the source image and crop controls inside the available preview frame.
  // This observes the frame rather than the image so a viewport change cannot
  // retrigger the crop-state image-load/reset path.
  useEffect(() => {
    const frame = previewRef.current;
    if (!frame || !naturalSize) return;

    const updateRenderedSize = () => {
      const frameBounds = frame.getBoundingClientRect();
      const frameStyles = window.getComputedStyle(frame);
      const horizontalPadding =
        Number.parseFloat(frameStyles.paddingLeft) + Number.parseFloat(frameStyles.paddingRight);
      const verticalPadding =
        Number.parseFloat(frameStyles.paddingTop) + Number.parseFloat(frameStyles.paddingBottom);
      const availableWidth = Math.max(0, frameBounds.width - horizontalPadding);
      const availableHeight = Math.max(0, frameBounds.height - verticalPadding);
      if (availableWidth <= 0 || availableHeight <= 0) return;

      const widthScale = availableWidth / naturalSize.width;
      const heightScale = availableHeight / naturalSize.height;
      const scale = Math.min(
        fitMode === "view" ? heightScale : Number.POSITIVE_INFINITY,
        widthScale,
        1,
      );
      const nextSize = {
        width: Math.max(1, Math.round(naturalSize.width * scale)),
        height: Math.max(1, Math.round(naturalSize.height * scale)),
      };

      setRenderedSize((previous) =>
        previous && previous.width === nextSize.width && previous.height === nextSize.height
          ? previous
          : nextSize,
      );
    };

    updateRenderedSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateRenderedSize);
      return () => window.removeEventListener("resize", updateRenderedSize);
    }

    const observer = new ResizeObserver(updateRenderedSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [fitMode, naturalSize]);

  const imageStyle = renderedSize
    ? {
        width: `${renderedSize.width}px`,
        height: `${renderedSize.height}px`,
        maxWidth: "none",
        maxHeight: "none",
      }
    : undefined;

  const fitToggleLabel = fitMode === "view" ? "Fit image to width" : "Fit image to view";

  return (
    <section className="crop-editor relative flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Crop editor">
      <div
        ref={previewRef}
        className={`editor-preview flex min-h-0 min-w-0 flex-1 justify-center overflow-auto p-4 ${fitMode === "width" ? "items-start" : "items-center"}`}
      >
        <ReactCrop
          crop={crop}
          onChange={onCropChange}
          {...(aspect ? { aspect } : {})}
          keepSelection
          ruleOfThirds
          ariaLabels={{
            cropArea: "Use the arrow keys to move the crop selection area",
            nwDragHandle: "Resize crop from the north west corner with the arrow keys.",
            nDragHandle: "Resize crop from the north edge with the up and down arrow keys.",
            neDragHandle: "Resize crop from the north east corner with the arrow keys.",
            eDragHandle: "Resize crop from the east edge with the left and right arrow keys.",
            seDragHandle: "Resize crop from the south east corner with the arrow keys.",
            sDragHandle: "Resize crop from the south edge with the up and down arrow keys.",
            swDragHandle: "Resize crop from the south west corner with the arrow keys.",
            wDragHandle: "Resize crop from the west edge with the left and right arrow keys.",
          }}
        >
          <img
            src={imageUrl}
            onLoad={handleImageLoad}
            className="block rounded-lg"
            style={imageStyle}
            alt="Crop source"
          />
        </ReactCrop>
      </div>
      <div className="editor-toolbar flex w-full flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        {isFreeform ? null : (
          <div className="zoom-controls flex min-w-[8rem] flex-1 items-center gap-2">
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
              className="range-control min-w-0 flex-1 cursor-pointer"
            />
            <span className="w-10 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              {zoom.toFixed(1)}×
            </span>
          </div>
        )}
        <div className="editor-actions flex shrink-0 flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={onUseEntireImage}
            className="min-h-11 rounded px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-amber-400"
          >
            Use entire image
          </button>
          <button
            type="button"
            onClick={onResetSelection}
            className="min-h-11 rounded px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-amber-400"
          >
            Reset crop
          </button>
        </div>
        <button
          type="button"
          onClick={() => setFitMode((mode) => (mode === "view" ? "width" : "view"))}
          aria-label={fitToggleLabel}
          aria-pressed={fitMode === "width"}
          title={fitToggleLabel}
          className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded px-2 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-400 ${
            fitMode === "width"
              ? "text-amber-700 dark:text-amber-300"
              : "text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-300"
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
          <span className="sr-only">{fitToggleLabel}</span>
        </button>
      </div>
      <p className="editor-help px-4 pb-3 text-xs text-zinc-500 dark:text-zinc-400">
        {isFreeform
          ? "Arrow keys move the crop. Output matches the selected source pixels, up to 7,680 px per side."
          : "Arrow keys move the crop. Fixed crops can zoom to 3×."}
      </p>
    </section>
  );
}
