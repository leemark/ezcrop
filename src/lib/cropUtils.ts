import type { CropArea } from "../types";

export function getCroppedCanvas(
  image: HTMLImageElement,
  cropArea: CropArea,
): HTMLCanvasElement {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const sourceValues = [cropArea.x, cropArea.y, cropArea.width, cropArea.height];
  if (
    !sourceWidth ||
    !sourceHeight ||
    !sourceValues.every(Number.isFinite) ||
    cropArea.x < 0 ||
    cropArea.y < 0 ||
    cropArea.width <= 0 ||
    cropArea.height <= 0 ||
    cropArea.x + cropArea.width > sourceWidth + 1e-6 ||
    cropArea.y + cropArea.height > sourceHeight + 1e-6
  ) {
    throw new RangeError("Invalid crop geometry");
  }

  const rasterWidth = Math.max(1, Math.round(cropArea.width));
  const rasterHeight = Math.max(1, Math.round(cropArea.height));
  const canvas = document.createElement("canvas");
  try {
    canvas.width = rasterWidth;
    canvas.height = rasterHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height,
      0, 0, rasterWidth, rasterHeight);
    return canvas;
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  }
}

export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
