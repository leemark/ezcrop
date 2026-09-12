const fs=require('fs'), path=require('path');
const runtime='C:/Users/mark/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const pw=require(runtime+'/playwright'),sharp=require(runtime+'/sharp');
const results=[];
function record(name,data){results.push({name,...data});fs.writeFileSync(path.join(__dirname,'final-details.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)));}
async function color(locator){return locator.evaluate(el=>{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
 const ancestors=[];for(let p=el;p;p=p.parentElement)ancestors.push(p);
 ctx.fillStyle='#fff';ctx.fillRect(0,0,1,1);for(const p of ancestors.reverse()){ctx.fillStyle=getComputedStyle(p).backgroundColor;ctx.fillRect(0,0,1,1);}
 const bg=Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3),style=getComputedStyle(el);
 ctx.fillStyle=style.color;ctx.fillRect(0,0,1,1);const fg=Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3);
 const lum=a=>a.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);
 return{text:el.textContent.trim(),foreground:fg,background:bg,ratio:(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05),fontSize:style.fontSize};
});}
(async()=>{const browser=await pw.chromium.launch({channel:'chrome',headless:true});try{
 for(const dark of [false,true]){const context=await browser.newContext({viewport:{width:1200,height:900},colorScheme:dark?'dark':'light'});const page=await context.newPage();page.setDefaultTimeout(15000);try{
  await page.goto('http://127.0.0.1:4173/ezcrop/',{waitUntil:'networkidle'});
  record('contrast/upload-formats/'+dark,await color(page.getByText('JPEG · PNG · WebP · AVIF · GIF · BMP · TIFF',{exact:true})));
  record('contrast/footer/'+dark,await color(page.locator('footer span').first()));
  await page.getByRole('button',{name:'Upload image',exact:true}).focus();
  record('focus/upload/'+dark,await page.getByRole('button',{name:'Upload image',exact:true}).evaluate(el=>({focused:el===document.activeElement,outline:getComputedStyle(el).outline})));
  await page.locator('input[type=file]').setInputFiles(path.join(__dirname,'fixtures/landscape.png'));await page.getByAltText('Crop source').waitFor();
  record('contrast/selected-format/'+dark,await color(page.getByRole('button',{name:'WebP',exact:true}).locator('span')));
  record('contrast/inactive-preset/'+dark,await color(page.getByRole('button',{name:'Square Small (600×600)',exact:true}).locator('span')));
  const preset=page.getByRole('button',{name:'Square Small (600×600)',exact:true});await preset.focus();
  record('focus/preset/'+dark,await preset.evaluate(el=>({focused:el===document.activeElement,outline:getComputedStyle(el).outline})));
  await page.screenshot({path:path.resolve(__dirname,'../playwright/focus-preset-'+(dark?'dark':'light')+'.png'),fullPage:true});
  if(!dark){
   await page.getByRole('button',{name:'Custom size',exact:true}).click();const field=page.getByRole('spinbutton',{name:'Width in pixels'});
   for(const value of ['0','-1','','600.5','1e3','7681']){await field.fill(value);await field.blur();record('custom/value/'+value,{value:await field.inputValue(),options:await page.getByRole('complementary',{name:'Crop options'}).innerText()});}
  }
 }finally{await context.close();}}
 for(const quality of [60,100]){const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();try{
  await page.goto('http://127.0.0.1:4173/ezcrop/',{waitUntil:'networkidle'});await page.locator('input[type=file]').setInputFiles(path.join(__dirname,'fixtures/large-12mp.jpg'));await page.getByAltText('Crop source').waitFor();
  await page.getByRole('button',{name:'Square Small (600×600)',exact:true}).click();await page.getByRole('button',{name:'JPEG',exact:true}).click();const slider=page.getByRole('slider',{name:'Quality',exact:true});await slider.focus();await page.keyboard.press(quality===60?'Home':'End');
  const [d]=await Promise.all([page.waitForEvent('download',{timeout:45000}),page.getByRole('button',{name:'Export Image',exact:true}).click()]);const bytes=fs.readFileSync(await d.path());const meta=await sharp(bytes).metadata();const file=path.resolve(__dirname,'../playwright/exports/quality-'+quality+'.jpg');fs.writeFileSync(file,bytes);record('quality/jpeg/'+quality,{bytes:bytes.length,width:meta.width,height:meta.height,format:meta.format,file});
 }finally{await context.close();}}
}catch(e){record('runner/error',{error:e.message});process.exitCode=1;}finally{await browser.close();}})();
