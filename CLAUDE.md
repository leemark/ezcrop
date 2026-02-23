# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite, http://localhost:5173/ezcrop/)
npm run build      # Type-check + build to dist/
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
```

No test suite is configured.

## Architecture

EZCrop is a client-side-only React + TypeScript + Tailwind CSS app (Vite). All image processing runs in the browser — nothing is uploaded to a server.

### App phases

The app cycles through three phases managed in `App.tsx`: `upload` → `edit` → `exporting`. Phase drives which UI panels render.

### Data flow

1. **`useImageLoader`** (`src/hooks/useImageLoader.ts`) — Accepts a `File`, reads EXIF orientation via `exifr`, corrects rotation via canvas if needed, and produces an object URL.
2. **`useCropState`** (`src/hooks/useCropState.ts`) — All crop interaction state: the `PercentCrop` from `react-image-crop`, zoom level, active preset, custom dimensions, and derived `targetWidth`/`targetHeight`. The "custom" preset is special: `aspect` is `undefined` (free-form), and drag-resizing the crop box writes back into `customWidth`/`customHeight`.
3. **`useExportPipeline`** (`src/hooks/useExportPipeline.ts`) — Orchestrates export. Crops the image to a canvas (`cropUtils.ts`), then resizes and encodes either in a Web Worker (preferred) or main thread (fallback). Downloads the result via a temporary `<a>` element.

### Export pipeline detail

- **Worker path** (`src/workers/encode.worker.ts`): Uses `OffscreenCanvas` + pica (Lanczos downscaling) or native `drawImage` (upscaling). Exposed via Comlink. Worker is recycled every 2 uses; pica instance every 5.
- **Main thread fallback**: Same logic without OffscreenCanvas.
- **AVIF encoding**: Handled by `@jsquash/avif` (WASM), dynamically imported. `@jsquash/avif` is excluded from Vite's `optimizeDeps` to avoid bundling issues with its WASM.
- WebP and JPEG use native `canvas.toBlob` / `OffscreenCanvas.convertToBlob`.

### Presets

Defined in `src/lib/presets.ts` as a flat array of `Preset` objects. The `PresetPicker` component (`src/components/PresetPicker.tsx`) groups them visually by ID prefix (`square-*`, `rect-*`, `vert-*`, `custom`). The first preset in the array is the default active preset.

### Key types (`src/types/index.ts`)

- `CropArea` — pixel-space `{x, y, width, height}` of the selected crop region
- `Preset` — `{id, label, width, height}`
- `OutputFormat` — `"webp" | "jpeg" | "avif"`
- `AppPhase` — `"upload" | "edit" | "exporting"`
- `EncodeRequest` / `EncodeResult` — worker message contracts

### Deployment

The app is deployed to GitHub Pages at `https://leemark.github.io/ezcrop/`. The Vite `base` is set to `"/ezcrop/"` in `vite.config.ts`.
