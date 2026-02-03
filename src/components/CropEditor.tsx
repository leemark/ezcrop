import Cropper from "react-easy-crop";
import type { CropArea, CropPoint } from "../types";

interface CropEditorProps {
  imageUrl: string;
  crop: CropPoint;
  zoom: number;
  aspect: number;
  onCropChange: (crop: CropPoint) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (croppedArea: CropArea, croppedAreaPixels: CropArea) => void;
}

export function CropEditor({
  imageUrl,
  crop,
  zoom,
  aspect,
  onCropChange,
  onZoomChange,
  onCropComplete,
}: CropEditorProps) {
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="relative flex-1" style={{ minHeight: 300 }}>
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
          classes={{
            containerClassName: "rounded-lg",
          }}
        />
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
