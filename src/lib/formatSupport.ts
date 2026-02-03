import type { OutputFormat } from "../types";

let webpSupported: boolean | null = null;

function checkWebPSupport(): Promise<boolean> {
  if (webpSupported !== null) return Promise.resolve(webpSupported);

  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob(
      (blob) => {
        webpSupported = blob !== null;
        resolve(webpSupported);
      },
      "image/webp",
      0.5,
    );
  });
}

export async function getSupportedFormats(): Promise<OutputFormat[]> {
  const formats: OutputFormat[] = ["jpeg"];

  if (await checkWebPSupport()) {
    formats.unshift("webp");
  }

  // AVIF encoding is handled via WASM, always available
  formats.push("avif");

  return formats;
}
