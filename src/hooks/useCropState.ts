import { useState, useCallback, useEffect, useRef } from "react";
import type { PercentCrop, PixelCrop } from "react-image-crop";
import type { CropArea, Preset } from "../types";
import { presets } from "../lib/presets";
import {
  createBaselineCrop,
  getCropAtZoom,
  getZoomForCrop,
  isValidOutputDimension,
  type ImageSize,
} from "../lib/cropGeometry";

function toSourceCrop(percentCrop: PercentCrop, image: ImageSize): CropArea {
  return {
    x: (percentCrop.x / 100) * image.width,
    y: (percentCrop.y / 100) * image.height,
    width: (percentCrop.width / 100) * image.width,
    height: (percentCrop.height / 100) * image.height,
  };
}

function toPercentCrop(crop: CropArea, image: ImageSize): PercentCrop {
  return {
    unit: "%",
    x: (crop.x / image.width) * 100,
    y: (crop.y / image.height) * 100,
    width: (crop.width / image.width) * 100,
    height: (crop.height / image.height) * 100,
  };
}

function cropCenter(crop: CropArea) {
  return { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 };
}

function hasSameSize(left: CropArea, right: CropArea): boolean {
  return Math.abs(left.width - right.width) < 0.5 &&
    Math.abs(left.height - right.height) < 0.5;
}

export function useCropState() {
  const [crop, setCrop] = useState<PercentCrop>();
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [imageDimensions, setImageDimensions] = useState<ImageSize | null>(null);
  const [activePreset, setActivePreset] = useState<Preset>(presets[0]);
  const [customWidth, setCustomWidth] = useState(800);
  const [customHeight, setCustomHeight] = useState(600);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const baselineCropRef = useRef<CropArea | null>(null);
  const currentCropRef = useRef<CropArea | null>(null);
  const zoomRef = useRef(1);

  // Custom dimensions describe the output canvas; their ratio controls the crop.
  const targetWidth = activePreset.id === "custom" ? customWidth : activePreset.width;
  const targetHeight = activePreset.id === "custom" ? customHeight : activePreset.height;
  const aspect = targetWidth / targetHeight;

  const applyCrop = useCallback((nextCrop: CropArea, image: ImageSize) => {
    currentCropRef.current = nextCrop;
    setCrop(toPercentCrop(nextCrop, image));
    setCroppedAreaPixels(nextCrop);
  }, []);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const image = { width: img.naturalWidth, height: img.naturalHeight };
      if (!image.width || !image.height) return;

      imageRef.current = img;
      setImageDimensions(image);
      const baseline = createBaselineCrop(image, aspect);
      baselineCropRef.current = baseline;
      zoomRef.current = 1;
      setZoom(1);
      applyCrop(baseline, image);
    },
    [aspect, applyCrop],
  );

  const onCropChange = useCallback(
    (_pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
      const img = imageRef.current;
      if (!img?.naturalWidth || !img.naturalHeight) return;
      const image = { width: img.naturalWidth, height: img.naturalHeight };
      let nextCrop = toSourceCrop(percentCrop, image);
      // A handle can briefly cross its opposite edge during a pointer gesture.
      // Keep the last valid selection until the library reports positive bounds.
      if (!Object.values(nextCrop).every(Number.isFinite) ||
          nextCrop.width <= 0 || nextCrop.height <= 0) return;
      const previousCrop = currentCropRef.current;
      const baseline = baselineCropRef.current;

      if (baseline && previousCrop && !hasSameSize(previousCrop, nextCrop)) {
        const nextZoom = getZoomForCrop(nextCrop, baseline);
        nextCrop = getCropAtZoom(baseline, image, nextZoom, cropCenter(nextCrop));
        zoomRef.current = nextZoom;
        setZoom(nextZoom);
      }

      applyCrop(nextCrop, image);
    },
    [applyCrop],
  );

  const setCropForZoom = useCallback(
    (newZoom: number) => {
      const img = imageRef.current;
      const baseline = baselineCropRef.current;
      if (!img || !baseline || !Number.isFinite(newZoom)) return;
      const image = { width: img.naturalWidth, height: img.naturalHeight };
      if (!image.width || !image.height) return;

      const center = currentCropRef.current
        ? cropCenter(currentCropRef.current)
        : cropCenter(baseline);
      const nextCrop = getCropAtZoom(baseline, image, newZoom, center);
      const boundedZoom = getZoomForCrop(nextCrop, baseline);
      zoomRef.current = boundedZoom;
      setZoom(boundedZoom);
      applyCrop(nextCrop, image);
    },
    [applyCrop],
  );

  // An aspect change refits around the current center at the current zoom. An
  // output-size change with the same ratio leaves the source selection intact.
  useEffect(() => {
    const img = imageRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;
    const image = { width: img.naturalWidth, height: img.naturalHeight };
    const nextBaseline = createBaselineCrop(image, aspect);
    const center = currentCropRef.current
      ? cropCenter(currentCropRef.current)
      : cropCenter(nextBaseline);
    const nextCrop = getCropAtZoom(nextBaseline, image, zoomRef.current, center);

    baselineCropRef.current = nextBaseline;
    applyCrop(nextCrop, image);
  }, [aspect, applyCrop]);

  const selectPreset = useCallback((preset: Preset) => {
    setActivePreset(preset);
  }, []);

  const updateCustomDimensions = useCallback(
    (width: number, height: number) => {
      if (!isValidOutputDimension(width) || !isValidOutputDimension(height)) return;
      if (width === customWidth && height === customHeight) return;
      setCustomWidth(width);
      setCustomHeight(height);
    },
    [customWidth, customHeight],
  );

  const resetCrop = useCallback(() => {
    setCrop(undefined);
    zoomRef.current = 1;
    setZoom(1);
    currentCropRef.current = null;
    baselineCropRef.current = null;
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
