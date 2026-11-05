// Real text containment, not just document overflow. A 150% text preference
// must not clip the six needs or the illustrated training instructions.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.DOG_URL||'http://127.0.0.1:4205';
const out=process.env.DOG_EVIDENCE||'/tmp/dog-enlarged-console';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const results=[];
 try{
  for(const[width,height]of[[390,844],[1024,768],[1440,900]]){
   const context=await browser.newContext({viewport:{width,height}});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.clock.setFixedTime(new Date(2026,10,5,12));
   await page.goto(base+'/?mode=play');
   await page.waitForFunction(()=>+document.querySelector('.region-stage canvas')?.dataset.frames>5);
   await page.evaluate(()=>{
    const key='canine_os_save_v3',save=JSON.parse(localStorage.getItem(key));
    save.pets['expo-2021'].call={reason:'hungry',since:Date.now()};
    localStorage.setItem(key,JSON.stringify(save));
   });
   await page.reload();
   await page.waitForFunction(()=>+document.querySelector('.region-stage canvas')?.dataset.frames>8);
   await page.waitForSelector('.dog-daily-status--call');
   for(const enlarged of[false,true]){
    if(enlarged){
     // Snapshot every size first, so descendants are enlarged once, never
     // compounded through inheritance. This is text scaling, not canvas zoom.
     await page.evaluate(()=>{
      const sizes=[...document.querySelectorAll('body *')].map(element=>[element,parseFloat(getComputedStyle(element).fontSize)]);
      for(const[element,size]of sizes)element.style.setProperty('font-size',size*1.5+'px','important');
     });
     if(process.env.DOG_FALSIFY_ENLARGED==='1')await page.addStyleTag({content:'.training-pictures span{white-space:nowrap!important}@container dog-care(min-width:280px){.care-console:not(.care-detail-view) .care-meter-grid{grid-template-columns:repeat(6,minmax(0,1fr))!important}}'});
     await page.waitForTimeout(400);
    }
    const geometry=await page.evaluate(()=>{
     const rect=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
     const textRects=element=>{const range=document.createRange();range.selectNodeContents(element);return[...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}));};
     const meters=[...document.querySelectorAll('.care-console:not(.care-detail-view)>.care-body>.care-meter-grid .care-meter')].map(element=>({box:rect(element),text:textRects(element.querySelector('.care-meter-value>.data'))}));
     const steps=[...document.querySelectorAll('.training-pictures li')].map(element=>({label:element.textContent,box:rect(element),text:textRects(element.querySelector('span'))}));
     return{scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],stage:rect(document.querySelector('.region-stage')),care:rect(document.querySelector('.care-console')),header:rect(document.querySelector('.cockpit>header')),command:rect(document.querySelector('.command-bar')),dogZ:+getComputedStyle(document.querySelector('.dog-art-layer')).zIndex,statusZ:+getComputedStyle(document.querySelector('.dog-daily-status')).zIndex,meters,steps};
    });
    await page.screenshot({path:`${out}/console-${width}${enlarged?'-150':''}.png`});
    assert.deepEqual(geometry.scroll,[width,height],`${width} ${enlarged?'150%':'normal'} stays on one screen`);
    assert.equal(geometry.meters.length,6,'All six needs remain available');
    assert(geometry.dogZ>geometry.statusZ,'The dog paints in front of the text');
    if(width===390)assert(geometry.stage.h>=height/2,'Phone dog retains at least half the screen');
    for(const meter of geometry.meters)for(const text of meter.text)assert(text.left>=meter.box.x-1&&text.right<=meter.box.right+1,`${width} ${enlarged?'150%':'normal'} need value must fit its own meter: ${JSON.stringify({meter,text})}`);
    for(const step of geometry.steps)for(const text of step.text)assert(text.left>=step.box.x-1&&text.right<=step.box.right+1,`${width} ${enlarged?'150%':'normal'} training caption must fit its illustrated step: ${step.label}`);
    assert.deepEqual(errors,[],'No page errors');
    results.push({width,height,enlarged,...geometry});
   }
   await context.close();
  }
  fs.writeFileSync(out+'/geometry.json',JSON.stringify(results,null,2));
  console.log('PASS 390/1024/1440 normal and 150%: six need values and illustrated captions fit; phone hero, dog/text order and one-screen task preserved');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
