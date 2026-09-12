import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useImageLoader } from "../src/hooks/useImageLoader";
import { useFileSizeEstimate } from "../src/hooks/useFileSizeEstimate";
import { useExportPipeline } from "../src/hooks/useExportPipeline";
import type { CropArea } from "../src/types";

// Controlled completion order reproduces real races without depending on disk/decode timing.
const NativeImage = window.Image;
const images: ControlledImage[] = [];
const revoked: string[] = [];
const blobs: { callback: BlobCallback; type: string; quality?: number }[] = [];
const loads = new Map<string, Promise<boolean>>();
const exports = new Map<string, Promise<boolean>>();
class ControlledImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() { images.push(this); }
}
Object.defineProperty(window, "Image", { configurable: true, writable: true, value: ControlledImage });
URL.createObjectURL = ((file: File) => `blob:controlled/${file.name}`) as typeof URL.createObjectURL;
URL.revokeObjectURL = (url: string) => { revoked.push(url); };
HTMLCanvasElement.prototype.toBlob = function (callback, type = "image/png", quality) {
  blobs.push({ callback, type, quality });
};
const pixel = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  return canvas.toDataURL("image/png");
})();
type Inputs = { imageUrl: string | null; crop: CropArea | null; quality: number };
type Api = {
  snapshot: { loader: { name: string | null; imageUrl: string | null; loading: boolean; error: string | null }; estimate: { estimatedSize: number | null; estimating: boolean } };
  load: (name: string) => void;
  finish: (name: string, success?: boolean) => Promise<boolean>;
  reset: () => void;
  revoked: () => string[];
  nativeImages: () => void;
  estimate: (valid: boolean, quality?: number) => void;
  blobCount: () => number;
  completeBlob: (index: number, size: number | null) => void;
  exportState: { exporting: boolean; error: string | null };
  startExport: (name: string) => void;
  waitExport: (name: string) => Promise<boolean>;
  cancelExport: () => void;
};
declare global { interface Window { ezcropTest: Api } }

export function Harness() {
  const loader = useImageLoader();
  const exporter = useExportPipeline();
  const [inputs, setInputs] = useState<Inputs>({ imageUrl: null, crop: null, quality: 80 });
  const estimate = useFileSizeEstimate(inputs.imageUrl, inputs.crop, 100, 100, "jpeg", inputs.quality);
  useEffect(() => {
    window.ezcropTest = {
      snapshot: { loader: { name: loader.originalFile?.name ?? null, imageUrl: loader.imageUrl, loading: loader.loading, error: loader.error }, estimate },
      load: name => { loads.set(name, loader.loadFile(new File([name], name, { type: "image/png" }))); },
      finish: async (name, success = true) => {
        const image = images.find(candidate => candidate.src === `blob:controlled/${name}`);
        if (!image) throw new Error(`Missing decode for ${name}`);
        if (success) image.onload?.(); else image.onerror?.();
        return (await loads.get(name)) ?? false;
      },
      reset: loader.reset,
      revoked: () => [...revoked],
      nativeImages: () => Object.defineProperty(window, "Image", { configurable: true, writable: true, value: NativeImage }),
      estimate: (valid, quality = 80) => setInputs({ imageUrl: valid ? pixel : null, crop: valid ? { x: 0, y: 0, width: 1, height: 1 } : null, quality }),
      blobCount: () => blobs.length,
      completeBlob: (index, size) => blobs[index].callback(size === null ? null : new Blob([new Uint8Array(size)], { type: blobs[index].type })),
      exportState: { exporting: exporter.exporting, error: exporter.error },
      startExport: name => { exports.set(name, exporter.exportImage(pixel, name, {x:0,y:0,width:1,height:1},100,100,"jpeg",85)); },
      waitExport: async name => (await exports.get(name)) ?? false,
      cancelExport: exporter.cancelExport,
    };
  }, [loader, estimate, exporter]);
  return <main>Controlled hook regression harness</main>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
