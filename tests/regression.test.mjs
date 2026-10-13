import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer, preview } from 'vite';
import { chromium, firefox, webkit } from 'playwright';

const engine = process.env.EZCROP_BROWSER || 'chromium';
const chromiumEngine = ['chromium', 'chrome', 'edge'].includes(engine);
const portOffset = ['chromium','chrome','edge','firefox','webkit'].indexOf(engine);
const output = path.resolve('output/playwright/regression-' + engine);
let dev, production, browser, outputDecoder;
const devUrl = `http://127.0.0.1:${5183 + portOffset}/ezcrop/`;
const productionUrl = process.env.EZCROP_BASE_URL || `http://127.0.0.1:${4183 + portOffset}/ezcrop/`;
before(async () => {
  await fs.mkdir(output, { recursive: true });
  dev = await createServer({ server: { host: '127.0.0.1', port: 5183 + portOffset, strictPort: true }, logLevel: 'error' });
  await dev.listen();
  if (!process.env.EZCROP_BASE_URL) production = await preview({ preview: { host: '127.0.0.1', port: 4183 + portOffset, strictPort: true }, logLevel: 'error' });
  const launcher = chromiumEngine ? chromium : engine === 'firefox' ? firefox : webkit;
  browser = await launcher.launch({ headless: process.env.EZCROP_HEADED !== '1', ...(engine === 'chrome' ? { channel: 'chrome' } : engine === 'edge' ? { channel: 'msedge' } : {}) });
  console.log(`Browser: ${engine} ${browser.version()}`);
}, { timeout: 60000 });
after(async () => {
  await outputDecoder?.close();
  await browser?.close();
  await dev?.close();
  if (production) await new Promise(resolve => production.httpServer.close(resolve));
});
async function pageFor(fn, { init, mobile = false, theme = 'light', url = productionUrl } = {}) {
  const context = await browser.newContext({ acceptDownloads: true, colorScheme: theme, viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, hasTouch: mobile, isMobile: mobile && engine !== 'firefox' });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  try { await page.goto(url, { waitUntil: 'networkidle' }); return await fn(page, context); }
  finally { await context.close(); }
}
async function upload(page, name = 'quadrants.png', width = 400, height = 200, transparent = false) {
  const png = await page.evaluate(({ width, height, transparent }) => {
    const c = document.createElement('canvas'); c.width = width; c.height = height; const x = c.getContext('2d');
    for (const [i, color] of ['#dc2833', '#28b451', '#285bdb', '#f0c828'].entries()) {
      x.fillStyle = color; x.fillRect((i % 2) * width / 2, Math.floor(i / 2) * height / 2, width / 2, height / 2);
    }
    if (transparent) { x.clearRect(0, 0, width, height / 4); x.clearRect(0, height * .75, width, height / 4); }
    return c.toDataURL('image/png').split(',')[1];
  }, { width, height, transparent });
  await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByAltText('Crop source').waitFor();
  await page.locator('header').getByText(name, { exact: true }).waitFor();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent.includes('Export Image') && !button.disabled));
}
async function size(page, width, height) {
  await page.getByRole('button', { name: 'Custom size', exact: true }).click();
  for (const [name, value] of [['Width in pixels', width], ['Height in pixels', height]]) {
    const field = page.getByRole('spinbutton', { name }); await field.fill(String(value)); await field.blur();
  }
}
async function download(page, format = 'WebP', label = 'export') {
  await page.getByRole('button', { name: format, exact: true }).click();
  const start = Date.now();
  const pendingDownload = page.waitForEvent('download', { timeout: 60000 });
  // Begin the new attempt before watching errors; a previous failed attempt's
  // alert is intentionally visible until this click clears it.
  await page.getByRole('button', { name: 'Export Image', exact: true }).click();
  const outcome = Promise.race([
    pendingDownload,
    page.getByRole('alert').waitFor({ timeout: 60000 }).then(async () => {
      throw new Error(`Export error: ${await page.getByRole('alert').innerText()}`);
    }),
  ]);
  const d = await outcome;
  const bytes = await fs.readFile(await d.path());
  await fs.writeFile(path.join(output, label + '-' + d.suggestedFilename()), bytes);
  const expected = format === 'JPEG' ? bytes.subarray(0, 2).toString('hex') === 'ffd8' : format === 'WebP' ? bytes.subarray(8, 12).toString() === 'WEBP' : bytes.subarray(4, 12).toString() === 'ftypavif';
  assert.ok(expected, 'Download bytes must match requested format');
  // Windows Playwright WebKit can encode AVIF through WASM but cannot display
  // it. Decode those files independently with the installed Chromium browser.
  let decodingPage = page;
  if (engine === 'webkit' && format === 'AVIF') {
    outputDecoder ??= await chromium.launch();
    decodingPage = await outputDecoder.newPage();
  }
  let decoded;
  try { decoded = await decodingPage.evaluate(async ({ data, mime }) => {
    const img = new Image(); img.src = `data:${mime};base64,${data}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    return { width: c.width, height: c.height, corner: Array.from(ctx.getImageData(0, 0, 1, 1).data), samples: [[.1,.1],[.9,.1],[.1,.9],[.9,.9]].map(([x,y]) => Array.from(ctx.getImageData(Math.floor(c.width*x),Math.floor(c.height*y),1,1).data)) };
  }, { data: bytes.toString('base64'), mime: format === 'WebP' ? 'image/webp' : format === 'JPEG' ? 'image/jpeg' : 'image/avif' }); }
  finally { if (decodingPage !== page) await decodingPage.close(); }
  return { ...decoded, bytes: bytes.length, filename: d.suggestedFilename(), elapsed: Date.now() - start };
}
const crop = page => page.locator('.ReactCrop__crop-selection').getAttribute('style');
test('Freeform preserves selection, changes one edge independently, and exports source dimensions', async () => {
  await pageFor(async page => {
    await upload(page, 'freeform.png'); await size(page, 400, 200); await waitForCropAspect(page, 2);
    const before = await crop(page);
    await page.getByRole('button', { name: 'Freeform', exact: true }).click();
    assert.equal(await crop(page), before);
    assert.equal(await page.getByRole('button', { name: 'Freeform', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('slider', { name: 'Zoom', exact: true }).count(), 0);
    const handle = page.locator('.ReactCrop__drag-handle.ord-e'); await handle.scrollIntoViewIfNeeded();
    const h = await handle.boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 - 60, h.y + h.height / 2, { steps: 8 }); await page.mouse.up();
    const source = await page.locator('.ReactCrop__crop-selection').evaluate(el => ({ width: Math.round(parseFloat(el.style.width) * 4), height: Math.round(parseFloat(el.style.height) * 2) }));
    assert.ok(source.width < 390); assert.equal(source.height, 200);
    await page.getByText(`${source.width}×${source.height}`, { exact: true }).waitFor();
    const result = await download(page, 'JPEG', 'freeform');
    assert.equal(result.width, source.width); assert.equal(result.height, source.height);
    assert.equal(result.filename, `freeform_${source.width}x${source.height}.jpg`);
    await page.getByRole('button', { name: 'Square Small (600×600)', exact: true }).click(); await waitForCropAspect(page, 1);
    assert.equal(await page.getByRole('slider', { name: 'Zoom', exact: true }).isVisible(), true);
    await page.getByRole('group', { name: 'Output summary' }).getByText('600×600', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Custom size', exact: true }).click(); await waitForCropAspect(page, 2);
    assert.equal(await page.getByRole('spinbutton', { name: 'Width in pixels' }).inputValue(), '400');
  });
});

test('Freeform caps large source selections proportionally and fits the mobile layout', async () => {
  await pageFor(async page => {
    await upload(page, 'wide.png', 8000, 80); await size(page, 100, 1); await waitForCropAspect(page, 100);
    await page.getByRole('button', { name: 'Freeform', exact: true }).click();
    await page.getByText('7680×77', { exact: true }).waitFor();
    const result = await download(page, 'JPEG', 'freeform-large');
    assert.equal(result.width, 7680); assert.equal(result.height, 77);
    await page.getByRole('button', { name: 'Upload a different image', exact: true }).click();
    await upload(page, 'mobile-freeform.png', 400, 200);
    await page.getByRole('button', { name: 'Freeform', exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.getByRole('button', { name: 'Fit image to width', exact: true }).isVisible(), true);
    await page.screenshot({ path: path.join(output, 'freeform-mobile.png'), fullPage: true });
  }, { mobile: true });
});
async function waitForCropAspect(page, aspect) {
  // Preset changes refit the selection in a React effect. Observe that visible
  // update before recording a selection for later preservation comparisons.
  await page.waitForFunction(expected => {
    const image = document.querySelector('img[alt="Crop source"]');
    const selection = document.querySelector('.ReactCrop__crop-selection');
    if (!image || !selection) return false;
    const actual = (parseFloat(selection.style.width) * image.naturalWidth) /
      (parseFloat(selection.style.height) * image.naturalHeight);
    return Math.abs(actual - expected) < 0.0001;
  }, aspect);
}

test('F01: repeated exports retain the worker connection across garbage collection', { timeout: 60000 }, async () => {
  await pageFor(async (page, context) => {
    await upload(page); await page.getByRole('button', { name: 'Square Small (600×600)', exact: true }).click();
    const cdp = chromiumEngine ? await context.newCDPSession(page) : null;
    for (let i = 0; i < 4; i++) {
      const result = await download(page, 'WebP', 'repeated-' + i);
      assert.equal(result.width, 600); assert.equal(result.height, 600); assert.ok(result.elapsed < 18000, `small export waited ${result.elapsed} ms`);
      if (cdp) await cdp.send('HeapProfiler.collectGarbage');
    }
  });
});
test('F02: replacing an image terminates a held worker and suppresses its download', async () => {
  await pageFor(async page => {
    const downloads = []; page.on('download', d => downloads.push(d.suggestedFilename()));
    await upload(page, 'old.png');
    await page.getByRole('button', { name: 'AVIF', exact: true }).click();
    await page.getByRole('button', { name: 'Export Image', exact: true }).click();
    await page.waitForFunction(() => window.workerCalls > 0);
    await page.getByRole('button', { name: 'Upload a different image', exact: true }).click();
    await upload(page, 'new.png');
    await page.waitForFunction(() => window.workerTerminations > 0);
    assert.equal(await page.getByRole('button', { name: 'Export Image', exact: true }).isEnabled(), true);
    assert.match(await page.locator('header').innerText(), /new\.png/);
    await page.waitForTimeout(250); assert.deepEqual(downloads, []);
  }, { init: () => {
    window.workerCalls = 0; window.workerTerminations = 0;
    const NativeWorker = window.Worker;
    window.Worker = class extends EventTarget { constructor(url, options) { super(); if (!String(url).includes('encode.worker')) return new NativeWorker(url, options); } postMessage() { window.workerCalls++; } terminate() { window.workerTerminations++; } };
  } });
});
test('F03/F04: zoom, movement, output resolution and unchanged fields preserve composition', async () => {
  await pageFor(async page => {
    await upload(page, 'landscape.png', 1200, 800);
    await page.getByRole('button', { name: 'Vertical Narrow (800×1920)', exact: true }).click();
    await waitForCropAspect(page, 800 / 1920);
    const first = await crop(page); const zoom = page.getByRole('slider', { name: 'Zoom', exact: true }); await zoom.focus(); await page.keyboard.press('End');
    assert.notEqual(await crop(page), first); assert.equal(await zoom.inputValue(), '3');
    const group = page.getByRole('group', { name: 'Use the arrow keys to move the crop selection area', exact: true }); await group.focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await zoom.inputValue(), '3');
    await page.getByRole('button', { name: 'Square Small (600×600)', exact: true }).click(); await waitForCropAspect(page, 1); await zoom.focus(); await page.keyboard.press('End');
    const beforeResolution = await crop(page); await page.getByRole('button', { name: 'Square Large (1600×1600)', exact: true }).click(); assert.equal(await crop(page), beforeResolution);
    await size(page, 800, 600); await waitForCropAspect(page, 800 / 600); await zoom.focus(); await page.keyboard.press('End'); const beforeBlur = await crop(page);
    await page.getByRole('spinbutton', { name: 'Width in pixels' }).focus(); await page.keyboard.press('Tab'); assert.equal(await crop(page), beforeBlur);
  });
});
test('F04: invalid custom dimensions do not become output; extreme valid ratios encode', { timeout: 120000 }, async () => {
  await pageFor(async page => {
    await upload(page); await size(page, 600, 600); const width = page.getByRole('spinbutton', { name: 'Width in pixels' });
    for (const value of ['0', '-1', '600.5', '7681', '']) {
      await width.fill(value);
      assert.equal(await page.getByRole('button', { name: 'Export Image', exact: true }).isEnabled(), false);
      await width.blur();
      assert.match(await page.getByRole('complementary', { name: 'Crop options' }).innerText(), /600×600/);
    }
    for (const [w, h] of [[1, 7680], [7680, 1], [1, 1]]) { await size(page, w, h); const result = await download(page, 'JPEG', `extreme-${w}-${h}`); assert.equal(result.width, w); assert.equal(result.height, h); }
  });
});
test('F05/F06/F12: mobile preview is stable, Custom is selected, and names do not overflow', async () => {
  await pageFor(async page => {
    await upload(page, 'x'.repeat(180) + '.png', 1200, 800);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', { name: 'Fit image to width', exact: true }).click();
    await page.waitForTimeout(300); const a = await page.getByAltText('Crop source').boundingBox(); await page.waitForTimeout(400); const b = await page.getByAltText('Crop source').boundingBox();
    assert.ok(a.height > 100); assert.ok(Math.abs(a.height - b.height) < 1);
    await page.getByRole('button', { name: 'Custom size', exact: true }).click(); assert.equal(await page.getByRole('button', { name: 'Custom size', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  }, { mobile: true });
});
test('F11: denied theme storage leaves upload and export usable', async () => {
  await pageFor(async page => { await upload(page); await size(page, 100, 100); const result = await download(page, 'JPEG', 'storage'); assert.equal(result.width, 100); }, { init: () => {
    Storage.prototype.getItem = () => { throw new DOMException('Denied', 'SecurityError'); }; Storage.prototype.setItem = Storage.prototype.getItem;
  } });
});
for (const format of ['WebP', 'JPEG', 'AVIF']) test(`formats and F14: ${format} signature, dimensions, pixels and transparency`, { timeout: 120000 }, async () => {
  await pageFor(async page => {
    await upload(page, 'transparent.png', 800, 800, true); await size(page, 600, 600);
    assert.equal(await page.getByText('JPEG turns transparent areas black. Choose WebP or AVIF to keep transparency.', { exact: true }).isVisible(), true);
    const result = await download(page, format, 'format'); assert.equal(result.width, 600); assert.equal(result.height, 600);
    assert.equal(result.corner[3], format === 'JPEG' ? 255 : 0);
    if (format === 'JPEG') assert.ok(result.corner.slice(0,3).every(value => value <= 3));
    console.log(`${engine} ${format}: ${result.elapsed}ms, ${result.bytes} bytes`);
  });
});
test('F10: worker script failure falls back immediately', async () => {
  await pageFor(async page => {
    await page.route('**/*encode.worker*', route => route.abort()); await upload(page); await size(page, 100, 100);
    const result = await download(page, 'JPEG', 'worker-failure'); assert.ok(result.elapsed < 10000);
  });
});
test('F10: uncached offline AVIF explains recovery without a module URL', async () => {
  await pageFor(async (page, context) => {
    await upload(page); await size(page, 100, 100); await context.setOffline(true);
    await page.getByRole('button', { name: 'AVIF', exact: true }).click(); await page.getByRole('button', { name: 'Export Image', exact: true }).click();
    const alert = page.getByRole('alert'); await alert.waitFor({ timeout: 30000 }); const message = await alert.innerText();
    assert.match(message, /online|connect|JPEG|WebP/i); assert.doesNotMatch(message, /https?:|\.js|\.wasm/);
  });
});
test('F07: load completion order, stale errors and reset cannot replace the current image', async () => {
  await pageFor(async page => {
    await page.waitForFunction(() => window.ezcropTest);
    await page.evaluate(() => { window.ezcropTest.load('old.png'); window.ezcropTest.load('new.png'); });
    assert.equal(await page.evaluate(() => window.ezcropTest.finish('new.png')), true);
    await page.waitForFunction(() => window.ezcropTest.snapshot.loader.name === 'new.png');
    assert.equal(await page.evaluate(() => window.ezcropTest.finish('old.png', false)), false);
    assert.equal(await page.evaluate(() => window.ezcropTest.snapshot.loader.name), 'new.png');
    await page.evaluate(() => { window.ezcropTest.load('reset.png'); window.ezcropTest.reset(); });
    assert.equal(await page.evaluate(() => window.ezcropTest.finish('reset.png')), false);
    await page.waitForFunction(() => window.ezcropTest.snapshot.loader.name === null);
    assert.ok((await page.evaluate(() => window.ezcropTest.revoked())).includes('blob:controlled/reset.png'));
  }, { url: devUrl + 'tests/harness.html' });
});
test('F08: clearing during debounce/encoding stays empty; latest valid estimate wins', async () => {
  await pageFor(async page => {
    await page.waitForFunction(() => window.ezcropTest); await page.evaluate(() => window.ezcropTest.nativeImages());
    await page.evaluate(() => window.ezcropTest.estimate(true)); await page.waitForFunction(() => window.ezcropTest.snapshot.estimate.estimating);
    await page.evaluate(() => window.ezcropTest.estimate(false)); await page.waitForTimeout(650);
    assert.deepEqual(await page.evaluate(() => window.ezcropTest.snapshot.estimate), { estimatedSize: null, estimating: false });
    assert.equal(await page.evaluate(() => window.ezcropTest.blobCount()), 0);
    await page.evaluate(() => window.ezcropTest.estimate(true)); await page.waitForFunction(() => window.ezcropTest.blobCount() === 1);
    await page.evaluate(() => window.ezcropTest.estimate(false)); await page.waitForFunction(() => !window.ezcropTest.snapshot.estimate.estimating);
    await page.evaluate(() => window.ezcropTest.completeBlob(0, 27)); await page.waitForTimeout(50);
    assert.deepEqual(await page.evaluate(() => window.ezcropTest.snapshot.estimate), { estimatedSize: null, estimating: false });
    await page.evaluate(() => window.ezcropTest.estimate(true, 80)); await page.waitForFunction(() => window.ezcropTest.blobCount() === 2);
    await page.evaluate(() => window.ezcropTest.estimate(true, 90)); await page.waitForFunction(() => window.ezcropTest.blobCount() === 3);
    await page.evaluate(() => { window.ezcropTest.completeBlob(1, 40); window.ezcropTest.completeBlob(2, 12); });
    await page.waitForFunction(() => window.ezcropTest.snapshot.estimate.estimatedSize === 12 && !window.ezcropTest.snapshot.estimate.estimating);
  }, { url: devUrl + 'tests/harness.html' });
});

test('F03/F04: geometry round-trips across orientations and fractional source rectangles', async () => {
  await pageFor(async page => {
    await upload(page, 'geometry.png', 1200, 800);
    const checks = await page.evaluate(async () => {
      const { createBaselineCrop, getCropAtZoom, getZoomForCrop } = await import('/ezcrop/src/lib/cropGeometry.ts');
      const rows = [];
      for (const [w,h] of [[1200,800],[800,1200],[800,800]]) for (const aspect of [1, 16/9, 800/1920]) {
        const image = {width:w,height:h}; const baseline = createBaselineCrop(image,aspect);
        for (const zoom of [1,2,3]) { const crop = getCropAtZoom(baseline,image,zoom,{x:w*.9,y:h*.1}); rows.push({zoom,inverse:getZoomForCrop(crop,baseline),ratio:crop.width/crop.height,aspect,inside:crop.x>=0&&crop.y>=0&&crop.x+crop.width<=w+1e-6&&crop.y+crop.height<=h+1e-6}); }
      }
      const bounds = [
        {image:{width:1200,height:800},aspect:1},
        {image:{width:1200,height:800},aspect:2},
        {image:{width:1200,height:800},aspect:1.5},
      ].map(({image,aspect}) => {
        const baseline = createBaselineCrop(image,aspect);
        const atMinimumZoom = getCropAtZoom(baseline,image,1);
        return {image,aspect,baseline,atMinimumZoom,zoom:getZoomForCrop(atMinimumZoom,baseline)};
      });
      const { getCroppedCanvas } = await import('/ezcrop/src/lib/cropUtils.ts');
      const image = document.querySelector('img[alt="Crop source"]');
      const narrow = getCroppedCanvas(image,{x:600,y:0,width:.1,height:800});
      let invalidRejected = false; try { getCroppedCanvas(image,{x:0,y:0,width:0,height:1}); } catch { invalidRejected=true; }
      return {rows,bounds,raster:[narrow.width,narrow.height],invalidRejected};
    });
    for (const row of checks.rows) { assert.ok(Math.abs(row.zoom-row.inverse)<1e-6); assert.ok(Math.abs(row.ratio-row.aspect)<1e-6); assert.equal(row.inside,true); }
    const [fullHeight, fullWidth, matchingAspect] = checks.bounds;
    assert.deepEqual([fullHeight.baseline.x,fullHeight.baseline.y,fullHeight.baseline.width,fullHeight.baseline.height],[200,0,800,800]);
    assert.deepEqual([fullWidth.baseline.x,fullWidth.baseline.y,fullWidth.baseline.width,fullWidth.baseline.height],[0,100,1200,600]);
    assert.deepEqual([matchingAspect.baseline.x,matchingAspect.baseline.y,matchingAspect.baseline.width,matchingAspect.baseline.height],[0,0,1200,800]);
    for (const {baseline,atMinimumZoom,zoom} of checks.bounds) { assert.deepEqual(atMinimumZoom,baseline); assert.equal(zoom,1); }
    assert.deepEqual(checks.raster,[1,800]); assert.equal(checks.invalidRejected,true);
  }, { url: devUrl });
});

test('F03: dragging a resize handle can restore matching-aspect full source bounds', async () => {
  await pageFor(async page => {
    await upload(page,'portrait.png',800,1200);
    await size(page,2,3);
    await waitForCropAspect(page,2/3);
    const zoom=page.getByRole('slider',{name:'Zoom',exact:true});await zoom.focus();await page.keyboard.press('End');
    const image=await page.getByAltText('Crop source').boundingBox();
    const selection=page.locator('.ReactCrop__crop-selection');
    const initial=await selection.boundingBox();
    const moveX=image.x+image.width-initial.width-initial.x;
    const moveY=image.y+image.height-initial.height-initial.y;
    await page.mouse.move(initial.x+initial.width/2,initial.y+initial.height/2);
    await page.mouse.down();
    await page.mouse.move(initial.x+initial.width/2+moveX,initial.y+initial.height/2+moveY,{steps:12});
    await page.mouse.up();
    const bottomRight=await selection.boundingBox();
    assert.ok(Math.abs(bottomRight.x+bottomRight.width-(image.x+image.width))<2);
    assert.ok(Math.abs(bottomRight.y+bottomRight.height-(image.y+image.height))<2);

    const handle=page.locator('.ReactCrop__drag-handle.ord-nw');
    const handleBox=await handle.boundingBox();
    await page.mouse.move(handleBox.x+handleBox.width/2,handleBox.y+handleBox.height/2);
    await page.mouse.down();
    await page.mouse.move(image.x,image.y,{steps:12});
    await page.mouse.up();
    await page.waitForFunction(() => Number(document.querySelector('input[aria-label="Zoom"]').value)===1);
    const fullBounds=await selection.boundingBox();
    assert.ok(Math.abs(fullBounds.x-image.x)<2);
    assert.ok(Math.abs(fullBounds.y-image.y)<2);
    assert.ok(Math.abs(fullBounds.width-image.width)<2);
    assert.ok(Math.abs(fullBounds.height-image.height)<2);
  }, { url: devUrl });
});
test('F09: both native encoders reject a PNG fallback requested as WebP', async () => {
  await pageFor(async page => {
    const result = await page.evaluate(async () => {
      const {encodeCanvas,encodeImageData}=await import('/ezcrop/src/lib/encoding.ts');
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
      canvas.toBlob=callback=>callback(new Blob(['png'],{type:'image/png'}));
      let nativeRejected=false;try{await encodeCanvas(canvas,'webp',80);}catch{nativeRejected=true;}
      const descriptor=Object.getOwnPropertyDescriptor(window,'OffscreenCanvas');
      window.OffscreenCanvas=class{getContext(){return{putImageData(){}};}async convertToBlob(){return new Blob(['png'],{type:'image/png'});}};
      let offscreenRejected=false;try{await encodeImageData(new ImageData(1,1),'webp',80);}catch{offscreenRejected=true;}finally{if(descriptor)Object.defineProperty(window,'OffscreenCanvas',descriptor);else Reflect.deleteProperty(window,'OffscreenCanvas');}
      canvas.toBlob=callback=>callback(new Blob(['webp'],{type:'image/webp'}));
      return {nativeRejected,offscreenRejected,validType:(await encodeCanvas(canvas,'webp',80)).type};
    });
    assert.deepEqual(result,{nativeRejected:true,offscreenRejected:true,validType:'image/webp'});
  }, {url:devUrl});
});
for(const theme of ['light','dark']) test(`F06: affected text meets normal-text contrast in ${theme} theme`, async () => {
  await pageFor(async page => {
    async function contrast(locator){return locator.evaluate(el=>{
      const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');const parents=[];for(let p=el;p;p=p.parentElement)parents.push(p);
      x.fillStyle='#fff';x.fillRect(0,0,1,1);for(const p of parents.reverse()){x.fillStyle=getComputedStyle(p).backgroundColor;x.fillRect(0,0,1,1);}
      const bg=Array.from(x.getImageData(0,0,1,1).data).slice(0,3);x.fillStyle=getComputedStyle(el).color;x.fillRect(0,0,1,1);const fg=Array.from(x.getImageData(0,0,1,1).data).slice(0,3);
      const lum=a=>a.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
      return(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05);
    });}
    assert.ok(await contrast(page.getByText(/JPEG · PNG · WebP · AVIF · GIF · BMP/).first())>=4.5);
    assert.ok(await contrast(page.locator('footer span').first())>=4.5);
    await page.locator('input[type=file]').setInputFiles({name:'unsupported.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});
    await page.getByRole('alert').waitFor();
    assert.ok(await contrast(page.getByRole('alert'))>=4.5, 'Upload errors must retain readable contrast');
    await upload(page);
    for(const locator of [page.getByRole('button',{name:'Export Image',exact:true}),page.getByRole('button',{name:'WebP',exact:true}).locator('span'),page.getByRole('button',{name:'Square Small (600×600)',exact:true}).locator('span').first(),page.getByRole('button',{name:'Square Large (1600×1600)',exact:true}).locator('span').first(),page.getByText('Output',{exact:true}),page.getByText('Est. size',{exact:true})]) assert.ok(await contrast(locator)>=4.5);
  },{theme});
});

test('F02: stale main-thread successes and errors cannot affect a newer export', async () => {
  await pageFor(async page => {
    await page.waitForFunction(() => window.ezcropTest); await page.evaluate(() => window.ezcropTest.nativeImages());
    for (let i=0;i<2;i++) {
      await page.evaluate(i=>window.ezcropTest.startExport(`old-${i}.png`),i); await page.waitForFunction(n=>window.ezcropTest.blobCount()===n,i*2+1);
      await page.evaluate(i=>{window.ezcropTest.cancelExport();window.ezcropTest.startExport(`new-${i}.png`);},i); await page.waitForFunction(n=>window.ezcropTest.blobCount()===n,i*2+2);
      await page.waitForFunction(() => window.ezcropTest.exportState.exporting);
      await page.evaluate(i=>window.ezcropTest.completeBlob(i*2,i===0?27:null),i); assert.equal(await page.evaluate(i=>window.ezcropTest.waitExport(`old-${i}.png`),i),false);
      assert.deepEqual(await page.evaluate(()=>window.ezcropTest.exportState),{exporting:true,error:null});
      await page.evaluate(i=>window.ezcropTest.completeBlob(i*2+1,12),i); assert.equal(await page.evaluate(i=>window.ezcropTest.waitExport(`new-${i}.png`),i),true);
      await page.waitForFunction(() => !window.ezcropTest.exportState.exporting);
    }
    assert.deepEqual(await page.evaluate(()=>window.downloadAttempts),['new-0_100x100.jpg','new-1_100x100.jpg']);
  },{url:devUrl+'tests/harness.html',init:()=>{
    Object.defineProperty(window,'OffscreenCanvas',{configurable:true,value:undefined});
    window.downloadAttempts=[];HTMLAnchorElement.prototype.click=function(){window.downloadAttempts.push(this.download);};
  }});
});
test('Phone photographs keep all eight EXIF orientations through export', {timeout:120000}, async () => {
  const expectations=JSON.parse((await fs.readFile('tests/fixtures/orientations.json','utf8')).replace(/^\uFEFF/,''));
  for(const entry of expectations) await pageFor(async page=>{
    await page.locator('input[type=file]').setInputFiles(path.resolve('tests/fixtures',entry.file)); await page.getByAltText('Crop source').waitFor();
    assert.deepEqual(await page.getByAltText('Crop source').evaluate(el=>[el.naturalWidth,el.naturalHeight]),[entry.width,entry.height]);
    await size(page,entry.width,entry.height); const result=await download(page,'JPEG','orientation-'+entry.value);
    assert.equal(result.width,entry.width); assert.equal(result.height,entry.height);
    const maxError=Math.max(...result.samples.flatMap((sample,i)=>sample.slice(0,3).map((channel,j)=>Math.abs(channel-entry.samples[i][j])))); assert.ok(maxError<25,`orientation ${entry.value}: error ${maxError}`);
  });
});
test('F13: an invalid file gives guidance and a new valid image recovers', async () => {
  await pageFor(async page=>{
    await page.locator('input[type=file]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
    const alert=page.getByRole('alert'); await alert.waitFor(); assert.match(await alert.innerText(),/JPEG|PNG|damaged/i);
    await upload(page,'recovered.png'); await size(page,100,100); assert.equal((await download(page,'JPEG','recovered')).width,100);
  });
});

test('F03/F04: mouse crop movement and crossing a resize edge keep the editor usable', async () => {
  await pageFor(async page => {
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await upload(page,'mouse.png',1200,800);await size(page,600,600);
    const zoom=page.getByRole('slider',{name:'Zoom',exact:true});await zoom.focus();await page.keyboard.press('End');
    const selection=page.locator('.ReactCrop__crop-selection');await selection.scrollIntoViewIfNeeded();const a=await selection.boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2+25,a.y+a.height/2-15,{steps:6});await page.mouse.up();
    const b=await selection.boundingBox();assert.ok(Math.abs(b.x-a.x)>10);assert.equal(await zoom.inputValue(),'3');
    const handle=page.locator('.ReactCrop__drag-handle.ord-se');const h=await handle.boundingBox();
    await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(b.x-15,b.y-15,{steps:8});await page.mouse.up();
    await zoom.focus();await page.keyboard.press('Home');assert.equal(await zoom.inputValue(),'1');
    assert.deepEqual(errors,[]);assert.equal((await download(page,'JPEG','mouse')).width,600);
  });
});

test('F06: Chromium touch emulation moves the crop without changing zoom', {skip:!chromiumEngine}, async () => {
  await pageFor(async (page,context) => {
    await upload(page,'touch.png',800,1200);await size(page,600,600);
    const zoom=page.getByRole('slider',{name:'Zoom',exact:true});await zoom.focus();await page.keyboard.press('End');
    const selection=page.locator('.ReactCrop__crop-selection');await selection.scrollIntoViewIfNeeded();const before=await selection.boundingBox();
    const cdp=await context.newCDPSession(page);const point={x:before.x+before.width/2,y:before.y+before.height/2,id:1};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+15,y:point.y-15}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await selection.boundingBox();assert.ok(Math.abs(after.x-before.x)>5);assert.equal(await zoom.inputValue(),'3');
  },{mobile:true});
});

test('O01: an AVIF timeout stays cancellable and offers recovery without a main-thread retry', async () => {
  await pageFor(async page => {
    let wasmRequests=0;page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('.wasm'))wasmRequests++;});
    await upload(page);await size(page,100,100);
    await page.getByRole('button',{name:'AVIF',exact:true}).click();
    await page.getByRole('button',{name:'Export Image',exact:true}).click();
    const alert=page.getByRole('alert');await alert.waitFor();assert.match(await alert.innerText(),/smaller|too long|JPEG|WebP/i);
    assert.equal(await page.getByRole('button',{name:'Export Image',exact:true}).isEnabled(),true);
    assert.equal(wasmRequests,0,'a timed-out AVIF worker must not restart WASM on the page');
    assert.ok(await page.evaluate(()=>window.workerTerminations>0));
  },{init:()=>{
    const schedule=window.setTimeout.bind(window);window.setTimeout=(handler,delay,...args)=>schedule(handler,delay===120000?30:delay,...args);
    const NativeWorker=window.Worker;window.workerTerminations=0;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('encode.worker'))return new NativeWorker(url,options);}postMessage(){}terminate(){window.workerTerminations++;}};
  }});
});

test('O01/F02: AVIF estimation runs in a worker and stops when exporting or replacing the image', async () => {
  await pageFor(async page => {
    await upload(page);await size(page,100,100);await page.getByRole('button',{name:'AVIF',exact:true}).click();
    await page.waitForFunction(()=>window.workerApplies>=1);
    const initial=await page.evaluate(()=>window.workerTerminations);
    await page.getByRole('button',{name:'Export Image',exact:true}).click();
    await page.waitForFunction(()=>window.workerApplies>=2);await page.waitForFunction(initial=>window.workerTerminations>initial,initial);
    await page.getByRole('button',{name:'Upload a different image',exact:true}).click();await upload(page,'after-avif.png');
    await page.waitForFunction(initial=>window.workerTerminations>=initial+2,initial);
    assert.equal(await page.getByRole('button',{name:'Export Image',exact:true}).isEnabled(),true);
  },{init:()=>{
    window.workerApplies=0;window.workerTerminations=0;
    const NativeWorker=window.Worker;window.Worker=class extends EventTarget{constructor(url,options){super();if(!String(url).includes('encode.worker'))return new NativeWorker(url,options);}postMessage(message){if(message.type==='APPLY')window.workerApplies++;}terminate(){window.workerTerminations++;}};
  }});
});


test('UX01: a valid draft clicked directly into Export uses its new dimensions and exposes the actual result', async () => {
  await pageFor(async page => {
    await upload(page, 'draft.png', 1200, 800); await size(page, 800, 600);
    await page.getByRole('button', {name:'JPEG',exact:true}).click();
    const width = page.getByRole('spinbutton', {name:'Width in pixels'});
    await width.fill('8000');
    assert.equal(await page.getByRole('button', {name:'Export Image',exact:true}).isEnabled(), false);
    await width.fill('720');
    const completed = page.waitForEvent('download');
    await page.getByRole('button', {name:'Export Image',exact:true}).click();
    const d = await completed;
    assert.equal(d.suggestedFilename(), 'draft_720x600.jpg');
    const bytes = await fs.readFile(await d.path());
    await page.getByRole('status').filter({hasText:'Download started: draft_720x600.jpg'}).waitFor();
    assert.match(await page.getByRole('status').innerText(), new RegExp(bytes.length.toLocaleString() + ' bytes'));
    await page.getByText('Preview downloaded image', {exact:true}).click();
    await page.waitForFunction(() => {
      const img = document.querySelector('img[alt="Last exported image"]');
      return img?.naturalWidth === 720 && img.naturalHeight === 600;
    });
    await page.screenshot({path:path.join(output,'actual-export-preview.png'),fullPage:true});
  });
});

test('UX02: whole-image resizing links dimensions, guards derived bounds, and resets crop without replacing the image', async () => {
  await pageFor(async page => {
    await upload(page, 'whole.png', 1200, 800);
    await page.getByRole('button', {name:'Use entire image',exact:true}).click();
    const width=page.getByRole('spinbutton',{name:'Width in pixels'});
    const height=page.getByRole('spinbutton',{name:'Height in pixels'});
    assert.equal(await width.inputValue(),'1200'); assert.equal(await height.inputValue(),'800');
    assert.equal(await page.getByRole('checkbox',{name:'Keep proportions'}).isChecked(),true);
    assert.match(await crop(page),/width: 100%;/); assert.match(await crop(page),/height: 100%;/);
    await width.fill('720'); await width.blur();
    assert.equal(await height.inputValue(),'480');
    await height.fill('7680');
    assert.equal(await width.inputValue(),'11520');
    assert.equal(await page.getByRole('button',{name:'Export Image',exact:true}).isEnabled(),false);
    await page.getByRole('button',{name:'Use entire image',exact:true}).click();
    assert.equal(await width.inputValue(),'1200'); assert.equal(await height.inputValue(),'800');
    // The same committed dimensions must also clear an invalid local draft.
    await width.fill('0');
    await page.getByRole('button',{name:'Use entire image',exact:true}).click();
    assert.equal(await width.inputValue(),'1200');
    assert.equal(await page.getByRole('button',{name:'Export Image',exact:true}).isEnabled(),true);
    const zoom=page.getByRole('slider',{name:'Zoom',exact:true});
    await zoom.focus(); await page.keyboard.press('End');
    await page.getByRole('button',{name:'Reset crop',exact:true}).click();
    assert.equal(await zoom.inputValue(),'1'); assert.match(await crop(page),/width: 100%;/);
    await page.getByRole('button',{name:'Freeform',exact:true}).click();
    await page.locator('.ReactCrop__drag-handle.ord-e').focus(); await page.keyboard.press('ArrowLeft');
    assert.doesNotMatch(await crop(page),/width: 100%;/);
    await page.getByRole('button',{name:'Reset crop',exact:true}).click();
    assert.match(await crop(page),/width: 100%;/); assert.match(await crop(page),/height: 100%;/);
    const result=await download(page,'JPEG','whole-reset');assert.equal(result.width,1200);assert.equal(result.height,800);
  });
});

test('UX03: cancelling or failing a replacement keeps the image and crop; an accepted replacement receives focus', async () => {
  await pageFor(async page => {
    await upload(page,'keep.png',1200,800);
    assert.equal(await page.getByRole('heading',{name:'EZCrop image editor'}).evaluate(el=>el===document.activeElement),true);
    const zoom=page.getByRole('slider',{name:'Zoom',exact:true});await zoom.focus();await page.keyboard.press('End');
    const selection=await crop(page);
    const chooser=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Upload a different image',exact:true}).click();
    await (await chooser).setFiles([]);
    assert.equal(await crop(page),selection);
    await page.locator('input[type=file]').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('broken')});
    await page.getByRole('alert').filter({hasText:'Your current crop is unchanged'}).waitFor();
    assert.equal(await crop(page),selection);
    assert.equal(await page.locator('header').getByText('keep.png',{exact:true}).isVisible(),true);
    assert.equal(await page.getByRole('button',{name:'Export Image',exact:true}).isEnabled(),true);
    await upload(page,'replacement.png',600,900);
    assert.equal(await page.getByRole('alert').count(),0);
    assert.equal(await page.getByRole('heading',{name:'EZCrop image editor'}).evaluate(el=>el===document.activeElement),true);
    assert.equal(await zoom.inputValue(),'1');
  });
});

test('UX04: pending settings stay explicit and cancellation preserves composition without a stale download', async () => {
  await pageFor(async page => {
    const downloads=[];page.on('download',d=>downloads.push(d.suggestedFilename()));
    await upload(page,'pending.png');await size(page,600,600);
    const selection=await crop(page);
    await page.getByRole('button',{name:'AVIF',exact:true}).click();
    await page.getByRole('button',{name:'Export Image',exact:true}).click();
    await page.getByRole('button',{name:'Cancel export',exact:true}).waitFor();
    await page.getByRole('button',{name:'JPEG',exact:true}).click();
    await page.getByRole('button',{name:'Square Medium (1000×1000)',exact:true}).click();
    assert.match(await page.getByRole('status').innerText(),/Exporting 600 × 600 AVIF at 85%/);
    assert.match(await page.getByRole('status').innerText(),/next export/);
    await page.getByRole('button',{name:'Cancel export',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Export cancelled'}).waitFor();
    assert.equal(await crop(page),selection);
    assert.equal(await page.getByRole('button',{name:'Export Image',exact:true}).isEnabled(),true);
    await page.waitForFunction(()=>document.activeElement?.textContent.includes('Export Image'));
    await page.waitForTimeout(100);assert.deepEqual(downloads,[]);
  },{init:()=>{
    const NativeWorker=window.Worker;
    window.Worker=class extends EventTarget{
      constructor(url,options){super();if(!String(url).includes('encode.worker'))return new NativeWorker(url,options);}
      postMessage(){} terminate(){}
    };
  }});
});

test('UX05: viewport fitting, mobile actions and larger controls remain reachable across narrow and short screens', async () => {
  await pageFor(async page => {
    await upload(page,'layout.png',800,1200);
    for(const [width,height] of [[1440,900],[844,390],[390,844],[320,568]]) {
      await page.setViewportSize({width,height}); await page.evaluate(()=>scrollTo(0,0));
      await page.waitForFunction(()=>{
        const i=document.querySelector('img[alt="Crop source"]')?.getBoundingClientRect();
        const f=document.querySelector('.editor-preview')?.getBoundingClientRect();
        return i&&f&&i.height<=f.height&&i.width<=f.width;
      });
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const bounds=await page.evaluate(()=>{
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
        return {image:rect('img[alt="Crop source"]'),toolbar:rect('.editor-toolbar'),actions:rect('.export-actions'),zoom:rect('input[aria-label="Zoom"]')};
      });
      assert.ok(bounds.image.top>=0 && bounds.image.bottom<=height,'Default fit keeps the image in the initial viewport');
      assert.ok(bounds.toolbar.bottom<=height,'Crop toolbar remains visible');
      assert.ok(bounds.actions.bottom<=height+1 && bounds.actions.top>=0,'Export stays on screen');
      assert.ok(bounds.zoom.height>=44);
      if(width<768){
        await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
        assert.ok((await page.locator('.export-actions').boundingBox()).y>=0);
      }
      await page.screenshot({path:path.join(output,`layout-${width}x${height}.png`),fullPage:false});
    }
  });
});

test('UX06: keyboard edge instructions and reduced motion match the rendered controls', async () => {
  await pageFor(async page => {
    await page.emulateMedia({reducedMotion:'reduce'});
    await upload(page);await page.getByRole('button',{name:'Freeform',exact:true}).click();
    for(const selector of ['.ReactCrop__drag-handle.ord-e','.ReactCrop__drag-handle.ord-w'])assert.match(await page.locator(selector).getAttribute('aria-label'),/left and right/);
    assert.equal(await page.locator('.ReactCrop__crop-selection').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.getByRole('button',{name:'Use entire image',exact:true}).click();
    await page.getByRole('button',{name:'Fit image to width',exact:true}).click();
    const before=await crop(page);
    await page.getByRole('button',{name:'Fit image to view',exact:true}).click();
    assert.equal(await crop(page),before);
    await page.setViewportSize({width:844,height:390});
    await page.getByRole('button',{name:'Fit image to width',exact:true}).click();
    await page.waitForFunction(()=>{
      const image=document.querySelector('img[alt="Crop source"]').getBoundingClientRect();
      const frame=document.querySelector('.editor-preview').getBoundingClientRect();
      return image.top>=frame.top && image.bottom>frame.bottom;
    });
    await page.locator('.editor-preview').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    const reachable=await page.evaluate(()=>document.querySelector('img[alt="Crop source"]').getBoundingClientRect().bottom<=document.querySelector('.editor-preview').getBoundingClientRect().bottom);
    assert.equal(reachable,true,'Width-fit preview can scroll all the way to the bottom');
  });
});

test('UX07: a stalled export image decode times out with recovery and leaves the editor usable', async () => {
  await pageFor(async page => {
    await upload(page);await size(page,100,100);
    await page.evaluate(()=>{window.holdExportImage=true;});
    await page.getByRole('button',{name:'Export Image',exact:true}).click();
    await page.getByRole('alert').filter({hasText:/prepare|time|JPEG|WebP/i}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Export Image',exact:true}).isEnabled(),true);
    await page.evaluate(()=>{window.holdExportImage=false;});
    assert.equal((await download(page,'JPEG','decode-timeout-recovery')).width,100);
  },{init:()=>{
    const NativeImage=window.Image;
    window.Image=class extends NativeImage{set src(value){if(!window.holdExportImage)super.src=value;}get src(){return super.src;}};
    const schedule=window.setTimeout.bind(window);
    window.setTimeout=(handler,delay,...args)=>schedule(handler,window.holdExportImage&&delay===20000?100:delay,...args);
  }});
});
