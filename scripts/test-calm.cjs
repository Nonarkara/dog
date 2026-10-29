const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const url=process.env.DOG_URL||'http://127.0.0.1:4178';
const out=process.env.DOG_EVIDENCE||'/tmp/dog-calm';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
 for(const [width,height] of [[390,844],[1024,768],[1440,900],[1280,720]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const noon=new Date(2026,9,30,12).getTime();await page.clock.setFixedTime(noon);await page.goto(url);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_pet_states_v1')||'{}')['expo-2021']);
  await page.evaluate(at=>{
   const key='canine_os_pet_states_v1',states=JSON.parse(localStorage.getItem(key)),s=states['expo-2021'];
   states['expo-2021']={...s,updatedAt:at,discipline:20,arousal:40,trust:60,needs:{hunger:85,energy:80,hygiene:90},poopCount:0,call:{reason:'tantrum',since:at},life:{bladder:0,boredom:0,digestionMinutes:0,lowFullnessMinutes:0,peeCount:0}};
   localStorage.setItem(key,JSON.stringify(states));
  },noon);await page.reload();
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_pet_states_v1'))['expo-2021']);
  const pose=art=>page.waitForFunction(art=>document.querySelector('canvas')?.dataset.artPose===art&&document.querySelector('canvas')?.dataset.transition==='0',art);
  await page.getByRole('textbox',{name:'Say a word to Expo'}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Scold/}).count(),0);
  const before=await state();if(width===390){await page.getByRole('button',{name:'Find the treat',exact:true}).click();await page.locator('.treat-game').waitFor();}
  await page.getByRole('button',{name:'Quiet time',exact:true}).press('Enter');
  await page.locator('.treat-game').waitFor({state:'detached'});
  await pose('down');assert.equal((await state()).discipline,20);assert.equal((await state()).trust,before.trust);
  assert(await page.getByRole('button',{name:/Watch calm/}).isDisabled());
  assert(await page.getByRole('button',{name:'Zoomies',exact:true}).isDisabled());
  const m=await page.evaluate(()=>{
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right}};
   const canvas=rect('canvas'),note=rect('.stage-note-slot'),header=rect('header'),footer=rect('.command-bar');
   return {canvas,note,header,footer,pageW:document.documentElement.scrollWidth,pageH:document.documentElement.scrollHeight,
    careScroll:document.querySelector('.region-care .panel-body').scrollHeight-document.querySelector('.region-care .panel-body').clientHeight};
  });report.push({width,height,...m});
  assert.equal(m.pageW,width);assert.equal(m.pageH,height);assert(m.header.h+m.footer.h<=150);
  assert(m.canvas.b<=m.note.y+.01,'Feedback must sit below dog canvas');assert(m.careScroll<=1);
  const cdp=await page.context().newCDPSession(page),{data}=await cdp.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height,scale:1},captureBeyondViewport:true});fs.writeFileSync(`${out}/${width}x${height}-quiet.png`,Buffer.from(data,'base64'));
  await page.clock.setFixedTime(noon+3000);await page.waitForFunction(()=>document.querySelector('[aria-label="Reward calm"]')?.disabled===false);await page.getByRole('button',{name:'Reward calm',exact:true}).press('Enter');await pose('feed');
  const after=await state();assert.equal(after.discipline,25);assert(Math.abs(after.trust-(before.trust+2))<.001);assert.deepEqual(after.behaviours,before.behaviours);assert.equal(after.lastRealSessionAt,before.lastRealSessionAt);
  await page.reload();await page.getByRole('button',{name:'Quiet time',exact:true}).waitFor();assert.equal((await state()).discipline,25);
  await page.getByRole('button',{name:'Quiet time',exact:true}).click();assert(await page.getByRole('button',{name:/Watch calm/}).isDisabled());assert.equal((await state()).discipline,25,'Cooldown cannot award twice');
  // Ordinary care interrupts the quiet observation and leaves its own pose free.
  await page.waitForTimeout(2100);await page.getByRole('group',{name:'Care controls'}).getByRole('button',{name:'Pet Expo',exact:true}).click();assert.equal((await state()).calmSince,undefined);
  assert.deepEqual(errors,[]);await page.close();
 }
 const legacy=await browser.newPage({viewport:{width:390,height:844}});await legacy.clock.setFixedTime(new Date(2026,9,30,12));await legacy.goto(url);
 await legacy.locator('[aria-controls="dog-switcher"]').click();await legacy.getByRole('option').filter({hasText:/^Bangal/}).click();
 await legacy.getByRole('group',{name:'Care controls'}).getByRole('button',{name:'Play Bangal',exact:true}).click();await legacy.locator('.catch-hud').waitFor();
 await legacy.waitForFunction(()=>document.querySelector('[aria-label="Quiet time"]')?.disabled===false);
 await legacy.getByRole('button',{name:'Quiet time',exact:true}).click();await legacy.locator('.catch-hud').waitFor({state:'detached'});
 await legacy.close();await browser.close();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
 console.log('PASS keyboard quiet/watch/reward, no early/duplicate rewards, relaxed and feeding art, real-rep separation, persistence, care interruption; four viewport fit and no browser errors.');
})().catch(error=>{console.error(error);process.exit(1);});
