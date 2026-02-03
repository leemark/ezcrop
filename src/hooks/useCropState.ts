import { useState, useCallback } from "react";
import type { CropArea, CropPoint, Preset } from "../types";
import { presets } from "../lib/presets";

export function useCropState() {
  const [crop, setCrop] = useState<CropPoint>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [activePreset, setActivePreset] = useState<Preset>(presets[0]);
  const [customWidth, setCustomWidth] = useState(800);
  const [customHeight, setCustomHeight] = useState(600);

  const aspect = activePreset.width / activePreset.height;

  const targetWidth =
    activePreset.id === "custom" ? customWidth : activePreset.width;
  const targetHeight =
    activePreset.id === "custom" ? customHeight : activePreset.height;

  const onCropComplete = useCallback(
    (_croppedArea: CropArea, croppedAreaPx: CropArea) => {
      setCroppedAreaPixels(croppedAreaPx);
    },
    [],
  );

  const selectPreset = useCallback(
    (preset: Preset) => {
      setActivePreset(preset);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      if (preset.id === "custom") {
        // Keep existing custom dims
      }
    },
    [],
  );

  const updateCustomDimensions = useCallback(
    (w: number, h: number) => {
      setCustomWidth(Math.max(1, Math.round(w)));
      setCustomHeight(Math.max(1, Math.round(h)));
    },
    [],
  );

  const resetCrop = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setActivePreset(presets[0]);
    setCustomWidth(800);
    setCustomHeight(600);
  }, []);

  return {
    crop,
    setCrop,
    zoom,
    setZoom,
    aspect,
    croppedAreaPixels,
    onCropComplete,
    activePreset,
    selectPreset,
    customWidth,
    customHeight,
    updateCustomDimensions,
    targetWidth,
    targetHeight,
    resetCrop,
  };
}
