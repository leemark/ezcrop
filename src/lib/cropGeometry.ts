import type { CropArea } from "../types";

export interface ImageSize {
  width: number;
  height: number;
}

export interface CropCenter {
  x: number;
  y: number;
}

export const MIN_CROP_ZOOM = 1;
export const MAX_CROP_ZOOM = 3;

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function assertValidImageAndAspect(
  image: ImageSize,
  aspect: number,
): void {
  if (
    !isPositiveFinite(image.width) ||
    !isPositiveFinite(image.height) ||
    !isPositiveFinite(aspect)
  ) {
    throw new RangeError("Image dimensions and crop aspect must be positive and finite");
  }
}

/** Largest centered crop of the requested aspect inside a fraction of the source. */
export function createBaselineCrop(
  image: ImageSize,
  aspect: number,
  boundsFraction = 0.9,
): CropArea {
  assertValidImageAndAspect(image, aspect);
  if (!isPositiveFinite(boundsFraction) || boundsFraction > 1) {
    throw new RangeError("Crop bounds fraction must be greater than 0 and at most 1");
  }

  const maxWidth = image.width * boundsFraction;
  const maxHeight = image.height * boundsFraction;
  let width: number;
  let height: number;

  if (maxWidth / maxHeight > aspect) {
    height = maxHeight;
    width = height * aspect;
  } else {
    width = maxWidth;
    height = width / aspect;
  }

  return {
    x: (image.width - width) / 2,
    y: (image.height - height) / 2,
    width,
    height,
  };
}

/** Return the baseline crop scaled by zoom, preserving and clamping its center. */
export function getCropAtZoom(
  baseline: CropArea,
  image: ImageSize,
  zoom: number,
  center: CropCenter = {
    x: baseline.x + baseline.width / 2,
    y: baseline.y + baseline.height / 2,
  },
): CropArea {
  assertValidImageAndAspect(image, 1);
  if (
    !isPositiveFinite(baseline.width) ||
    !isPositiveFinite(baseline.height) ||
    !Number.isFinite(baseline.x) ||
    !Number.isFinite(baseline.y) ||
    baseline.width > image.width ||
    baseline.height > image.height ||
    !Number.isFinite(center.x) ||
    !Number.isFinite(center.y) ||
    !Number.isFinite(zoom)
  ) {
    throw new RangeError("Invalid crop geometry");
  }

  const boundedZoom = clamp(zoom, MIN_CROP_ZOOM, MAX_CROP_ZOOM);
  const width = baseline.width / boundedZoom;
  const height = baseline.height / boundedZoom;
  const x = clamp(center.x - width / 2, 0, image.width - width);
  const y = clamp(center.y - height / 2, 0, image.height - height);

  return { x, y, width, height };
}

/** Derive zoom from the same baseline dimensions used to construct the crop. */
export function getZoomForCrop(crop: CropArea, baseline: CropArea): number {
  if (
    !isPositiveFinite(crop.width) ||
    !isPositiveFinite(crop.height) ||
    !isPositiveFinite(baseline.width) ||
    !isPositiveFinite(baseline.height)
  ) {
    throw new RangeError("Invalid crop geometry");
  }

  const widthZoom = baseline.width / crop.width;
  const heightZoom = baseline.height / crop.height;
  return clamp((widthZoom + heightZoom) / 2, MIN_CROP_ZOOM, MAX_CROP_ZOOM);
}

export function isValidOutputDimension(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 1 && value <= 7680;
}
