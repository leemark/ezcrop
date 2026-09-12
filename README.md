# EZCrop

Crop, resize, and download one image at a time, entirely in your browser.

**[Open EZCrop](https://leemark.github.io/ezcrop/)**

## Prepare an image

1. Click the upload area or drop a file onto it. JPEG, PNG, WebP, AVIF, GIF, and BMP depend on your browser's decoder; TIFF support varies. If a file cannot be opened, try a JPEG or PNG copy.
2. Choose a preset, enter a **Custom** output size, or select **Freeform**. Presets and Custom keep the crop locked to the output proportions; custom dimensions must be whole numbers from **1 to 7,680 pixels**. Freeform keeps your current selection and lets you adjust each edge independently. Its output dimensions follow the selected source pixels, with proportional reduction only when a side exceeds 7,680 pixels.
3. Drag the selection or its handles to compose the crop. Use the arrow keys to move a focused selection. Presets and Custom also provide a zoom slider: at 1× the crop can reach the full source width or height, and matching proportions allow the whole image. Freeform uses the crop handles instead of a zoom slider. Moving the crop, blurring an unchanged custom field, or changing only output resolution at the same aspect keeps your composition.
4. Choose WebP, JPEG, or AVIF and a quality from 60–100. Start around 80–85, then compare your result. File size depends on the image, format, and settings; the preview is an estimate.
5. Select **Export Image**. The download is named `{original-name}_{width}x{height}.{extension}`. For example: `photo_1200x630.webp`.

Selecting **Upload a different image** cancels the pending export. A previous image must never download after you switch to a new one.

The mobile editor has width/height fit modes and supports touch crop movement. Theme selection follows your system initially and is saved when browser storage is available.

## Choosing a format

| Format | Useful for | Transparency |
| --- | --- | --- |
| WebP | Everyday web images with a useful quality/size balance | Preserved |
| JPEG | Broad compatibility, especially photographs | Not supported; transparent areas become black |
| AVIF | Compact images when encoding time and viewing support are acceptable | Preserved |

AVIF runs in the background so that you can switch images while it encodes. A slow AVIF export has a two-minute limit; if it cannot finish, try smaller dimensions or JPEG/WebP. AVIF requires background-processing support in the browser. If it is unavailable, choose JPEG or WebP.

No format is always the smallest. Unsupported native encoders show an error instead of downloading another format under the wrong extension. Animated inputs are exported as a still frame. Very small crops enlarged to large outputs cannot recover missing detail, and large outputs need more memory and processing time.

## Privacy and offline use

Image processing happens on your device. Photos are not uploaded. The page downloads application assets and requests its display fonts from Google Fonts.

Keep the page open for offline work. The worker and AVIF encoder are loaded when needed, so **first-use AVIF requires an online connection to download its encoder assets**. JPEG/WebP can fall back to local browser encoding if the worker cannot load. If AVIF is unavailable offline, reconnect and retry or choose JPEG/WebP. An offline first visit or reload is not guaranteed; EZCrop does not install an offline cache.

## Browser verification

Use a recent browser. The repair report records the exact Chrome, Edge, Firefox, and Playwright WebKit versions and scenarios tested. Automated WebKit and mobile viewport/touch emulation do not prove behavior on physical Safari/iOS or Android devices. Device-specific image formats, very large outputs, memory limits, and encoding speeds can vary.

The original findings and evidence are in [the audit baseline](AUDIT_AND_REPAIR_PLAN.md); implementation and verification results are recorded in [the repair report](REPAIRS.md).

## Development and verification

The release workflow uses Node.js 24 and locked dependencies:

```sh
npm ci
npx playwright install chromium
npm run check
npm run dev
```

`npm run check` runs lint, the TypeScript/production build, and the browser regressions. `npm test` requires an existing production build and automatically starts/stops loopback development and preview servers. The tests cover export lifetime/cancellation, crop geometry, dimension validation, image/estimate races, formats, and accessible presentation. Generated results go into the ignored `output/` directory.

Install additional Playwright browsers with `npx playwright install firefox webkit`. WebKit AVIF file checks also use Chromium as an independent decoder because the Windows WebKit build cannot display AVIF. Set `EZCROP_BROWSER` to `firefox`, `webkit`, `chrome`, or `edge` before `npm test` to run that engine; Chrome and Edge must already be installed. The default is Playwright Chromium. For example, in PowerShell:

```powershell
$env:EZCROP_BROWSER = 'firefox'
npm test
```

To inspect the production build, run `npm run build` and `npm run preview`. Both development and production use the `/ezcrop/` base path. GitHub Pages deployment runs lint, build, and Chromium regressions before publishing `dist`.

## Credits

Built with [React](https://react.dev), [react-image-crop](https://github.com/DominicTobias/react-image-crop), [pica](https://github.com/nodeca/pica), [Comlink](https://github.com/GoogleChromeLabs/comlink), [Tailwind CSS](https://tailwindcss.com), and [jSquash AVIF](https://github.com/jamsinclair/jSquash).

## License

MIT
