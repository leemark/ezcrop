import type { CropArea } from "../types";

export function getCroppedCanvas(
  image: HTMLImageElement,
  cropArea: CropArea,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height,
  );

  return canvas;
}

export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
