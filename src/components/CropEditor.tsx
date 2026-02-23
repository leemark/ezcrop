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
  return (
    <div className="relative flex flex-1 flex-col items-center">
      <div className="flex flex-1 items-center justify-center p-4">
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
            className="block max-h-[70vh] max-w-full rounded-lg"
            alt="Crop source"
          />
        </ReactCrop>
      </div>
      <div className="flex w-full items-center gap-3 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <label className="font-syne text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500">
          Zoom
        </label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-200 dark:bg-zinc-700"
        />
        <span className="w-10 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {zoom.toFixed(1)}×
        </span>
      </div>
    </div>
  );
}
