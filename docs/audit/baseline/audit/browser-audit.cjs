// Audit-only harness. No application source is modified.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const runtime = 'C:/Users/mark/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const pw = require(runtime + '/playwright');
const sharp = require(runtime + '/sharp');
const base = process.env.EZCROP_BASE_URL || 'http://127.0.0.1:4173/ezcrop/';
const fixtureDir = path.join(__dirname, 'fixtures');
const output = path.resolve(__dirname, '../playwright');
fs.mkdirSync(path.join(output, 'exports'), { recursive: true });
const suite = process.argv[2] || 'matrix';
const filter = process.argv[3];
const results = { date: new Date().toISOString(), base, suite, browsers: {}, cases: [] };
const resultFile = path.join(__dirname, `browser-${suite}${filter ? '-' + filter : ''}.json`);
function record(name, status, data = {}) {
  const row = { name, status, ...data }; results.cases.push(row);
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(row)); return row;
}
async function check(name, fn) {
  try { await fn(); } catch (error) { record(name, 'error', { error: error.message }); }
}
async function fresh(browser, options = {}, init) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, ...options });
  if (init) await context.addInitScript(init);
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.audit = { requests: [], responses: [], errors: [], console: [] };
  page.on('request', r => { if (!r.url().startsWith('blob:') && !r.url().startsWith('data:')) page.audit.requests.push({ method: r.method(), url: r.url() }); });
  page.on('response', r => { if (r.status() >= 400 || /wasm|encode.worker/.test(r.url())) page.audit.responses.push({ url: r.url(), status: r.status() }); });
  page.on('pageerror', e => page.audit.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') page.audit.console.push(m.text()); });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 45000 });
  return { context, page };
}
async function upload(page, file = 'landscape.png', name) {
  if (await page.getByRole('button', { name: 'Upload a different image', exact: true }).count())
    await page.getByRole('button', { name: 'Upload a different image', exact: true }).click();
  const input = page.locator('input[type=file]');
  if (name) await input.setInputFiles({ name, mimeType: 'image/png', buffer: fs.readFileSync(path.join(fixtureDir, file)) });
  else await input.setInputFiles(path.join(fixtureDir, file));
  await page.getByAltText('Crop source').waitFor();
}
async function custom(page, width, height) {
  await page.getByRole('button', { name: 'Custom size', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Width in pixels' }).fill(String(width)); await page.keyboard.press('Tab');
  await page.getByRole('spinbutton', { name: 'Height in pixels' }).fill(String(height)); await page.keyboard.press('Tab');
}
async function crop(page) {
  return page.locator('.ReactCrop__crop-selection').evaluate(el => {
    const r = el.getBoundingClientRect(); return { style: el.getAttribute('style'), width: r.width, height: r.height, x: r.x, y: r.y };
  });
}
async function exported(page, format, label) {
  await page.getByRole('button', { name: format, exact: true }).click();
  const start = Date.now();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 45000 }), page.getByRole('button', { name: 'Export Image', exact: true }).click()]);
  const bytes = fs.readFileSync(await download.path());
  const saved = path.join(output, 'exports', label + '-' + download.suggestedFilename()); fs.writeFileSync(saved, bytes);
  const meta = await sharp(bytes).metadata();
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const positions = [[.1,.1], [.9,.1], [.1,.9], [.9,.9]];
  const samples = positions.map(([x,y]) => Array.from(data.subarray((Math.floor(info.height*y)*info.width+Math.floor(info.width*x))*4, (Math.floor(info.height*y)*info.width+Math.floor(info.width*x))*4+4)));
  const head = bytes.subarray(0, 16);
  const actual = head.subarray(0,2).toString('hex') === 'ffd8' ? 'JPEG' : head.subarray(0,8).toString('hex') === '89504e470d0a1a0a' ? 'PNG' : head.toString('ascii').includes('WEBP') ? 'WebP' : head.toString('ascii').includes('ftypavif') ? 'AVIF' : 'unknown';
  return { requested: format, actual, filename: download.suggestedFilename(), width: meta.width, height: meta.height, bytes: bytes.length, samples, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), elapsedMs: Date.now()-start, file: saved };
}
async function matrix(name, browser) {
  const session = await fresh(browser); const { page, context } = session;
  try {
    await upload(page);
    fs.writeFileSync(path.join(output, name+'-desktop.txt'), await page.locator('body').ariaSnapshot());
    const presets = [['Square Large (1600×1600)',1600,1600],['Square Medium (1000×1000)',1000,1000],['Square Small (600×600)',600,600],['Rectangle Tall (1920×1280)',1920,1280],['Rectangle Medium (1920×1080)',1920,1080],['Rectangle Short (1920×900)',1920,900],['Vertical Wide (1280×1920)',1280,1920],['Vertical Medium (1080×1920)',1080,1920],['Vertical Narrow (800×1920)',800,1920]];
    const checks=[];
    for(const [title,w,h] of presets){await page.getByRole('button',{name:title,exact:true}).click();await page.waitForFunction(({w,h})=>{const r=document.querySelector('.ReactCrop__crop-selection')?.getBoundingClientRect();return r&&Math.abs(r.width/r.height-w/h)<.015;},{w,h},{timeout:5000});const c=await crop(page);checks.push({title,expected:[w,h],output:(await page.getByRole('complementary',{name:'Crop options'}).innerText()).includes(w+'×'+h),aspectError:Math.abs(c.width/c.height-w/h)});}
    record(name+'/presets',checks.every(x=>x.output&&x.aspectError<.015)?'pass':'defect',{checks});
    const narrowBefore=await crop(page);await page.getByRole('slider',{name:'Zoom',exact:true}).focus();await page.keyboard.press('End');const narrowAfter=await crop(page);
    record(name+'/narrow-zoom',narrowAfter.width<narrowBefore.width?'pass':'defect',{before:narrowBefore,after:narrowAfter,slider:await page.getByRole('slider',{name:'Zoom',exact:true}).inputValue()});
    await page.getByRole('button',{name:'Square Small (600×600)',exact:true}).click();
    await page.getByRole('slider',{name:'Zoom',exact:true}).focus();await page.keyboard.press('End');const zoomBefore=await page.getByRole('slider',{name:'Zoom',exact:true}).inputValue();
    await page.getByRole('group',{name:'Use the arrow keys to move the crop selection area',exact:true}).focus();await page.keyboard.press('ArrowRight');
    record(name+'/keyboard-zoom',zoomBefore===await page.getByRole('slider',{name:'Zoom',exact:true}).inputValue()?'pass':'defect',{before:zoomBefore,after:await page.getByRole('slider',{name:'Zoom',exact:true}).inputValue()});
    const q=page.getByRole('slider',{name:'Quality',exact:true});await q.focus();await page.keyboard.press('Home');const lo=await q.inputValue();await page.keyboard.press('End');const hi=await q.inputValue();record(name+'/quality-range',lo==='60'&&hi==='100'?'pass':'defect',{low:lo,high:hi});
    await page.screenshot({path:path.join(output,name+'-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,name+'-mobile.png'),fullPage:true});
    const before=await page.getByAltText('Crop source').boundingBox();await page.getByRole('button',{name:'Switch to fit height',exact:true}).click();await page.waitForTimeout(600);const after=await page.getByAltText('Crop source').boundingBox();
    record(name+'/mobile-fit',after.height>=before.height*.5?'pass':'defect',{before,after,viewport:await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}))});
    record(name+'/network-and-console',page.audit.requests.every(x=>x.method==='GET')&&page.audit.errors.length===0?'pass':'defect',page.audit);
  } catch(error) { try { await page.screenshot({path:path.join(output,name+'-failure.png'),fullPage:true});fs.writeFileSync(path.join(output,name+'-failure.txt'),await page.locator('body').ariaSnapshot()); } catch {} throw error; } finally { await context.close(); }
  for(const format of ['WebP','JPEG','AVIF']) await check(name+'/export-'+format,async()=>{
    const {context,page}=await fresh(browser);
    try {await upload(page);await page.getByRole('button',{name:'Square Small (600×600)',exact:true}).click();const result=await exported(page,format,name);record(name+'/export-'+format,result.actual===format&&result.width===600&&result.height===600?'pass':'defect',{...result,network:page.audit});}
    finally{await context.close();}
  });
  await check(name+'/mobile-touch',async()=>{
    const {context,page}=await fresh(browser,{viewport:{width:390,height:844},hasTouch:true});
    try {await upload(page);await page.getByRole('button',{name:'Vertical Narrow (800×1920)',exact:true}).tap();record(name+'/mobile-touch','pass',{pressed:await page.getByRole('button',{name:'Vertical Narrow (800×1920)',exact:true}).getAttribute('aria-pressed')});}
    finally{await context.close();}
  });
}
async function inputs(browser) {
  for(const file of ['landscape.jpg','landscape.png','landscape.webp','landscape.bmp','landscape.tiff','animated.gif','corrupt.png','unsupported.svg','one-pixel.png']) await check('input/'+file,async()=>{
    const {context,page}=await fresh(browser);
    try {await page.locator('input[type=file]').setInputFiles(path.join(fixtureDir,file));await page.waitForFunction(()=>document.querySelector('img[alt="Crop source"]')||document.querySelector('[role=alert]'));const accepted=await page.getByAltText('Crop source').count()>0;const expected=!['corrupt.png','unsupported.svg'].includes(file);record('input/'+file,accepted===expected?'pass':'defect',{accepted,error:await page.getByRole('alert').allTextContents()});}
    finally{await context.close();}
  });
  const manifest=JSON.parse(fs.readFileSync(path.join(fixtureDir,'manifest.json'),'utf8'));
  for(const entry of manifest.orientations) await check('orientation/'+entry.value,async()=>{
    const {context,page}=await fresh(browser);
    try {await upload(page,entry.file);const displayed=await page.getByAltText('Crop source').evaluate(el=>({width:el.naturalWidth,height:el.naturalHeight}));await custom(page,entry.width,entry.height);const result=await exported(page,'JPEG','orientation-'+entry.value);const error=Math.max(...result.samples.flatMap((s,i)=>s.slice(0,3).map((v,j)=>Math.abs(v-entry.samples[i][j]))));record('orientation/'+entry.value,displayed.width===entry.width&&displayed.height===entry.height&&error<25?'pass':'defect',{displayed,expected:entry,result,maxChannelError:error});}
    finally{await context.close();}
  });
  for(const format of ['WebP','JPEG','AVIF']) await check('transparency/'+format,async()=>{
    const {context,page}=await fresh(browser);
    try {await upload(page,'transparent.png');await page.getByRole('button',{name:'Square Small (600×600)',exact:true}).click();const result=await exported(page,format,'transparency');const alpha=result.samples.every(s=>s[3]===0);record('transparency/'+format,format==='JPEG'?'observation':alpha?'pass':'defect',result);}
    finally{await context.close();}
  });
  for(const file of ['large-12mp.jpg','large-24mp.jpg']) await check('large/'+file,async()=>{
    const {context,page}=await fresh(browser);
    try {await page.evaluate(()=>{window.auditTicks=[];let last=performance.now();window.auditTimer=setInterval(()=>{const now=performance.now();window.auditTicks.push(now-last);last=now;},50);});const start=Date.now();await upload(page,file);const loadMs=Date.now()-start;await page.getByRole('button',{name:'Square Small (600×600)',exact:true}).click();const result=await exported(page,'JPEG','large');const ticks=await page.evaluate(()=>{clearInterval(window.auditTimer);return window.auditTicks;});record('large/'+file,result.width===600&&result.height===600?'pass':'defect',{loadMs,maxMainThreadGapMs:Math.max(...ticks),result});}
    finally{await context.close();}
  });
}
async function edgeCases(browser) {
  await check('custom/validation',async()=>{const {context,page}=await fresh(browser);try{await upload(page);await custom(page,800,600);await page.getByRole('slider',{name:'Zoom',exact:true}).focus();await page.keyboard.press('End');const before=await crop(page);await page.getByRole('spinbutton',{name:'Width in pixels'}).focus();await page.keyboard.press('Tab');const after=await crop(page);record('custom/unchanged-blur',before.style===after.style?'pass':'defect',{before,after});await page.getByRole('spinbutton',{name:'Width in pixels'}).fill('7681');await page.keyboard.press('Tab');const text=await page.getByRole('complementary',{name:'Crop options'}).innerText();record('custom/upper-bound',text.includes('7681×')?'defect':'pass',{text});await custom(page,1,7680);await page.getByRole('button',{name:'Export Image',exact:true}).click();await page.getByRole('alert').waitFor();record('custom/extreme-aspect','defect',{error:await page.getByRole('alert').allTextContents()});}finally{await context.close();}});
  await check('offline/first-avif',async()=>{const {context,page}=await fresh(browser);try{await upload(page);await context.setOffline(true);await page.getByRole('button',{name:'AVIF',exact:true}).click();await page.getByRole('button',{name:'Export Image',exact:true}).click();await page.getByRole('alert').waitFor({timeout:45000});record('offline/first-avif','defect',{error:await page.getByRole('alert').allTextContents()});}finally{await context.close();}});
  await check('storage/blocked',async()=>{const {context,page}=await fresh(browser,{},()=>{Storage.prototype.getItem=function(){throw new DOMException('Storage denied','SecurityError');};Storage.prototype.setItem=function(){throw new DOMException('Storage denied','SecurityError');};});try{await page.waitForTimeout(250);const usable=await page.getByRole('button',{name:'Upload image',exact:true}).count()>0;record('storage/blocked',usable?'pass':'defect',{usable,errors:page.audit.errors,body:await page.locator('body').innerText()});}finally{await context.close();}});
  await check('layout/long-name',async()=>{const {context,page}=await fresh(browser,{viewport:{width:390,height:844}});try{await upload(page,'landscape.png','x'.repeat(180)+'.png');const size=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));await page.screenshot({path:path.join(output,'long-unbroken-name.png'),fullPage:true});record('layout/long-name',size.scrollWidth<=size.viewport?'pass':'defect',size);}finally{await context.close();}});
}
(async()=>{
  const engines = suite==='matrix' ? ['chrome','edge','firefox','webkit'].filter(x=>!filter||filter===x) : ['chrome'];
  for(const name of engines){let browser;try{browser=name==='chrome'||name==='edge'?await pw.chromium.launch({headless:true,channel:name==='edge'?'msedge':'chrome'}):await pw[name].launch({headless:true});results.browsers[name]={version:browser.version(),engine:name};if(suite==='matrix')await matrix(name,browser);else if(suite==='inputs')await inputs(browser);else if(suite==='edges')await edgeCases(browser);else throw new Error('Unknown suite '+suite);}catch(error){record(name+'/suite','error',{error:error.message});}finally{if(browser)await browser.close();}}
  fs.writeFileSync(resultFile,JSON.stringify(results,null,2));console.log('RESULT_FILE '+resultFile);
})().catch(error=>{console.error(error);process.exitCode=1;});
