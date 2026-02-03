import ReactCrop from "react-image-crop";
import type { Crop, PercentCrop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface CropEditorProps {
  imageUrl: string;
  crop?: Crop;
  zoom: number;
  aspect: number;
  onCropChange: (pixelCrop: PixelCrop, percentCrop: PercentCrop) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (pixelCrop: PixelCrop, percentCrop: PercentCrop) => void;
  onImageLoad: (image: HTMLImageElement) => void;
}

export function CropEditor({
  imageUrl,
  crop,
  zoom,
  aspect,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onImageLoad,
}: CropEditorProps) {
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="relative flex-1 p-2" style={{ minHeight: 300 }}>
        <ReactCrop
          crop={crop}
          onChange={onCropChange}
          onComplete={onCropComplete}
          aspect={aspect}
          keepSelection
          ruleOfThirds
          className="max-h-[70vh] w-full"
        >
          <img
            src={imageUrl}
            alt="Crop source"
            onLoad={(e) => onImageLoad(e.currentTarget)}
            className="max-h-[70vh] w-full rounded-lg object-contain"
          />
        </ReactCrop>
      </div>
      <div className="flex items-center gap-3 px-2 py-3">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Zoom
        </label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-indigo-500 dark:bg-zinc-700"
        />
        <span className="w-10 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {zoom.toFixed(1)}x
        </span>
      </div>
    </div>
  );
}
