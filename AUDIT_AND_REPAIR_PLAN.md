# EZCrop audit and repair plan

Audit date: September 11–12, 2026. Repository: [leemark/ezcrop](https://github.com/leemark/ezcrop). Local checkout: `C:\Users\mark\Documents\EZCrop`.

Audited commit: [`f4c39b9be2f0e6da76d6e4db40f71488bc763511`](https://github.com/leemark/ezcrop/tree/f4c39b9be2f0e6da76d6e4db40f71488bc763511). The clone matches the revision reviewed during planning; there were no intervening changes to reconcile.

The core upload, crop, and export workflow works, and the inspected downloads contain valid image data. The main repair priorities are export lifetime and cancellation, consistent crop geometry, mobile preview sizing, dimension validation, and accessibility. Several additional asynchronous-state defects were reproduced with controlled completion timing. Dependency advisories concern development/build tools in this locked tree; they do not establish an image-upload or visitor-data vulnerability in the published static app.

This historical baseline records the audit before repairs. Implementation results are tracked in [the repair and verification report](REPAIRS.md). This phase delivered the verified audit and repair plan. Product source, dependency versions, and the lockfile remain unchanged. No product repairs, commits, pushes, or deployment were performed. The baseline contains this report and selected synthetic audit evidence. Original machine-result paths identify the local audit environment. Archived probe scripts preserve the original method; the maintained regression suite added during repairs supersedes those machine-specific runners.

## Execution and evidence

| Check | Result and scope |
| --- | --- |
| Clone and baseline | Full repository clone; 37 tracked files reviewed. Local revision equals the planned revision. |
| Locked installation | `npm ci --no-audit --fund=false` passed; 199 packages installed. [Installation log](docs/audit/baseline/audit/npm-ci.log). |
| Lint | Passed with only the generated `output/**` audit artifacts excluded. No tracked application/configuration files were excluded. [Lint log](docs/audit/baseline/audit/lint.log). |
| TypeScript and production build | `npm run build`, including `tsc -b`, passed. Vite 7.3.1 built 63 modules. [Build log](docs/audit/baseline/audit/build.log). |
| Complete dependency audit | Completed against the locked tree. Nonzero exit is expected because advisories were found: 14 affected package names, 16 installed instances, 34 distinct advisories; 10 high, 3 moderate, 1 low package-level severities; no critical. [Raw npm audit](docs/audit/baseline/audit/npm-audit.json). |
| Local production app | Served the built output at `http://127.0.0.1:4173/ezcrop/`. JavaScript, CSS, worker, and AVIF assets resolve under the deployment subpath. |
| Local development app | Served at `http://127.0.0.1:5173/ezcrop/`. Actual hooks and normal-app 600×600 WebP/AVIF exports passed; worker and AVIF JS/WASM requests returned 200, with no page/console errors or request failures. Exported AVIF re-uploaded correctly. [Final smoke evidence](docs/audit/baseline/audit/final-smoke.json). |
| Existing test infrastructure | The repository has no test script or checked-in automated test suite. Audit-only browser and hook probes were added outside product source. |
| Changes | Tracked source and dependency diff remained empty after execution. Dependencies were installed from the lockfile without applying fixes. |

The runtime was bundled Node 24.19.0 with Playwright 1.62.1. Browser runs used local headless browsers on Windows, synthetic fixtures, and actual downloads. File signatures, decoded dimensions, representative pixel samples, byte counts, and SHA-256 hashes were inspected using an independent decoder. These are functional image checks, not a visual-quality benchmark across photographic subjects.

### Browser and scenario coverage

| Browser | Evidence obtained | Limits |
| --- | --- | --- |
| Installed Chrome 151.0.7922.176 | Nine preset dimensions/aspects; desktop 1440×1000 and mobile 390×844 layouts; all three export formats; mouse, keyboard, emulated touch, quality, input, orientation, transparency, large-image, offline, cancellation, and fault-injection cases. | No physical Android device, mobile file-provider/share-sheet testing, or full screen-reader session. |
| Installed Edge 152.0.4191.66 | Nine presets, desktop/mobile layout, keyboard crop/zoom behavior, quality range, and valid WebP/JPEG/AVIF exports. | The larger input/failure matrix was concentrated in Chrome. |
| Bundled Firefox 153.0 | JPEG and WebP exported at 1600×1600; all nine paced preset dimensions/aspects passed; 390×844 layout had no horizontal overflow. | AVIF at 1600×1600 produced no download within the 28-second cap despite successful asset responses and no visible error. Two earlier rapid preset sequences timed out; paced success does not isolate why. See O01 below. |
| Bundled WebKit 26.5 | Desktop/mobile layouts, preset aspects, quality controls, and all three valid exports. The initially sampled Rectangle Short aspect passed a settled-layout recheck. | This is a Playwright WebKit build on Windows, not Apple Safari or an iOS device. |

[Production browser matrix](docs/audit/baseline/audit/browser-matrix.json), [Firefox matrix retry](docs/audit/baseline/audit/browser-matrix-firefox.json), [Firefox isolated diagnostic](docs/audit/baseline/audit/firefox-diagnostic.json), [WebKit settled-layout recheck](docs/audit/baseline/audit/webkit-preset-recheck.json).

| Use case | Observed result |
| --- | --- |
| Normal export | Chrome, Edge, and WebKit each produced real WebP, JPEG, and AVIF at 600×600, with correct extensions and expected quadrant colors. JPEG dimensions/orientation were also verified at 300×200 and 200×300. |
| Quality | UI endpoints are 60 and 100. A detailed 12 MP fixture exported to 600×600 JPEG measured 45,631 bytes at 60 and 499,522 bytes at 100. Encoding responds to the setting; size is content-dependent. |
| Presets | All nine standard output sizes and crop aspects worked in Chrome/Edge. WebKit's one initial stale-layout sample passed a targeted recheck. Same-aspect size changes still reset composition (F03). |
| Custom dimensions | Ordinary values work. Zero, negative, and empty entries revert to the existing value. `600.5` silently becomes `600`; `1e3` becomes `1`; `7681` is accepted. A valid 1×7680 request reaches a zero-sized intermediate-canvas failure (F04). |
| Mouse / keyboard / touch | Keyboard file-picker activation, mouse crop movement, arrow-key crop movement, range-slider keys, and emulated Chromium touch crop movement worked. Moving a crop exposes the zoom inconsistency (F03). |
| Image input | Chrome accepted JPEG, PNG, WebP, BMP, GIF, and a 1×1 PNG. Corrupt PNG and unsupported SVG were rejected. Advertised TIFF failed to decode (F13). A generated AVIF re-uploaded with correct 600×600 natural dimensions in the development app. |
| EXIF phone-photo orientation | All eight EXIF orientations passed in Chrome: displayed dimensions and exported corner colors matched independently normalized expectations, with zero sample-channel error for the chosen JPEG fixtures. |
| Transparency | WebP and AVIF preserved alpha at transparent corners. JPEG produced opaque black corners, without explaining the matte behavior (F14). |
| Replacement / repeated export | An obsolete image downloaded after a replacement was active. Forced garbage collection released the Comlink connection; the next export waited about 20 seconds before fallback (F01–F02). |
| Worker fallback | Disabling OffscreenCanvas before boot allowed all three formats to download through the main-thread path. Blocking a first worker load through offline mode triggered delayed fallback (F10). |
| Offline | In an already-open fresh app, first WebP/JPEG exports eventually succeeded after about 20 seconds; first AVIF failed with a technical dynamic-import error. An offline reload/new visit is not supported by a service worker. |
| Large images | Synthetic 12 MP and 24 MP JPEGs loaded and exported to 600×600. Measured main-thread scheduling gaps peaked at about 553 ms and 778 ms. These shared-machine observations require isolated profiling before setting a performance budget. |
| Privacy / network | Normal observed requests were asset/font GETs; no image uploads were observed. Authored source contains no image-upload, beacon, socket, or dynamic-HTML/eval path. Google Fonts is an external request separate from image processing. |
| Theme / filename | Normal dark-mode persistence worked. Injected denied storage made the app blank (F11). An unbroken 180-character name expanded a 390 px page to 1,447 px (F12). |

[Input, orientation, alpha, and large-image evidence](docs/audit/baseline/audit/browser-inputs.json), [edge cases](docs/audit/baseline/audit/browser-edges.json), [interaction and worker evidence](docs/audit/baseline/audit/interactions.json), [contrast, dimensions, and quality evidence](docs/audit/baseline/audit/final-details.json).

Screenshots were visually inspected: [desktop](docs/audit/baseline/playwright/chrome-desktop.png), [mobile](docs/audit/baseline/playwright/chrome-mobile.png), [long filename](docs/audit/baseline/playwright/long-unbroken-name.png), and [dark upload screen](docs/audit/baseline/playwright/dark-upload.png). Normal mobile controls remain reachable by scrolling. The fit-height failure and horizontal overflow are separate, reproduced problems.

## Findings and bounded repairs

P1 means a high-priority core-workflow or development-security repair. P2 means a reproducible defect or accessibility/usability problem with a narrower trigger. P3 means a limited-impact issue or a follow-up that needs stronger evidence. No P0 was identified. A successful probe that reproduces a defect is evidence of failure, not a passed product acceptance criterion.

### F01 — P1: worker proxy can be garbage-collected while the worker is retained

**Reproduction and impact:** Export a small image to 600×600 WebP, force Chrome garbage collection, then export again. The captured worker messages show `APPLY`, result, `RELEASE`, and a subsequent unanswered `APPLY`. The worker terminates approximately 20 seconds later and main-thread fallback completes the export. This explains intermittent delays on otherwise trivial jobs.

**Source:** [useExportPipeline.ts:89](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useExportPipeline.ts#L89) creates a temporary proxy per export while keeping the worker in a ref. Comlink 4.4.2 registers proxy finalizers that release the endpoint; releasing the exposed endpoint removes its message listener. [Tagged Comlink implementation](https://github.com/GoogleChromeLabs/comlink/blob/v4.4.2/src/comlink.ts).

**Repair:** Keep one typed Comlink proxy alongside each worker. Reuse that pair, and release/terminate and clear both together. Ensure obsolete jobs cannot dispose of a newer pair. Retain bounded timeout/fallback recovery, but handle worker startup/error events promptly.

**Regression:** Run several small exports across worker reset boundaries, forcing GC between them. Assert correct files/pixels, no premature `RELEASE`, no unanswered call, and no 20-second timeout. Verify explicit disposal and genuine worker failure separately.

### F02 — P1: replacing the image does not cancel its pending export

**Reproduction and impact:** Start a second export in the F01 stalled-worker condition, select “Upload a different image,” and load `replacement.png`. Approximately 20.6 seconds later `first_600x600.webp` downloads while the header identifies the replacement. Old errors and completion callbacks can also affect the new session because they have no job identity check.

**Source:** [useExportPipeline.ts:132](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useExportPipeline.ts#L132) unconditionally downloads and updates status; [App.tsx:52](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/App.tsx#L52) unconditionally restores the edit phase; [App.tsx:64](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/App.tsx#L64) resets without cancellation. The switch-image control remains available in [Sidebar.tsx:88](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/Sidebar.tsx#L88).

**Repair:** Implement internal `cancelExport()` with a monotonically increasing job/session identity. Cancel before replacement/reset; terminate the active worker and invalidate stale results, errors, fallback work, and completion callbacks. Main-thread work that cannot be interrupted must still be prevented from downloading or changing current state. Keep the user's selected cancel-and-switch behavior.

**Regression:** Replace during image decode, worker encoding, worker timeout, and main-thread fallback. Assert no old download/error, no new-job status changes from old callbacks, and a successful export of the replacement. Test reset/unmount as well.

### F03 — P1: zoom and composition use inconsistent geometry

**Reproduction and impact:** On a 1200×800 image, choose Vertical Narrow and move zoom from 1 to 3: the crop stays at 27.7778% width and 100% height. With a square crop at 3×, moving it by keyboard changes the displayed zoom to 2× without resizing it. Changing a square output-size preset also reinitializes the selection. The earlier 4000×2000 planning fixture showed 3× becoming 1.5×; the ratio depends on source orientation.

**Source:** [useCropState.ts:54](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useCropState.ts#L54) derives zoom from the larger percentage dimension, whereas [line 90](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useCropState.ts#L90) derives width directly from `90 / zoom`. [Line 117](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useCropState.ts#L117) reinitializes on preset identity changes.

**Repair:** Derive an aspect-correct baseline crop once from source dimensions and output aspect. Compute both displayed zoom and crop width/height from that same baseline. Preserve center when zooming; pure movement must preserve zoom. Preserve the full source selection when only output resolution changes at the same aspect. For an actual aspect change, preserve center while fitting valid bounds.

**Regression:** Landscape, portrait, and square sources × square, horizontal, and vertical presets at 1×/2×/3×. Assert monotonic crop shrinkage, round-trip zoom consistency, unchanged size after movement, and unchanged selection after same-aspect resolution changes.

### F04 — P2: custom validation and rounding can destroy composition or create an empty canvas

**Reproduction and impact:** Blur an unchanged custom field after zooming: a roughly 315×236 px displayed crop expands to 933×700 px. Enter `7681`: it is accepted despite the field's maximum. `1e3` is misread as `1`. Set 1×7680 on the landscape fixture and export: `drawImage` reports a canvas width or height of zero. Valid extreme output ratios therefore cannot reliably be used.

**Source:** [PresetPicker.tsx:91](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/PresetPicker.tsx#L91) parses and commits on every blur without enforcing the maximum; [useCropState.ts:134](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useCropState.ts#L134) re-fits even unchanged dimensions and lacks an upper bound. [Line 47](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useCropState.ts#L47) rounds source coordinates too early; [cropUtils.ts:7](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/cropUtils.ts#L7) passes resulting dimensions straight to a canvas.

**Repair:** Enforce finite integer output dimensions from 1 through 7,680 in state and at the export boundary. Reject malformed/fractional entries with concise field feedback; handle numeric notation consistently rather than partially parsing it. Skip unchanged commits. Preserve selection for same-aspect changes. Keep fractional source coordinates and only round raster dimensions, with at least one pixel in each valid intermediate canvas. Reject genuinely invalid geometry before encoding.

**Regression:** Blank, zero, negative, fractional, exponent, non-finite, 7,680, and 7,681 values; unchanged blur/Enter; valid 1×7680, 7680×1, and 1×1 exports decoded with correct dimensions. Check maximum-square allocation on appropriate devices before claiming all 7,680-square exports are practical.

### F05 — P2: mobile “Fit to height” feeds its own measured height back into layout

**Reproduction and impact:** At 390×844, load the landscape fixture and toggle fit height. Chrome/Edge shrink the preview from about 358×239 to 64.5×43 px; WebKit settles near 66×44 px. The crop becomes too small for useful touch composition.

**Source:** [CropEditor.tsx:28](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/CropEditor.tsx#L28) observes a content-dependent container and [line 59](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/CropEditor.tsx#L59) sets the image height from that measurement minus padding.

**Repair:** Calculate available preview height from a stable viewport/layout budget independent of the image's resulting height. Avoid repeated padding subtraction and observer feedback. Keep a usable preview area alongside scrollable controls.

**Regression:** Toggle repeatedly at 320/390/768 px widths, portrait/landscape orientation, both fit modes, and multiple source aspects. Assert stable dimensions across frames/resizes, no collapse or overflow, and usable crop movement/handles.

### F06 — P2: essential text lacks contrast, and Custom does not expose its selected state

**Reproduction and impact:** The 14 px export label and 12 px selected format label are white on RGB(254,154,0), measuring **2.13:1**. Supported-format text measures **1.42:1 light / 1.70:1 dark**; inactive preset labels measure **2.51:1 light / 3.67:1 dark**; the dark footer measures **3.67:1**. These are normal-size text and fall below [WCAG's 4.5:1 requirement](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Custom is visually selected without `aria-pressed`.

**Source:** [ExportButton.tsx:16](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/ExportButton.tsx#L16), [FormatSelector.tsx:29](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/FormatSelector.tsx#L29), [UploadZone.tsx:134](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/UploadZone.tsx#L134), [PresetPicker.tsx:135](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/PresetPicker.tsx#L135), and [App.tsx:181](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/App.tsx#L181).

**Repair:** Adjust the relevant text/background pairs in both themes, including selected/hover/focus states. Dark text on the current amber background is a bounded way to retain the brand color. Add Custom's selected semantics. Keep clear keyboard focus; strengthen its contrast where needed. Crop handles and the small fit control deserve physical touch validation before claiming mobile accessibility.

**Regression:** Measure every affected normal-text pair at ≥4.5:1. Verify Custom's selected state and usable keyboard order. Chrome exposes visible native focus outlines for upload and preset controls, and keyboard/touch movement worked; this is not a full accessibility conformance result. Standard preset hitboxes measured 38×50 px, so their 10 px visual labels should not be mistaken for the entire hit area.

### F07 — P2: overlapping image loads can overwrite the newer selection

**Reproduction and impact:** In a harness importing the real hook, hold two decode completions; finish the newer file first and the older file second. The older file becomes active. Hold a decode, reset, then complete it: the reset image reappears. These are controlled timing reproductions, not a claimed failure on every ordinary file selection.

**Source:** [useImageLoader.ts:39](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useImageLoader.ts#L39), result assignments at lines 65–66, and reset at line 80. The loading upload zone can still accept another drop.

**Repair:** Use last-request-wins identity, advanced on each load and reset. Ignore obsolete success/error completions, revoke their object URLs, and release active URLs on unmount. Have the load operation communicate current success so App only resets crop/phase for an accepted current image.

**Regression:** Controlled reverse completion, old failure after new success, reset during decode, and unmount. Verify both the chosen image and object-URL cleanup. [Hook evidence](docs/audit/baseline/audit/hooks/results.json).

### F08 — P3: clearing estimate inputs can leave busy state or publish an obsolete size

**Reproduction and impact:** In the actual-hook harness, change valid inputs to null during the debounce: estimating remains true. Clear inputs while `toBlob` is pending, then complete it: the old estimate (`27`) is published. A separate valid-to-valid quality change correctly suppressed its old result. The normal app often unmounts the sidebar during replacement, which limits visible impact; do not describe all quality changes as broken.

**Source:** [useFileSizeEstimate.ts:21](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useFileSizeEstimate.ts#L21) clears the size but neither invalidates the generation nor clears busy state. [Line 106](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useFileSizeEstimate.ts#L106) only clears the timer.

**Repair:** Invalidate pending work on invalid inputs and cleanup; clear both size and busy state. Keep the valid-to-valid generation checks that already work. Preserve the estimate's approximate label rather than promising exact bytes.

**Regression:** Clear during debounce and encode; assert null size, false busy, and no stale publication. Retain the passing quality-change race test.

### F09 — P2, conditional: native encoder fallback can create a wrongly named download

**Reproduction and impact:** Inject a PNG Blob returned for a WebP request into each native encoder path. Both actual encoder functions accept it unchanged. Download naming follows the requested format, so such a fallback can produce PNG bytes with a `.webp` name. Current successful browser exports did not naturally exhibit this fallback.

**Source:** [encoding.ts:22](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/encoding.ts#L22) accepts every non-null `toBlob` result; [line 56](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/encoding.ts#L56) accepts `convertToBlob` without MIME validation; [useExportPipeline.ts:132](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useExportPipeline.ts#L132) names by requested format. Native canvas APIs can fall back to PNG when an encoder is unsupported. [Canvas API behavior](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).

**Repair:** Verify the actual Blob MIME type against the requested supported format before download in both paths. Reject mismatches with an actionable unsupported-format message; do not relabel bytes. A capability check may disable an unsupported option while leaving JPEG available.

**Regression:** Inject wrong MIME, null Blob, and correct MIME; assert mismatches never download and normal results keep their true extensions/signatures. Keep real-browser export checks alongside these controlled tests.

### F10 — P2: offline/startup failures wait for a timeout and expose implementation errors

**Reproduction and impact:** Load a fresh production page and image, then take the context offline before the first export. WebP/JPEG eventually download after 20.2 seconds, consistent with the worker-startup timeout. AVIF fails with a raw “Failed to fetch dynamically imported module” URL. The README's “100% offline after it loads” promise is false for lazily loaded encoder assets.

**Source:** [useExportPipeline.ts:82](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useExportPipeline.ts#L82) starts the worker without prompt error-event recovery; the 20-second timeout is at line 14. [encoding.ts:11](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/encoding.ts#L11) lazily imports AVIF, and [README.md:63](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/README.md#L63) overstates offline behavior.

**Repair:** Handle worker error/message-error/startup failures immediately and fall back where encoding is locally available. Explain that first-use AVIF needs encoder assets downloaded while online. Translate fetch/initialization failures into guidance to reconnect and retry or choose JPEG/WebP. Preserve browser-only processing; offline caching/installability is not part of this phase's selected repair scope.

**Regression:** Fresh uncached offline export, failed worker script, missing AVIF module/WASM, successful reconnect/retry, and a previously loaded encoder while offline. Assert timely recovery and understandable messages without exposing local/module URLs.

### F11 — P2, conditional: denied theme storage prevents the app from rendering

**Reproduction and impact:** Make Storage `getItem` and `setItem` throw `SecurityError` before page boot. The body becomes blank and page errors are recorded. This simulates restricted storage; no particular browser's default private mode is claimed to fail.

**Source:** [index.html:36](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/index.html#L36) reads storage unguarded; [App.tsx:21](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/App.tsx#L21) writes it unguarded.

**Repair:** Make theme persistence best-effort with guarded read/write. Fall back to system preference and in-memory selection when storage is unavailable.

**Regression:** Deny reads, writes, and both separately; upload and export remain usable, with no uncaught startup error. Preserve normal reload persistence.

### F12 — P2: long filenames cause horizontal mobile overflow

**Reproduction and impact:** Upload a PNG with an unbroken 180-character basename at 390 px viewport width. Document width becomes 1,447 px; the header and theme control extend beyond the screen.

**Source:** [App.tsx:89](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/App.tsx#L89), the non-shrinking filename/header layout.

**Repair:** Allow the filename container to shrink; truncate or wrap the visual name within the available width while preserving access to the full name. Keep image dimensions and theme controls visible.

**Regression:** Long unbroken, spaced, Unicode, and ordinary names at 320/390 px and desktop widths. Assert no horizontal overflow or overlapping controls and an accessible complete name.

### F13 — P2: input, custom-crop, and browser-support documentation is misleading

**Reproduction and impact:** Chrome rejects a valid TIFF with “Failed to load image,” although TIFF is listed without qualification. README says Custom is unconstrained and preserves a 1:1 final pixel scale; actual code locks its aspect and resizes to the entered output dimensions. README's Chrome/Edge 90, Firefox 88, and Safari 15 minimums also predate the stated support baseline of the installed Tailwind 4 styling system. [Tailwind compatibility documentation](https://tailwindcss.com/docs/compatibility) lists Chrome 111, Firefox 128, and Safari 16.4; that is a framework floor, not proof of complete EZCrop support at those versions.

**Source:** [useImageLoader.ts:3](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useImageLoader.ts#L3), [UploadZone.tsx:134](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/UploadZone.tsx#L134), [README.md:11](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/README.md#L11), [line 34](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/README.md#L34), [line 41](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/README.md#L41), and [line 70](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/README.md#L70).

**Repair:** Document aspect-locked crop plus resize for Custom, consistent with the implementation and project architecture. Qualify TIFF and other browser-dependent decoders and provide a useful decode error suggesting conversion to JPEG/PNG. State actually tested browsers separately from minimum framework requirements; remove unverified support/version and universal “smallest format” claims. Correct the export-hang explanation in light of F01 and offline text in F10. Do not add a TIFF decoder or redesign Custom solely to match stale prose.

**Regression:** Walk through the revised instructions against the app. Verify each named input type on the stated browser set and label conditional support. Ensure format failure offers a usable next step.

### F14 — P2 usability: JPEG silently replaces transparent pixels with black

**Reproduction and impact:** Upload the transparent PNG fixture and export JPEG. Transparent corner samples change from alpha 0 to opaque RGB(0,0,0). WebP and AVIF retain alpha. JPEG cannot carry alpha; the problem is the unexplained result for users preparing logos/overlays, not invalid JPEG encoding.

**Source:** [encoding.ts:22](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/encoding.ts#L22) and [line 56](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/encoding.ts#L56) encode without an explicit matte policy; [FormatSelector.tsx:8](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/FormatSelector.tsx#L8) gives no transparency guidance.

**Repair:** Add concise JPEG transparency guidance recommending WebP/AVIF when alpha matters. If changing matte behavior is included in the subsequent implementation scope, use one explicit documented background policy consistently in preview and both export paths; do not silently introduce a new default as incidental cleanup.

**Regression:** Transparent and opaque fixtures in all formats. Assert alpha preservation for WebP/AVIF, the documented JPEG matte, and visibility of the guidance before export.

### F15 — P1 for development tooling: the locked dependency tree has applicable advisories

**Reproduction and impact:** Run the complete npm audit against the original lockfile. It reports the affected versions in the dependency appendix below. All 16 affected installed entries are marked development dependencies; Vite is the only directly affected declared dependency. Risk ranges from development-server file access and Windows editor-path behavior to attacks requiring malicious build inputs, glob patterns, YAML, or cache data. None of these findings alone demonstrates a vulnerability in a visitor's local photo processing.

**Source:** [package-lock.json](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/package-lock.json), [package.json](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/package.json), and the linked primary advisories in the appendix.

**Repair:** Update only applicable packages within compatible declared ranges to at least the verified patched floors. Reconcile transitive duplicate versions, preserve the locked installation workflow, and inspect the resulting lockfile diff. Avoid a forced broad major-version upgrade. Continue binding audit/dev servers to loopback; some Windows editor-path conditions require their own mitigation and are not fully addressed by bind address alone.

**Regression:** Fresh locked installation, full dependency audit, lint, TypeScript/build, and a production-subpath smoke export in all formats. No existing advisory should remain unexplained; new audit results must be evaluated at update time. Verify the local development app and its worker/AVIF paths after the Vite-related update.

## Implementation sequence and completion gates

| Order | Work package | Concrete completion gate |
| --- | --- | --- |
| 1 | Add focused regressions for export lifecycle; implement F01 and F02 together. | Repeated GC-stressed exports work without timeout; switching images cancels all obsolete effects; genuine worker failures recover. |
| 2 | Use one crop geometry model for F03–F04. | Consistent zoom in every source orientation; movement/unchanged blur/same-aspect output changes preserve selection; invalid dimensions stop before encoding; extreme valid ratios decode correctly. |
| 3 | Repair F07 image-load identity and F08 estimate invalidation. | Newest load wins; reset remains reset; stale estimates cannot publish; existing valid-to-valid estimate protection remains intact. |
| 4 | Repair F05, F06, F11, and F12. | Stable mobile preview and reflow; required contrast and selected semantics; storage failure cannot blank the app; focus/touch checks pass. |
| 5 | Add F09 MIME validation; resolve F10 startup/offline handling; update F13–F14 guidance. | Downloads' actual types agree with names; unsupported/offline paths explain a next step; written instructions match behavior. |
| 6 | Apply F15 compatible dependency maintenance in a separately reviewable change. | Reviewed lockfile, refreshed full audit, and all relevant build/browser checks pass. This can begin alongside the independent product repairs. |
| 7 | Validate the integrated result and separately prepare publishing. | Re-run defect regressions and representative image matrix; resolve Firefox repeatability; test real Safari/iOS and Android before advertising device support. Publishing requires its own implementation/release scope. |

Do not turn the baseline audit probes into tautological tests: their current assertions often confirm that a defect exists. Repair tests must assert the intended behavior described above. Keep deterministic hook/geometry tests small and retain real-browser downloads for canvas/worker/MIME behavior. The repository deployment workflow currently builds without lint or regression-test gates; add the relevant checks when the repair tests exist. No additional service, framework, multi-image workflow, or offline-install feature is needed for this plan.

## Explicit limits and unresolved observations

**O01 — provisional P2 investigation: Firefox AVIF responsiveness.** A fresh Firefox 153 production context, synthetic 96×72 input, default 1600×1600 output, AVIF, and quality 85 produced no download within 28 seconds. The worker and AVIF JS/WASM responses succeeded (200/304); no page/console error, failed request, or alert appeared. This proves the bounded responsiveness test failed, not that encoding could never finish. Relevant paths are [worker encoding](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/workers/encode.worker.ts#L43), [AVIF encoding](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/encoding.ts#L42), and [worker timeout/fallback](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useExportPipeline.ts#L92). Investigate with stage timings at 600/1600 output sizes in an isolated headed Firefox run after F01/F02; distinguish codec cost, worker restart/fallback, and browser automation before changing code. The eventual repair must either complete with a valid AVIF in an agreed measured budget or show a recoverable/cancellable failure. Preserve this reproduction as a release check. [Final smoke evidence](docs/audit/baseline/audit/final-smoke.json).

- Real Safari on macOS/iOS, physical Android, file-provider/share-sheet interactions, low-memory devices, screen readers, and older advertised browser versions were not tested. Browser viewport/touch emulation is not device evidence.
- Firefox's two original rapid-preset timeouts remain a narrowly scoped repeatability concern: the final paced pass completed all nine presets, and a plain-page 12-click control also passed. No speculative production fix should be based on the initial timeouts alone. [Firefox mobile screenshot](docs/audit/baseline/audit/final-smoke-mobile.png).
- Large-image runs succeeded, but the observed 0.55–0.78 second main-thread gaps were measured while other audit work shared the machine. Profile the existing decode/crop/estimate work in isolation before assigning a performance regression or adding workers. HEIC/RAW, HDR/wide-gamut/ICC fidelity, animation-frame choice, 48+ MP sources, and maximum-area AVIF memory pressure remain untested. GIF acceptance was tested; animated export is not claimed.
- The stale-load/estimate and wrong-MIME findings use controlled timing or fault injection. They prove the relevant state/encoding behavior; they do not measure its natural frequency. Forced GC similarly makes an intermittent lifetime problem deterministic.
- The static review covered every tracked file and relevant runtime call paths. It was not a line-by-line audit of all vendor code, a full Git-history secret scan, an exploit exercise, or a formal accessibility certification.
- The complete dependency audit is a dated advisory snapshot, not a guarantee that all possible vulnerabilities are known. Detailed applicability below distinguishes development tooling from shipped image functionality.
- Local production-path success and the already-published app review do not constitute a new deployment verification. No live site was changed.

## Reproduction inventory

The synthetic fixtures and expected orientation samples are recorded in [fixture manifest](docs/audit/baseline/audit/fixtures/manifest.json). Downloaded artifacts are retained in [the export evidence folder](docs/audit/baseline/playwright/exports). Browser results contain file paths, signatures, dimensions, selected pixels, hashes, and failure details. Some recorded elapsed times include automation/file-reading/decoding overhead and must not be treated as isolated encoder benchmarks.

Audit-only runners: [browser scenarios](docs/audit/baseline/audit/browser-audit.cjs), [interaction and recovery checks](docs/audit/baseline/audit/interactions.cjs), [contrast and input checks](docs/audit/baseline/audit/final-details.cjs), and [actual-hook probes](docs/audit/baseline/audit/hooks/run-probes.cjs). The hook probes have seven assertions, including the passing valid-to-valid estimate control. Audit runners depend on the documented bundled local Playwright/sharp runtime; they are evidence scripts, not a newly adopted portable project test suite.

The appendices below account for every tracked file and every advisory in the complete locked-tree audit.


## Appendix A — tracked-file coverage checklist

Every row below was reviewed at the audited commit. “No defect found” describes the reviewed scope; it is not a proof that no defect can exist.

| Tracked file | Review coverage | Result / linked work |
| --- | --- | --- |
| [.github/workflows/deploy.yml](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/.github/workflows/deploy.yml) | Build/upload/deploy graph, permissions, concurrency, Node/npm setup. | Build works locally; no hosted workflow triggered; add repair-test gates later. |
| [.gitignore](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/.gitignore) | Generated dependency/build artifacts and repository hygiene. | No defect found; audit output remains visibly untracked. |
| [CLAUDE.md](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/CLAUDE.md) | Architecture and intended single-image custom-output semantics. | Compared with code and stale README instructions (F13). |
| [README.md](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/README.md) | Feature, input, custom crop, offline, browser, export and deployment claims. | F10, F13; no product change merely to satisfy stale instructions. |
| [eslint.config.js](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/eslint.config.js) | TypeScript/React rule scope and build-output ignores. | Baseline lint passed. |
| [index.html](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/index.html) | Boot, theme storage, metadata, asset URLs and external fonts. | F11; production subpath loads; Google Fonts requests identified. |
| [package-lock.json](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/package-lock.json) | Locked versions, all audit findings, duplicate paths and dev/runtime classification. | F15; installed without edits. |
| [package.json](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/package.json) | Scripts, dependency ranges and declared product libraries. | Build/lint pass; no pre-existing test script; F15. |
| [public/favicon.svg](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/public/favicon.svg) | Static SVG content and referenced asset. | No executable/dynamic content issue identified. |
| [public/robots.txt](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/public/robots.txt) | Crawler instructions and sitemap pointer. | Consistent with published location. |
| [public/sitemap.xml](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/public/sitemap.xml) | Canonical deployment URL and XML content. | Consistent with /ezcrop/. |
| [src/App.tsx](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/App.tsx) | Phase transitions, replacement, export callbacks, theme, header and footer. | F02, F06, F07, F11, F12. |
| [src/app.css](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/app.css) | Tailwind/theme settings, slider styles and crop-handle overrides. | Visually inspected; F06 and browser baseline limits. |
| [src/components/CropEditor.tsx](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/CropEditor.tsx) | Crop/zoom integration, fit sizing, observer lifetime and controls. | F03, F05; mouse/keyboard/emulated-touch checks. |
| [src/components/ExportButton.tsx](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/ExportButton.tsx) | Disabled/busy state, naming and contrast. | F06; obsolete-job ownership is addressed in F02. |
| [src/components/ExportPreview.tsx](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/ExportPreview.tsx) | Target dimensions, estimate and busy presentation. | Checked with F04/F08; estimate remains explicitly approximate. |
| [src/components/FormatSelector.tsx](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/FormatSelector.tsx) | Format choices, labels, hints, selected state and contrast. | F06, F09, F14. |
| [src/components/PresetPicker.tsx](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/PresetPicker.tsx) | All presets, custom parsing, field bounds and accessibility. | F03, F04, F06. |
| [src/components/QualitySlider.tsx](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/QualitySlider.tsx) | Range, step, labeling and keyboard behavior. | 60/100 endpoints and actual JPEG size response passed. |
| [src/components/Sidebar.tsx](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/Sidebar.tsx) | Component wiring, estimate lifetime, export gating and reset availability. | F02/F08; normal controls and narrow layout checked. |
| [src/components/UploadZone.tsx](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/components/UploadZone.tsx) | File picker, drag/drop, keyboard activation, loading and errors. | F06, F07, F13; zone upload interactions passed. |
| [src/hooks/useCropState.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useCropState.ts) | Source/output geometry, zoom inverse, presets, custom updates and reset. | F03, F04. |
| [src/hooks/useExportPipeline.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useExportPipeline.ts) | Worker/proxy lifetime, timeout, fallback, download and cleanup. | F01, F02, F09, F10; real downloads and fault cases. |
| [src/hooks/useFileSizeEstimate.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useFileSizeEstimate.ts) | Debounce, generation checks, cleanup, preview sizing and estimate math. | F08; valid-to-valid race control passed. |
| [src/hooks/useImageLoader.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/hooks/useImageLoader.ts) | Accepted MIME list, decode, EXIF assumptions, URL lifetime and races. | F07/F13; eight EXIF cases passed. |
| [src/lib/cropUtils.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/cropUtils.ts) | Source rect extraction, raster sizing and ImageData access. | F04; representative export pixels inspected. |
| [src/lib/download.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/download.ts) | Blob URL, download anchor and URL cleanup. | Normal download works; cancellation ownership is upstream F02. |
| [src/lib/encoding.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/encoding.ts) | Native/WASM formats, quality, lazy imports and MIME handling. | F09, F10, F14; actual formats and injected fallback tested. |
| [src/lib/fileNaming.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/fileNaming.ts) | Base-name extraction, path-separator replacement and extension mapping. | Observed outputs match normal name/dimension convention; MIME safety F09. |
| [src/lib/presets.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/lib/presets.ts) | Every preset dimension, aspect and custom sentinel. | Nine preset values checked against UI. |
| [src/main.tsx](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/main.tsx) | React root, StrictMode and stylesheet boot. | Normal boot passes; injected storage fault reaches F11. |
| [src/types/index.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/types/index.ts) | Crop, format, request/result, phase and preset contracts. | Runtime dimension validation still needed in F04. |
| [src/workers/encode.worker.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/src/workers/encode.worker.ts) | Transfer payload, offscreen source/target, down/upscale and encoding. | F01/F02 lifecycle at caller; all formats/fallback paths exercised. |
| [tsconfig.app.json](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/tsconfig.app.json) | Application strictness, module/JSX and build scope. | TypeScript build passed. |
| [tsconfig.json](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/tsconfig.json) | Project references. | TypeScript build passed. |
| [tsconfig.node.json](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/tsconfig.node.json) | Build/config TypeScript compilation. | TypeScript build passed. |
| [vite.config.ts](https://github.com/leemark/ezcrop/blob/f4c39b9be2f0e6da76d6e4db40f71488bc763511/vite.config.ts) | Base path, React/Tailwind plugins, AVIF optimization exclusion, worker format. | Production subpath and emitted encoder assets verified; F15. |

## Appendix B — locked dependency findings and compatible repair floors

The floors below were checked against the primary advisories and installed dependency paths. They are compatible patch/minor maintenance targets within the existing declared ranges; they are not a recommendation to freeze future updates at these versions. Neither the manifest nor the lockfile was changed.

| Package | Locked affected versions | Verified patched floor | Applicability in EZCrop |
| --- | --- | --- | --- |
| @babel/core | 7.29.0 | 7.29.6 | Vite React plugin and ESLint React Hooks tooling. Arbitrary read requires attacker-controlled compiled input/source-map path and observable output. |
| @humanfs/node | 0.16.7 | 0.16.8 | ESLint dependency. Symlink-following copy needs adversarial paths and copy/copyAll use; those APIs are not called by authored application code. |
| ajv | 6.12.6 | 6.14.0 | ESLint/@eslint/eslintrc validation. Reported regex DoS requires $data validation with malicious data; no such application path identified. |
| baseline-browser-mapping | 2.9.19 | 2.11.0 | Browserslist tooling chain. Invalid API parameters can exit the process; application users do not control these parameters. |
| brace-expansion | 2.0.2; 1.1.12 | 1.1.18; 2.1.4 | Minimatch in lint/TypeScript tooling; root 1.x and nested 2.x copies both affected. Malicious patterns can consume CPU/memory; photo filenames are not used as these patterns. |
| browserslist | 4.28.1 | 4.28.7 | Babel target resolution. Cache growth/custom statistics/prototype cases need attacker-controlled queries or statistics, not photo data. |
| flatted | 3.3.3 | 3.4.2 | ESLint file-entry-cache → flat-cache. Malicious serialized cache can exhaust resources or affect object state; current lint command does not enable its cache. |
| js-yaml | 4.1.1 | 4.3.2 | ESLint/@eslint/eslintrc YAML parsing. Merge/omap resource attacks require malicious YAML; browser image data never reaches this parser. This is not an audit of the GitHub Actions service parser. |
| minimatch | 9.0.5; 3.1.2 | 3.1.4; 9.0.7 | ESLint and nested @typescript-eslint/typescript-estree copies. Malicious glob patterns can cause excessive matching cost; no visitor-provided glob path. |
| nanoid | 3.3.11 | 3.3.18 | Vite → PostCSS. Size-validation defects require problematic size arguments; installed PostCSS calls nanoid(6), a fixed positive size. |
| picomatch | 4.0.3 | 4.0.4 | Vite/tinyglobby pattern matching. Adversarial glob patterns can cause incorrect matching or excessive matching work. The POSIX-method advisory does not enable remote code execution; neither issue is a browser photo-input path. |
| postcss | 8.5.6 | 8.5.23 | Vite build CSS processing. Source-map read/traversal defects require crafted CSS/maps; style-close escaping concerns arise when embedding untrusted CSS in HTML. Neither is a photo-processing feature here. |
| rollup | 4.57.1 | 4.59.0 | Vite build bundler. Arbitrary output-path write requires attacker-controlled output names/inputs/plugins. No such external-input workflow found in this repo. |
| vite | 7.3.1 | 7.3.5 | Direct development dependency. Dev-server path/query/WebSocket disclosure conditions matter when an attacker can reach the server. Windows launch-editor UNC/credential-disclosure behavior has separate attacker-induced request conditions; loopback alone is not a universal mitigation. Published GitHub Pages serves static output, not the Vite server. |

The two duplicate package families are minimatch (3.x/9.x) and brace-expansion (1.x/2.x); their nested copies sit under `node_modules/@typescript-eslint/typescript-estree/node_modules` in the locked installation. The complete package audit is 14 names / 16 installed affected entries / 34 distinct advisories. All affected entries have `dev: true`. Package-level severity counts are npm’s rollup, not 34 independently exploitable product defects.

### Advisory-by-advisory inventory

Each link below identifies the primary advisory supporting the affected-range and repair-floor assessment above. Read the package applicability alongside the title; titles alone do not establish reachability in this app.

| Package | Advisory | Advisory severity | Affected range in audit |
| --- | --- | --- | --- |
| @babel/core | [GHSA-4x5r-pxfx-6jf8: @babel/core: Arbitrary File Read via sourceMappingURL Comment](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) | low | `<=7.29.0` |
| @humanfs/node | [GHSA-p498-v437-472g: humanfs: Recursive copy follows symlinked files and copies data from outside the source tree](https://github.com/advisories/GHSA-p498-v437-472g) | moderate | `<0.16.8` |
| ajv | [GHSA-2g4f-4pwh-qvx6: ajv has ReDoS when using `$data` option](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | moderate | `<6.14.0` |
| baseline-browser-mapping | [GHSA-w5vr-8v7q-w6rv: baseline-browser-mapping process termination on invalid input causes denial of service](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | moderate | `>=2.0.0 <2.11.0` |
| brace-expansion | [GHSA-3jxr-9vmj-r5cp: brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | high | `>=2.0.0 <2.1.2` or `<1.1.16` |
| brace-expansion | [GHSA-f886-m6hf-6m8v: brace-expansion: Zero-step sequence causes process hang and memory exhaustion](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | moderate | `<1.1.13` or `>=2.0.0 <2.0.3` |
| brace-expansion | [GHSA-mh99-v99m-4gvg: brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | high | `<1.1.17` or `>=2.0.0 <2.1.3` |
| brace-expansion | [GHSA-rgw5-rvv9-x895: brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | high | `>=2.0.0 <2.1.4` or `<1.1.18` |
| browserslist | [GHSA-73wf-gq98-2v4g: Browserslist: Uncaught crash / prototype write via untrusted browserslist-stats.json custom stats (normalizeStats)](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | high | `<=4.28.6` |
| browserslist | [GHSA-c83g-rgw3-j3cx: Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | high | `<=4.28.6` |
| flatted | [GHSA-25h7-pfq9-p65f: flatted vulnerable to unbounded recursion DoS in parse() revive phase](https://github.com/advisories/GHSA-25h7-pfq9-p65f) | high | `<3.4.0` |
| flatted | [GHSA-rf6f-7fwh-wjgh: Prototype Pollution via parse() in NodeJS flatted](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) | high | `<=3.4.1` |
| js-yaml | [GHSA-2883-xcg3-v3hh: js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | high | `>=4.0.0 <4.3.2` |
| js-yaml | [GHSA-52cp-r559-cp3m: js-yaml: YAML merge-key chains can force quadratic CPU consumption](https://github.com/advisories/GHSA-52cp-r559-cp3m) | high | `>=4.0.0 <4.3.0` |
| js-yaml | [GHSA-5p4m-2wfm-xmqj: JS-YAML: Quadratic CPU consumption in !!omap resolution (3.x and 4.x) — CVE-2026-59870 fix not backported](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | high | `>=4.0.0 <4.3.1` |
| js-yaml | [GHSA-h67p-54hq-rp68: JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases](https://github.com/advisories/GHSA-h67p-54hq-rp68) | moderate | `>=4.0.0 <=4.1.1` |
| minimatch | [GHSA-23c5-xmqv-rm74: minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | high | `<3.1.4` or `>=9.0.0 <9.0.7` |
| minimatch | [GHSA-3ppc-4f35-3m26: minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | high | `<3.1.3` or `>=9.0.0 <9.0.6` |
| minimatch | [GHSA-7r86-cg39-jmmj: minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | high | `<3.1.3` or `>=9.0.0 <9.0.7` |
| nanoid | [GHSA-28wg-ghj8-5hjv: nanoid: non-secure generators can loop indefinitely with negative size](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | high | `<3.3.16` |
| nanoid | [GHSA-2v37-7h3g-55p8: nanoid: custom generators can loop indefinitely when size is zero](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | high | `<3.3.18` |
| nanoid | [GHSA-xwg4-73v4-xw9w: nanoid: Integer Overflow or Wraparound](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | high | `<3.3.12` |
| picomatch | [GHSA-3v7f-55p6-f55p: Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | moderate | `>=4.0.0 <4.0.4` |
| picomatch | [GHSA-c2c7-rcm5-vvqj: Picomatch has a ReDoS vulnerability via extglob quantifiers](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | high | `>=4.0.0 <4.0.4` |
| postcss | [GHSA-6g55-p6wh-862q: PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments](https://github.com/advisories/GHSA-6g55-p6wh-862q) | high | `<=8.5.11` |
| postcss | [GHSA-fxqj-rqcc-2cmp: PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | moderate | `<=8.5.22` |
| postcss | [GHSA-qx2v-qp2m-jg93: PostCSS has XSS via Unescaped </style> in its CSS Stringify Output](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | moderate | `<8.5.10` |
| postcss | [GHSA-r28c-9q8g-f849: PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849) | high | `<=8.5.17` |
| rollup | [GHSA-mw96-cpmx-2vgc: Rollup 4 has Arbitrary File Write via Path Traversal](https://github.com/advisories/GHSA-mw96-cpmx-2vgc) | high | `>=4.0.0 <4.59.0` |
| vite | [GHSA-4w7w-66w2-5vf9: Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) | moderate | `>=7.0.0 <=7.3.1` |
| vite | [GHSA-fx2h-pf6j-xcff: vite: `server.fs.deny` bypass on Windows alternate paths](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) | high | `>=7.0.0 <=7.3.4` |
| vite | [GHSA-p9ff-h696-f583: Vite Vulnerable to Arbitrary File Read via Vite Dev Server WebSocket](https://github.com/advisories/GHSA-p9ff-h696-f583) | high | `>=7.0.0 <=7.3.1` |
| vite | [GHSA-v2wj-q39q-566r: Vite: `server.fs.deny` bypassed with queries](https://github.com/advisories/GHSA-v2wj-q39q-566r) | high | `>=7.1.0 <=7.3.1` |
| vite | [GHSA-v6wh-96g9-6wx3: launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) | moderate | `>=7.0.0 <=7.3.4` |
