import { useState, useCallback, useEffect, useRef } from "react";
import {
  makeAspectCrop,
  centerCrop,
  type PercentCrop,
  type PixelCrop,
} from "react-image-crop";
import type { CropArea, Preset } from "../types";
import { presets } from "../lib/presets";

export function useCropState() {
  const [crop, setCrop] = useState<PercentCrop>();
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [activePreset, setActivePreset] = useState<Preset>(presets[0]);
  const [customWidth, setCustomWidth] = useState(800);
  const [customHeight, setCustomHeight] = useState(600);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const aspect =
    activePreset.id === "custom"
      ? customWidth / customHeight
      : activePreset.width / activePreset.height;

  const targetWidth =
    activePreset.id === "custom" ? customWidth : activePreset.width;
  const targetHeight =
    activePreset.id === "custom" ? customHeight : activePreset.height;

  function makeInitialCrop(img: HTMLImageElement, asp: number): PercentCrop {
    const crop = makeAspectCrop(
      { unit: "%", width: 90 },
      asp,
      img.width,
      img.height,
    );
    return centerCrop(crop, img.width, img.height);
  }

  function updateCroppedPixels(percentCrop: PercentCrop) {
    const img = imageRef.current;
    if (!img) return;
    const { naturalWidth, naturalHeight } = img;
    setCroppedAreaPixels({
      x: Math.round((percentCrop.x / 100) * naturalWidth),
      y: Math.round((percentCrop.y / 100) * naturalHeight),
      width: Math.round((percentCrop.width / 100) * naturalWidth),
      height: Math.round((percentCrop.height / 100) * naturalHeight),
    });
  }

  function zoomFromCrop(percentCrop: PercentCrop): number {
    const maxDim = Math.max(percentCrop.width, percentCrop.height);
    if (maxDim === 0) return 1;
    // zoom=1 → crop fills ~90%, zoom=3 → crop is small
    return Math.max(1, Math.min(3, 90 / maxDim));
  }

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      imageRef.current = img;
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      const initial = makeInitialCrop(img, aspect);
      setCrop(initial);
      updateCroppedPixels(initial);
      setZoom(1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aspect],
  );

  const onCropChange = useCallback(
    (_pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
      setCrop(percentCrop);
      updateCroppedPixels(percentCrop);
      setZoom(zoomFromCrop(percentCrop));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setCropForZoom = useCallback(
    (newZoom: number) => {
      const img = imageRef.current;
      if (!img || !crop) return;
      setZoom(newZoom);

      // Target crop width in percent (zoom=1 → 90%, zoom=3 → 30%)
      const targetPct = 90 / newZoom;

      // Center of current crop
      const cx = crop.x + crop.width / 2;
      const cy = crop.y + crop.height / 2;

      const newCrop = makeAspectCrop(
        { unit: "%", width: targetPct },
        aspect,
        img.width,
        img.height,
      );

      // Re-center on current center, clamped to image bounds
      newCrop.x = Math.max(0, Math.min(100 - newCrop.width, cx - newCrop.width / 2));
      newCrop.y = Math.max(0, Math.min(100 - newCrop.height, cy - newCrop.height / 2));

      setCrop(newCrop);
      updateCroppedPixels(newCrop);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crop, aspect],
  );

  // Re-center crop when aspect changes (preset switch)
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;
    const newCrop = makeInitialCrop(img, aspect);
    setCrop(newCrop);
    updateCroppedPixels(newCrop);
    setZoom(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  const selectPreset = useCallback(
    (preset: Preset) => {
      setActivePreset(preset);
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
    setCrop(undefined);
    setZoom(1);
    setCroppedAreaPixels(null);
    setImageDimensions(null);
    setActivePreset(presets[0]);
    setCustomWidth(800);
    setCustomHeight(600);
    imageRef.current = null;
  }, []);

  return {
    crop,
    zoom,
    aspect,
    croppedAreaPixels,
    onCropChange,
    onImageLoad,
    setCropForZoom,
    activePreset,
    selectPreset,
    customWidth,
    customHeight,
    updateCustomDimensions,
    targetWidth,
    targetHeight,
    resetCrop,
    imageDimensions,
  };
}
