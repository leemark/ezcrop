import { useState, useCallback, useEffect, useRef } from "react";
import type { CropArea, Preset } from "../types";
import type { PercentCrop, PixelCrop } from "react-image-crop";
import { centerCrop, makeAspectCrop } from "react-image-crop";
import { presets } from "../lib/presets";

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const INITIAL_CROP_WIDTH = 100;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function zoomFromCrop(crop: PercentCrop) {
  if (!crop.width || !crop.height) return ZOOM_MIN;
  const widthZoom = 100 / crop.width;
  const heightZoom = 100 / crop.height;
  return clamp(Math.min(widthZoom, heightZoom), ZOOM_MIN, ZOOM_MAX);
}

export function useCropState() {
  const [crop, setCrop] = useState<PercentCrop>();
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [activePreset, setActivePreset] = useState<Preset>(presets[0]);
  const [customWidth, setCustomWidth] = useState(800);
  const [customHeight, setCustomHeight] = useState(600);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const aspect = activePreset.width / activePreset.height;

  const targetWidth =
    activePreset.id === "custom" ? customWidth : activePreset.width;
  const targetHeight =
    activePreset.id === "custom" ? customHeight : activePreset.height;

  const updateCroppedPixels = useCallback((percentCrop: PercentCrop) => {
    const img = imageRef.current;
    if (!img || percentCrop.width <= 0 || percentCrop.height <= 0) {
      setCroppedAreaPixels(null);
      return;
    }

    const x = Math.round((percentCrop.x / 100) * img.naturalWidth);
    const y = Math.round((percentCrop.y / 100) * img.naturalHeight);
    const width = Math.round((percentCrop.width / 100) * img.naturalWidth);
    const height = Math.round((percentCrop.height / 100) * img.naturalHeight);

    setCroppedAreaPixels({ x, y, width, height });
  }, []);

  const createCenteredCrop = useCallback(
    (image: HTMLImageElement, aspectValue: number) => {
      const baseCrop = makeAspectCrop(
        { unit: "%", width: INITIAL_CROP_WIDTH },
        aspectValue,
        image.width,
        image.height,
      );
      return centerCrop(baseCrop, image.width, image.height);
    },
    [],
  );

  const setCropForZoom = useCallback(
    (nextZoom: number) => {
      const img = imageRef.current;
      if (!img) return;

      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      let cropWidthPx = naturalWidth / nextZoom;
      let cropHeightPx = cropWidthPx / aspect;

      if (cropHeightPx > naturalHeight) {
        cropHeightPx = naturalHeight / nextZoom;
        cropWidthPx = cropHeightPx * aspect;
      }

      const widthPercent = clamp((cropWidthPx / naturalWidth) * 100, 1, 100);
      const heightPercent = clamp((cropHeightPx / naturalHeight) * 100, 1, 100);

      const current = crop ?? createCenteredCrop(img, aspect);
      const centerX = current.x + current.width / 2;
      const centerY = current.y + current.height / 2;

      const nextCrop: PercentCrop = {
        unit: "%",
        width: widthPercent,
        height: heightPercent,
        x: clamp(centerX - widthPercent / 2, 0, 100 - widthPercent),
        y: clamp(centerY - heightPercent / 2, 0, 100 - heightPercent),
      };

      setCrop(nextCrop);
      updateCroppedPixels(nextCrop);
    },
    [aspect, crop, createCenteredCrop, updateCroppedPixels],
  );

  const onCropChange = useCallback(
    (_pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
      setCrop(percentCrop);
      updateCroppedPixels(percentCrop);
      setZoom(zoomFromCrop(percentCrop));
    },
    [updateCroppedPixels],
  );

  const onCropComplete = useCallback(
    (_pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
      updateCroppedPixels(percentCrop);
    },
    [updateCroppedPixels],
  );

  const onImageLoad = useCallback(
    (image: HTMLImageElement) => {
      imageRef.current = image;
      const nextCrop = createCenteredCrop(image, aspect);
      setCrop(nextCrop);
      updateCroppedPixels(nextCrop);
      setZoom(zoomFromCrop(nextCrop));
    },
    [aspect, createCenteredCrop, updateCroppedPixels],
  );

  const selectPreset = useCallback(
    (preset: Preset) => {
      setActivePreset(preset);
      setCroppedAreaPixels(null);
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
    setZoom(ZOOM_MIN);
    setCroppedAreaPixels(null);
    setActivePreset(presets[0]);
    setCustomWidth(800);
    setCustomHeight(600);
    imageRef.current = null;
  }, []);

  useEffect(() => {
    if (!imageRef.current) return;
    const nextCrop = createCenteredCrop(imageRef.current, aspect);
    setCrop(nextCrop);
    updateCroppedPixels(nextCrop);
    setZoom(zoomFromCrop(nextCrop));
  }, [aspect, createCenteredCrop, updateCroppedPixels]);

  const setZoomWithCrop = useCallback(
    (nextZoom: number) => {
      const clamped = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
      setZoom(clamped);
      setCropForZoom(clamped);
    },
    [setCropForZoom],
  );

  return {
    crop,
    zoom,
    setZoom: setZoomWithCrop,
    aspect,
    croppedAreaPixels,
    onImageLoad,
    onCropChange,
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
