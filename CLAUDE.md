# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite, http://localhost:5173/ezcrop/)
npm run build      # Type-check + build to dist/
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
npm test           # Browser regressions against a built app (install Playwright Chromium first)
npm run check      # Lint, TypeScript/build, and browser regressions
```

The maintained regression suite is in `tests/`; it starts local development and production-preview servers automatically. Historical audit evidence is in `docs/audit/baseline/` and generated local results are in ignored `output/`.

## Architecture

EZCrop is a client-side-only React + TypeScript + Tailwind CSS app (Vite). All image processing runs in the browser — nothing is uploaded to a server.

### App phases

The app cycles through three phases managed in `App.tsx`: `upload` → `edit` → `exporting`. Phase drives which UI panels render.

### Data flow

1. **`useImageLoader`** (`src/hooks/useImageLoader.ts`) — Accepts a `File`, validates the MIME type, verifies the browser can decode it, and produces an object URL. No manual EXIF handling: modern browsers apply EXIF orientation automatically and consistently for rendering, `naturalWidth`/`naturalHeight`, and canvas `drawImage`.
2. **`useCropState`** (`src/hooks/useCropState.ts`) — All crop interaction state: the `PercentCrop` from `react-image-crop`, zoom level, active preset, custom dimensions, and derived `targetWidth`/`targetHeight`. All presets—including "custom"—lock the crop box to the output aspect ratio at ~90% of the image, so export resizes the selection (crop + resize in one step). Custom simply lets the user type arbitrary output dimensions; dragging repositions/resizes the selection without changing them.
3. **`useExportPipeline`** (`src/hooks/useExportPipeline.ts`) — Orchestrates export. Crops the image to a canvas (`cropUtils.ts`), then resizes and encodes in a paired Web Worker, with page-side resizing where OffscreenCanvas is unavailable. JPEG/WebP retain native page encoding as a fallback; AVIF encoding stays in a worker with a 120-second deadline. Downloads the result via a temporary `<a>` element.

### Export pipeline detail

- **Worker path** (`src/workers/encode.worker.ts`): Uses `OffscreenCanvas` + pica (high-quality downscaling) or native `drawImage` (upscaling). Each worker retains one Comlink proxy; they are disposed together. Worker is recycled every 2 uses; pica instance every 5. Export job identity and `cancelExport()` prevent obsolete downloads and state updates when images change.
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
