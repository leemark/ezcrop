# EZCrop UX repairs — October 12, 2026

The six confirmed UX findings and the bounded usability improvements from [the audit](UX_AUDIT_2026-10-12.md) have been implemented. The work started from GitHub-verified commit `9b4a5d3e1d1d890c6b99dd28a36382aebe0595ca`. No dependencies were changed. This report records implementation and local verification before the separately authorized release.

## Changes

| Audit item | Implemented behavior |
| --- | --- |
| Invalid Custom drafts could export old dimensions | Invalid typed or proportionally calculated dimensions immediately disable Export. A valid edit followed directly by Export uses the new dimensions. Both sides must be whole numbers from 1 to 7,680. |
| Offline WebKit AVIF stalled before encoding | Page-side Pica no longer starts its implicit worker. Image loading, resizing, and native encoding have cancellable 20-second deadlines. AVIF remains in its dedicated worker with its existing 120-second encoding limit and useful recovery errors. |
| Pending export contradicted current settings | The live status identifies the captured dimensions, format, and quality and explains that edits apply to the next export. Completion says “Download started,” including the filename and actual size. |
| Lost keyboard focus / wrong edge instructions | Accepted uploads focus the editor heading. Replacement chooser cancellation leaves the edit intact. East/west handles describe left/right arrows. Cancel export returns focus to Export when it is enabled. |
| Light-theme upload error contrast | Upload errors use darker red in light mode and readable red in dark mode. Both themes pass the existing normal-text contrast assertion. |
| Short-screen preview and fit behavior | The default preview fits the available view; crop controls remain visible at the tested short landscape size. Width fit has a larger, scrollable preview with a reachable top and bottom. Resizing the preview preserves composition. |
| Hidden preset sizes / unclear group names | Every fixed preset visibly includes its dimensions; groups are Square, Landscape, and Portrait. Existing preset sizes and selection behavior are preserved. |
| Whole image / proportional resize | Use entire image selects the complete source, switches to Custom, and enables Keep proportions. Sources above the output limit are scaled proportionally. Linked editing validates both calculated dimensions. |
| Crop recovery | Reset crop restores the current fixed-mode baseline or the full source in Freeform, without re-uploading. |
| Enlargement guidance | The settings show the selected source dimensions and warn that enlargement may look soft. |
| Phone export access / touch controls | Narrow-screen Export controls stay at the bottom. Dynamic space keeps the final settings and footer reachable. Sliders and principal secondary controls have larger touch areas; the phone zoom slider gets its own row. |
| Tight-crop limit | Help explicitly identifies the existing 3× fixed-mode limit. Freeform continues to support independent edges. |
| Estimated versus actual size / quality | The estimate is clearly approximate. A completed download exposes exact bytes and an optional preview of that same encoded Blob, including its original settings. It does not run another encoding pass or silently change with later edits. |
| Privacy before upload | Device-local processing and HEIC-to-JPEG/PNG guidance appear beside the chooser. |
| Format tradeoffs / animation | A visible selected-format hint and still-frame warning supplement the existing JPEG transparency guidance. |
| Replacing an image discarded work | Opening or cancelling the chooser preserves the current image and crop. Choosing a file cancels an active export; replacement occurs only after the new image decodes successfully. Failed files preserve the edit and show guidance. |
| Reduced motion | Reduced-motion preferences stop the selection-border animation and export spinner. |

## Verification

TypeScript, ESLint, the production build, and whitespace checks passed. The regression suite now contains 34 cases: the existing 27 plus seven targeted UX scenarios. Existing validation and contrast checks were strengthened.

Final result: **168 passed, 0 failed, 2 intentionally skipped** across 170 browser-case runs.

