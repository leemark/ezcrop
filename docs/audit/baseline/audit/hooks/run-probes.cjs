const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("C:\\Users\\mark\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright");

const outputDirectory = __dirname;
const targetUrl = process.argv[2] || "http://127.0.0.1:5173/ezcrop/output/audit/hooks/probe.html";
const waitForReact = async (page) => page.waitForTimeout(40);

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const browserVersion = browser.version();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-audit-harness="ready"]', { state: "attached" });
  await page.waitForFunction(() => Boolean(window.__ezcropAudit));

  const loaderOverlap = await page.evaluate(async () => {
    const probe = window.__ezcropAudit;
    const nextFrames = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    probe.startLoad("old-overlap.png");
    probe.startLoad("new-overlap.png");
    const sources = probe.imageSources();
    const oldSrc = sources.find((src) => src.endsWith("old-overlap.png"));
    const newSrc = sources.find((src) => src.endsWith("new-overlap.png"));
    if (!oldSrc || !newSrc) throw new Error("Expected both overlapping image decodes");
    probe.resolveImage(newSrc);
    await probe.waitForLoad("new-overlap.png");
    await nextFrames();
    const afterNewLoad = probe.read().loader;
    probe.resolveImage(oldSrc);
    await probe.waitForLoad("old-overlap.png");
    await nextFrames();
    return {
      afterNewLoad,
      finalState: probe.read().loader,
      olderResultOverwroteNewer: probe.read().loader.originalFile === "old-overlap.png",
    };
  });
  await waitForReact(page);

  const loaderReset = await page.evaluate(async () => {
    const probe = window.__ezcropAudit;
    const nextFrames = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    probe.resetLoader();
    probe.startLoad("pending-reset.png");
    const src = probe.imageSources().find((value) => value.endsWith("pending-reset.png"));
    if (!src) throw new Error("Expected pending reset decode");
    probe.resetLoader();
    await nextFrames();
    const afterReset = probe.read().loader;
    probe.resolveImage(src);
    await probe.waitForLoad("pending-reset.png");
    await nextFrames();
    return {
      afterReset,
      finalState: probe.read().loader,
      pendingResultResurrectedAfterReset:
        probe.read().loader.originalFile === "pending-reset.png",
      revokedUrls: probe.revokedUrls(),
    };
  });
  await waitForReact(page);

  await page.evaluate(() => {
    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: window.__ezcropNativeImage,
    });
  });

  const estimateInputs = {
    imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p6sAAAAASUVORK5CYII=",
    croppedAreaPixels: { x: 0, y: 0, width: 1, height: 1 },
    targetWidth: 100,
    targetHeight: 100,
    format: "jpeg",
    quality: 80,
  };

  await page.evaluate((validInputs) => window.__ezcropAudit.setEstimateInputs(validInputs), estimateInputs);
  await page.waitForFunction(() => window.__ezcropAudit.read().estimate.estimating, null, { timeout: 2000 });
  const estimateAfterValid = await page.evaluate(() => window.__ezcropAudit.read().estimate);
  await page.evaluate((validInputs) => {
    window.__ezcropAudit.setEstimateInputs({ ...validInputs, imageUrl: null, croppedAreaPixels: null });
  }, estimateInputs);
  await page.waitForTimeout(40);
  const estimateAfterNull = await page.evaluate(() => window.__ezcropAudit.read().estimate);
  await page.waitForTimeout(620);
  const estimateNullFinal = await page.evaluate(() => ({
    estimate: window.__ezcropAudit.read().estimate,
    blobRequests: window.__ezcropAudit.blobRequests(),
  }));

  await page.evaluate(async (validInputs) => {
    const probe = window.__ezcropAudit;
    probe.setEstimateInputs(validInputs);
  }, estimateInputs);
  await page.waitForFunction(() => window.__ezcropAudit.blobRequests().length >= 1, null, { timeout: 5000 });
  const firstPendingRequest = await page.evaluate(() => window.__ezcropAudit.blobRequests()[0]);

  await page.evaluate(async (validInputs) => {
    const probe = window.__ezcropAudit;
    probe.setEstimateInputs({ ...validInputs, quality: 90 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    probe.resolveBlobRequest(0, 40, "image/jpeg");
  }, estimateInputs);
  await page.waitForTimeout(50);
  const afterStaleCompletion = await page.evaluate(() => window.__ezcropAudit.read().estimate);
  await page.waitForFunction(() => window.__ezcropAudit.blobRequests().length >= 2, null, { timeout: 5000 });
  await page.evaluate(() => window.__ezcropAudit.resolveBlobRequest(1, 12, "image/jpeg"));
  await page.waitForFunction(() => {
    const state = window.__ezcropAudit.read().estimate;
    return !state.estimating && state.estimatedSize === 12;
  }, null, { timeout: 5000 });
  const estimateChangedFinal = await page.evaluate(() => ({
    estimate: window.__ezcropAudit.read().estimate,
    blobRequests: window.__ezcropAudit.blobRequests(),
  }));

  await page.evaluate((validInputs) => {
    window.__ezcropAudit.setEstimateInputs({ ...validInputs, quality: 75 });
  }, estimateInputs);
  await page.waitForFunction(() => window.__ezcropAudit.blobRequests().length >= 3, null, { timeout: 5000 });
  const estimatePendingNull = await page.evaluate(async (validInputs) => {
    const inputBeforeNull = window.__ezcropAudit.estimateInputs();
    window.__ezcropAudit.setEstimateInputs({ ...validInputs, imageUrl: null, croppedAreaPixels: null, quality: 75 });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      inputBeforeNull,
      estimateAfterNull: window.__ezcropAudit.read().estimate,
      inputsAfterNull: window.__ezcropAudit.estimateInputs(),
      request: window.__ezcropAudit.blobRequests()[2],
    };
  }, estimateInputs);
  await page.evaluate(() => window.__ezcropAudit.resolveBlobRequest(2, 27, "image/jpeg"));
  await page.waitForFunction(() => {
    const state = window.__ezcropAudit.read().estimate;
    const inputs = window.__ezcropAudit.estimateInputs();
    return !inputs.imageUrl && state.estimatedSize === 27 && !state.estimating;
  }, null, { timeout: 5000 });
  const estimateStaleAfterNull = await page.evaluate(() => ({
    estimate: window.__ezcropAudit.read().estimate,
    inputs: window.__ezcropAudit.estimateInputs(),
  }));

  const wrongMimeFallback = await page.evaluate(() => window.__ezcropAudit.probeWrongMimeFallback());
  await browser.close();

  const checks = [
    {
      id: "image_loader_overlap_overwrite",
      reproduced: loaderOverlap.olderResultOverwroteNewer,
      expected: true,
    },
    {
      id: "image_loader_reset_resurrection",
      reproduced: loaderReset.pendingResultResurrectedAfterReset,
      expected: true,
    },
    {
      id: "estimate_valid_to_null_stuck_busy",
      reproduced: estimateAfterValid.estimating && estimateAfterNull.estimating && estimateNullFinal.estimate.estimating,
      expected: true,
    },
    {
      id: "estimate_changed_during_encode_rejects_old_result",
      reproduced:
        afterStaleCompletion.estimatedSize === null &&
        estimateChangedFinal.estimate.estimatedSize === 12 &&
        !estimateChangedFinal.estimate.estimating,
      expected: true,
    },
    {
      id: "estimate_null_during_encode_publishes_stale_result",
      reproduced:
        estimatePendingNull.inputBeforeNull.imageUrl !== null &&
        estimatePendingNull.inputsAfterNull.imageUrl === null &&
        estimateStaleAfterNull.inputs.imageUrl === null &&
        estimateStaleAfterNull.estimate.estimatedSize === 27,
      expected: true,
    },
    {
      id: "encoding_toBlob_accepts_wrong_mime_fallback",
      reproduced: wrongMimeFallback.toBlob.acceptedMismatch,
      expected: true,
    },
    {
      id: "encoding_convertToBlob_accepts_wrong_mime_fallback",
      reproduced: wrongMimeFallback.convertToBlob.acceptedMismatch,
      expected: true,
    },
  ];
  const results = {
    schemaVersion: 1,
    sourceRevision: "f4c39b9be2f0e6da76d6e4db40f71488bc763511",
    targetUrl,
    browser: "Chrome via Playwright channel=chrome",
    browserVersion,
    notes: {
      controlledConditions: [
        "useImageLoader Image decode completions are explicitly held and released out of order by the harness.",
        "Estimator toBlob completions are explicitly held and resolved by the harness during transition probes.",
        "Wrong-MIME responses are injected for both toBlob and a controlled OffscreenCanvas.convertToBlob; no natural browser fallback is claimed.",
      ],
      naturallyObserved: [
        "The estimator's 1x1 data-URI image decode and canvas drawing ran in Chrome; no naturally occurring WebP-to-PNG fallback was observed.",
      ],
    },
    probes: {
      loaderOverlap,
      loaderReset,
      estimateNullTransition: {
        afterValid: estimateAfterValid,
        afterNull: estimateAfterNull,
        afterClearedDebounceWindow: estimateNullFinal,
      },
      estimateChangedDuringEncode: {
        firstRequest: firstPendingRequest,
        afterOldEncodeResolved: afterStaleCompletion,
        afterCurrentEncodeResolved: estimateChangedFinal,
      },
      estimateNullDuringEncode: {
        whilePending: estimatePendingNull,
        afterPendingEncodeResolved: estimateStaleAfterNull,
      },
      wrongMimeFallback,
    },
    pageErrors,
    checks,
    allExpectedChecksPassed: checks.every((check) => check.reproduced === check.expected) && pageErrors.length === 0,
  };

  fs.writeFileSync(path.join(outputDirectory, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify({ checks, pageErrors, allExpectedChecksPassed: results.allExpectedChecksPassed }, null, 2));
  if (!results.allExpectedChecksPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
