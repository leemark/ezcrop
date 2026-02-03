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

  const updateCroppedPixels = useCallback((pixelCrop: PixelCrop) => {
    const img = imageRef.current;
    if (!img || pixelCrop.width <= 0 || pixelCrop.height <= 0) {
      setCroppedAreaPixels(null);
      return;
    }

    const renderedWidth = img.width || img.naturalWidth;
    const renderedHeight = img.height || img.naturalHeight;
    const scaleX = img.naturalWidth / renderedWidth;
    const scaleY = img.naturalHeight / renderedHeight;

    const x = Math.round(pixelCrop.x * scaleX);
    const y = Math.round(pixelCrop.y * scaleY);
    const width = Math.round(pixelCrop.width * scaleX);
    const height = Math.round(pixelCrop.height * scaleY);

    setCroppedAreaPixels({ x, y, width, height });
  }, []);

  const pixelCropFromPercent = useCallback(
    (percentCrop: PercentCrop) => {
      const img = imageRef.current;
      if (!img) return null;
      const renderedWidth = img.width || img.naturalWidth;
      const renderedHeight = img.height || img.naturalHeight;
      return {
        unit: "px",
        x: (percentCrop.x / 100) * renderedWidth,
        y: (percentCrop.y / 100) * renderedHeight,
        width: (percentCrop.width / 100) * renderedWidth,
        height: (percentCrop.height / 100) * renderedHeight,
      } satisfies PixelCrop;
    },
    [],
  );

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
      const pixelCrop = pixelCropFromPercent(nextCrop);
      if (pixelCrop) {
        updateCroppedPixels(pixelCrop);
      }
    },
    [aspect, crop, createCenteredCrop, pixelCropFromPercent, updateCroppedPixels],
  );

  const onCropChange = useCallback(
    (_pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
      setCrop(percentCrop);
      updateCroppedPixels(_pixelCrop);
      setZoom(zoomFromCrop(percentCrop));
    },
    [updateCroppedPixels],
  );

  const onCropComplete = useCallback(
    (pixelCrop: PixelCrop) => {
      updateCroppedPixels(pixelCrop);
    },
    [updateCroppedPixels],
  );

  const onImageLoad = useCallback(
    (image: HTMLImageElement) => {
      imageRef.current = image;
      const nextCrop = createCenteredCrop(image, aspect);
      setCrop(nextCrop);
      const pixelCrop = pixelCropFromPercent(nextCrop);
      if (pixelCrop) {
        updateCroppedPixels(pixelCrop);
      }
      setZoom(zoomFromCrop(nextCrop));
    },
    [aspect, createCenteredCrop, pixelCropFromPercent, updateCroppedPixels],
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
    const pixelCrop = pixelCropFromPercent(nextCrop);
    if (pixelCrop) {
      updateCroppedPixels(pixelCrop);
    }
    setZoom(zoomFromCrop(nextCrop));
  }, [aspect, createCenteredCrop, pixelCropFromPercent, updateCroppedPixels]);

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
