const{openToys}=require('./fixtures/open-toys.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const url=process.env.DOG_URL||'http://127.0.0.1:4178/?mode=play';
const out=process.env.DOG_EVIDENCE||'/tmp/dog-calm';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
 for(const [width,height] of [[390,844],[1024,768],[1440,900],[1280,720]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const noon=new Date(2026,9,30,12).getTime();await page.clock.setFixedTime(noon);await page.goto(url);
  await page.waitForFunction(()=>(JSON.parse(localStorage.getItem('canine_os_save_v3')||'null')?.pets||{})['expo-2021']);
  await page.evaluate(at=>{
   const key='canine_os_save_v3',states=JSON.parse(localStorage.getItem(key)).pets,s=states['expo-2021'];
   states['expo-2021']={...s,updatedAt:at,discipline:20,arousal:40,trust:60,needs:{hunger:60,energy:55,hygiene:90},poopCount:0,call:undefined,wish:{day:new Date(at).toISOString().slice(0,10),kind:'cups',done:true},life:{bladder:0,boredom:0,digestionMinutes:0,lowFullnessMinutes:0,peeCount:0}};
   localStorage.setItem(key,JSON.stringify({...JSON.parse(localStorage.getItem(key)),pets:states}));
  },noon);await page.reload();
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021']);
  const pose=art=>page.waitForFunction(art=>document.querySelector('canvas')?.dataset.artPose===art&&document.querySelector('canvas')?.dataset.transition==='0',art);
  await page.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);
  assert.equal(await page.getByRole('button',{name:/Scold/}).count(),0);
await openToys(page);
  const before=await state();if(width===390){await page.getByRole('button',{name:'Find the treat',exact:true}).click();await page.locator('.treat-game').waitFor();}
  // Quiet time is now the care panel's next-step button (offered when nothing else is outstanding).
  const quiet=()=>page.locator('.care-step-btn').filter({hasText:/^Quiet$/});
  await quiet().waitFor();await quiet().press('Enter');
  await page.locator('.treat-game').waitFor({state:'detached'});
  await pose('down');assert.equal((await state()).discipline,20);assert.equal((await state()).trust,before.trust);
  // The old disabled "Watch calm" button is now the care step's "Reward" button, which stays clickable: an early press must refuse and pay nothing.
  const reward=()=>page.locator('.care-step-btn').filter({hasText:/^Reward$/});
  await reward().waitFor();await page.waitForFunction(()=>!document.querySelector('.care-step-btn')?.disabled);await reward().click();await page.waitForTimeout(300);
  assert.equal((await state()).discipline,20,'Early reward pays nothing');assert.notEqual((await state()).calmSince,undefined,'Early reward keeps the quiet observation');
  assert(await page.getByRole('button',{name:'Zoomies',exact:true}).isDisabled());
  const m=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}};
   const canvas=rect('canvas'),note=rect('.stage-note-slot'),header=rect('header'),footer=rect('.command-bar');
   const floor=parseFloat(getComputedStyle(document.querySelector('canvas').parentElement).getPropertyValue('--dog-floor'));return {canvas,note,floor,header,footer,pageW:document.documentElement.scrollWidth,pageH:document.documentElement.scrollHeight,
    careScroll:document.querySelector('.region-care .panel-body').scrollHeight-document.querySelector('.region-care .panel-body').clientHeight};
  });report.push({width,height,...m});
  assert.equal(m.pageW,width);assert.equal(m.pageH,height);assert(m.header.h+m.footer.h<=150);
  // The one-line note may ride the stage's floor strip (it overlays the canvas bottom so the stage never resizes) but never his paws.
  assert(m.canvas.b<=m.note.y+.01||m.note.y>=m.canvas.y+m.floor-.01,`Feedback must sit below the dog (canvas bottom ${m.canvas.b}, note top ${m.note.y}, dog floor ${m.canvas.y+m.floor})`);assert(m.careScroll<=1);
  const cdp=await page.context().newCDPSession(page),{data}=await cdp.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height,scale:1},captureBeyondViewport:true});fs.writeFileSync(`${out}/${width}x${height}-quiet.png`,Buffer.from(data,'base64'));
  await page.clock.setFixedTime(noon+3000);await page.waitForFunction(()=>document.querySelector('.care-step-btn')?.disabled===false&&document.querySelector('.care-step-btn').textContent==='Reward');await reward().press('Enter');await pose('feed');
  const after=await state();assert.equal(after.discipline,25);assert(Math.abs(after.trust-(before.trust+2))<.001);assert.deepEqual(after.behaviours,before.behaviours);assert.equal(after.lastRealSessionAt,before.lastRealSessionAt);
  await page.reload();await quiet().waitFor();assert.equal((await state()).discipline,25);
  await quiet().click();await reward().waitFor();await page.waitForFunction(()=>!document.querySelector('.care-step-btn')?.disabled);await reward().click();await page.waitForTimeout(300);assert.equal((await state()).discipline,25,'Cooldown cannot award twice');
  // Ordinary care interrupts the quiet observation and leaves its own pose free.
  await page.waitForTimeout(2100);await page.getByRole('group',{name:'Care controls'}).getByRole('button',{name:'Pet Expo',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].calmSince===undefined);assert.equal((await state()).calmSince,undefined);
  // Reading help uses the existing information region, never a taller footer.
  await page.getByRole('button',{name:/^Show control labels/}).click();
  const legend=page.locator('.control-reference .control-legend');await legend.waitFor();
  assert.equal(await legend.locator(':scope > span').count(),9); // simplified legend: Feed/Pet/Play/Walk/Clean + Bed/Vitals/Medicine/Labels
  assert(await legend.evaluate(el=>el.scrollHeight<=el.clientHeight+1));
  assert(await legend.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  report[report.length-1].legend=await legend.evaluate(el=>({height:el.clientHeight,contentHeight:el.scrollHeight,width:el.clientWidth,contentWidth:el.scrollWidth,labels:el.children.length}));
  assert.equal(await page.locator('.command-bar').evaluate(el=>el.getBoundingClientRect().height),m.footer.h);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),height);
  await page.screenshot({path:`${out}/${width}x${height}-labels.png`});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.control-reference').count(),0);
  // The vitals modal also holds six meters; count only the console's own six.
  assert.equal(await page.locator('.region-care [role="progressbar"]').evaluateAll(els=>els.filter(e=>!e.closest('dialog,[role=dialog]')).length),6);
  await page.waitForFunction(()=>(document.activeElement.getAttribute('aria-label')||'').startsWith('Show control labels'));
  if(await page.getByRole('tab',{name:'Coach',exact:true}).count()){
   await page.getByRole('tab',{name:'Coach',exact:true}).click();await page.getByRole('button',{name:/^Show control labels/}).click();
   await page.locator('[aria-controls="dog-switcher"]').click();assert.equal(await page.locator('.control-reference').count(),0);
   await page.keyboard.press('Escape');assert.equal(await page.getByRole('tab',{name:'Coach',exact:true}).getAttribute('aria-selected'),'true');
   await page.getByRole('tab',{name:'Care',exact:true}).click();
  }
  if(width===390){
   await openToys(page);await page.getByRole('button',{name:'Find the treat',exact:true}).click();await page.waitForFunction(()=>/Tap a cup/.test(document.querySelector('.treat-instruction')?.textContent||''));
   const instruction=await page.locator('.treat-instruction').innerText();await page.getByRole('button',{name:/^Show control labels/}).click();
   await page.keyboard.press('1');assert.equal(await page.locator('.treat-instruction').innerText(),instruction);
   await page.keyboard.press('Escape');await page.locator('.control-reference').waitFor({state:'detached'});
   assert.equal(await page.locator('.treat-game').count(),1,'Escape closes help without consuming the game');
   await page.getByRole('button',{name:'Close three cups',exact:true}).click();
   await page.evaluate(html=>{const old=document.createElement('div');old.className='control-legend';old.style.cssText='display:flex;flex-wrap:wrap;flex-basis:100%;gap:4px 12px';old.innerHTML=html;document.querySelector('.command-bar').append(old);},Array.from({length:24},(_,i)=>`<span style="display:inline-flex;margin-right:12px">Control label ${i+1} (${i+1})</span>`).join('')); // the legend is 9 labels now; the guard injects the retired 24-label footer to prove the budget still catches an expansion
   const expandedChrome=await page.evaluate(()=>document.querySelector('header').getBoundingClientRect().height+document.querySelector('.command-bar').getBoundingClientRect().height);
   assert(expandedChrome>150,'Old footer expansion must fail the same 150px chrome budget');
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 // Bangal left the household chooser, so the second-dog catch game runs on Mali; fetch must be learned first or Play only shows the fetch introduction.
 const legacy=await browser.newPage({viewport:{width:390,height:844}});const legacyNoon=new Date(2026,9,30,12).getTime();await legacy.clock.setFixedTime(legacyNoon);await legacy.goto(url);
 await legacy.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);
 await legacy.locator('[aria-controls="dog-switcher"]').click();await legacy.getByRole('option').filter({hasText:/^Mali/}).click();await legacy.waitForFunction(()=>document.querySelector('canvas')?.dataset.dog==='mali-2022');
 await legacy.waitForFunction(()=>(JSON.parse(localStorage.getItem('canine_os_save_v3')||'null')?.pets||{})['mali-2022']);
 await legacy.evaluate(at=>{const key='canine_os_save_v3',save=JSON.parse(localStorage.getItem(key));for(const pet of [save.pets['mali-2022']])Object.assign(pet,{updatedAt:at,arousal:40,trust:60,needs:{hunger:60,energy:55,hygiene:90},poopCount:0,call:undefined,wish:{day:new Date(at).toISOString().slice(0,10),kind:'cups',done:true},life:{bladder:0,boredom:0,digestionMinutes:0,lowFullnessMinutes:0,peeCount:0},lessons:{...pet.lessons,fetch:{streak:0,misses:0,sessionTrials:0,...(pet.lessons&&pet.lessons.fetch),stage:1,skill:.6}}});localStorage.setItem(key,JSON.stringify(save));},legacyNoon);await legacy.reload();
 await legacy.reload();await legacy.waitForFunction(()=>document.querySelector('canvas')?.dataset.dog==='mali-2022'&&+document.querySelector('canvas').dataset.frames>5);
 await legacy.getByRole('group',{name:'Care controls'}).getByRole('button',{name:'Play Mali',exact:true}).click();await legacy.locator('.catch-hud').waitFor();
 await legacy.waitForFunction(()=>{const b=document.querySelector('.care-step-btn');return b&&b.textContent==='Quiet'&&!b.disabled;});
 await legacy.locator('.care-step-btn').click();await legacy.locator('.catch-hud').waitFor({state:'detached'});
 await legacy.close();await browser.close();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
 console.log('PASS keyboard quiet/watch/reward, no early/duplicate rewards, relaxed and feeding art, real-rep separation, persistence, care interruption; four viewport fit and no browser errors.');
})().catch(error=>{console.error(error);process.exit(1);});