| Browser / engine | Version | Passed | Failed | Skipped | Suite duration | Log |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Playwright Chromium | 151.0.7922.34 | 34 | 0 | 0 | 119.3 s | [Chromium](../output/playwright/ux-repairs-2026-10-12/chromium-final.log) |
| Firefox | 153.0 | 33 | 0 | 1 | 196.0 s | [Firefox](../output/playwright/ux-repairs-2026-10-12/firefox-final.log) |
| Playwright WebKit | 26.5 | 33 | 0 | 1 | 185.4 s | [WebKit](../output/playwright/ux-repairs-2026-10-12/webkit-final.log) |
| Installed Chrome | 154.0.8037.99 | 34 | 0 | 0 | 137.7 s | [Chrome](../output/playwright/ux-repairs-2026-10-12/chrome-final.log) |
| Installed Edge | 155.0.4283.45 | 34 | 0 | 0 | 142.3 s | [Edge](../output/playwright/ux-repairs-2026-10-12/edge-final.log) |

The two skips are the existing Chromium-specific touch-emulation test on Firefox and WebKit. They are not failed cases. WebKit AVIF downloads are independently decoded in Chromium because the Windows WebKit build cannot display that format.

The added checks cover:

1. Direct export from a typed Custom value, invalid export blocking, actual byte feedback, and the decoded result preview.
2. Whole-image selection, linked sizing, invalid derived bounds, repeated draft resets, fixed/Freeform reset, and correct download dimensions.
3. Chooser cancellation, failed replacement preservation, successful replacement, and keyboard focus.
4. Captured pending settings, continued editing, cancellation, crop preservation, and suppression of stale downloads.
5. Viewport fit, toolbar/export visibility, no horizontal overflow, larger range targets, and bottom action access at 1440×900, 844×390, 390×844, and 320×568.
6. Correct edge instructions, reduced motion, composition preservation when changing fit modes, and width-fit scroll reachability.
7. A deliberately stalled export-image decode, bounded recovery, and a successful retry.

The existing suite still verifies repeated worker use, source races, estimate races, native fallback, format signatures/dimensions/pixels/transparency, eight EXIF orientations, extreme valid output ratios, mouse/keyboard/touch crop behavior, denied storage, and AVIF timeout/replacement behavior.

The original offline WebKit failure is now a passing regression. In the final WebKit run, its full scenario completed in about **3.7 seconds**, including setup and upload; previously the focused probe remained exporting after 135 seconds. Normal online AVIF also passes. These are functional test timings, not device-performance benchmarks.

Visual inspection covered the updated desktop, short landscape, 390px phone, and 320px layouts, plus the completed-image preview. The width-fit follow-up confirms that the portrait image starts inside its scrolling frame rather than above the reachable scroll origin.

Evidence is saved under [the repair run directory](../output/playwright/ux-repairs-2026-10-12/) and `output/playwright/regression-{browser}/`. Useful examples: [short landscape fit](../output/playwright/ux-repairs-2026-10-12/landscape-view.png), [larger width fit](../output/playwright/ux-repairs-2026-10-12/landscape-width.png), [desktop](../output/playwright/ux-repairs-2026-10-12/visual-1440x900.png), [390px phone](../output/playwright/ux-repairs-2026-10-12/visual-390x844.png), [320px phone](../output/playwright/ux-repairs-2026-10-12/visual-320x568.png), and [actual export preview](../output/playwright/regression-chromium/actual-export-preview.png). Full-page phone captures show the fixed export bar at the viewport position; settings underneath it remain reachable by scrolling.

## Boundaries

- The verification results above used local builds. Publication and fresh live-site checks are a separate release step.
- Physical iOS/Android devices and manual VoiceOver/TalkBack/NVDA acceptance remain untested. Playwright WebKit is not physical Safari.
- This is specific workflow and accessibility verification, not a complete WCAG certification.
- The baseline's large-output observations remain separate evidence. This repair run did not repeat sustained maximum-area or low-memory stress testing.
- Cancellation and deadlines cover asynchronous stages; a browser can still be briefly busy during synchronous pixel allocation/copying.
- First-use AVIF still needs the encoder assets online. An already-loaded page is not a promise of offline reload support.
