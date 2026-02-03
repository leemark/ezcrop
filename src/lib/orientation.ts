import exifr from "exifr";

export async function getOrientation(file: File): Promise<number> {
  try {
    const orientation = await exifr.rotation(file);
    return orientation?.deg ?? 0;
  } catch {
    return 0;
  }
}

export function correctOrientation(
  image: HTMLImageElement,
  degrees: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  const { naturalWidth: w, naturalHeight: h } = image;
  const needsSwap = degrees === 90 || degrees === 270;

  canvas.width = needsSwap ? h : w;
  canvas.height = needsSwap ? w : h;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(image, -w / 2, -h / 2);

  return canvas;
}
