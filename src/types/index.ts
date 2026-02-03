export interface Preset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropPoint {
  x: number;
  y: number;
}

export type OutputFormat = "webp" | "jpeg" | "avif";

export type AppPhase = "upload" | "edit" | "exporting";

export interface ExportSettings {
  format: OutputFormat;
  quality: number;
}

export interface EncodeRequest {
  imageData: ImageData;
  targetWidth: number;
  targetHeight: number;
  format: OutputFormat;
  quality: number;
}

export interface EncodeResult {
  blob: Blob;
  width: number;
  height: number;
}
