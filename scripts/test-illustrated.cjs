const{chromium}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
const out=process.env.DOG_EVIDENCE||'/tmp/dog-illustrated';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({channel:'chrome'});const context=await b.newContext({viewport:{width:390,height:844}});const p=await context.newPage();p.setDefaultTimeout(60000);
 p.on('response',r=>{if(r.status()>=400)console.error('HTTP',r.status(),r.url());});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto(process.env.DOG_URL||'http://127.0.0.1:4178',{waitUntil:'domcontentloaded'});await p.bringToFront();
 await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.renderer==='illustrated-2d'&&+document.querySelector('canvas').dataset.frames>10);
 const cdp=await p.context().newCDPSession(p);const shot=async name=>{const{data}=await cdp.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,...p.viewportSize(),scale:1},captureBeyondViewport:true});fs.writeFileSync(`${out}/${name}.png`,Buffer.from(data,'base64'));};
 const facts=[];
 for(const[w,h]of[[390,844],[1024,768],[1440,900],[1280,720]]){
  await p.setViewportSize({width:w,height:h});await p.waitForFunction(()=>document.querySelector('.cockpit-workspace').classList.contains('cockpit-workspace--wide')===(innerWidth>=1024&&innerHeight>=820));
  await p.waitForTimeout(4500);
  const m=await p.evaluate(()=>{const c=document.querySelector('canvas'),a=document.querySelector('.command-bar').getBoundingClientRect(),s=document.querySelector('.stage-frame').getBoundingClientRect();return{w:innerWidth,h:innerHeight,pageW:document.documentElement.scrollWidth,pageH:document.documentElement.scrollHeight,fps:+c.dataset.fps,renderer:c.dataset.renderer,triangles:+c.dataset.triangles,calls:+c.dataset.drawCalls,stageW:s.width,stageH:s.height,actionBottom:a.bottom};});
  assert.equal(m.pageW,w);assert.equal(m.pageH,h);assert(m.actionBottom<=h+1);assert(m.stageH>=240);
  assert(m.fps>=27&&m.fps<=32,`30fps budget ${w}: ${m.fps}`);assert.equal(m.calls,2);facts.push(m);await shot(String(w));console.log('Viewport',m);
 }
 await p.setViewportSize({width:390,height:844});
 const choose=async name=>{await p.locator('[aria-controls="dog-switcher"]').click();await p.getByRole('option').filter({hasText:new RegExp('^'+name)}).click();await p.waitForFunction(id=>document.querySelector('canvas')?.dataset.dog===id&&+document.querySelector('canvas').dataset.frames>5,({Expo:'expo-2021',Mali:'mali-2022',Oreo:'oreo-frenchie',Paolo:'paolo-pug',Hachiku:'shiba-chai'})[name]);};
 for(const name of ['Expo','Mali','Oreo','Paolo','Hachiku']){if(name!=='Expo')await choose(name);await shot(name);}
 await choose('Paolo');
 for(const action of ['Pet','Feed','Walk','Groom']){
  const observed=await p.getByRole('button',{name:new RegExp('^'+action)}).evaluate(async el=>{el.click();for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,25));if(document.querySelector('canvas')?.dataset.action!=='idle')break;}return document.querySelector('canvas')?.dataset.action;});assert.equal(observed,action.toLowerCase());
  await p.waitForTimeout(350);await shot(action.toLowerCase()+'-0');await p.waitForTimeout(250);await shot(action.toLowerCase()+'-1');await p.waitForTimeout(1700);
 }
 // Touch the painted torso, not only a command button.
 const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['paolo-pug'].trust);
 await p.locator('canvas').first().click({position:{x:200,y:145}});await p.waitForTimeout(2500);
 const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['paolo-pug'].trust);assert(after>before,'Direct touch must reach the care state');
 // Bed uses the persistent sleep state, not a temporary flattened image.
 await p.getByRole('button',{name:'Put Paolo to bed',exact:true}).click();await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.artPose==='sleep');await shot('sleep');
 // Headless Chrome keeps its compositor visible; simulate the visibility
 // input to verify the renderer's pause branch without opening a user window.
 await p.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:true}));
 await p.waitForTimeout(150);const a=await p.locator('canvas').first().evaluate(c=>+c.dataset.frames);await p.waitForTimeout(900);const z=await p.locator('canvas').first().evaluate(c=>+c.dataset.frames);assert(z-a<3,'Hidden visibility input must pause rendering');await p.evaluate(()=>delete document.hidden);

 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify(facts,null,2));
 await b.close();
 const rb=await chromium.launch({channel:'chrome'}),rp=await rb.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await rp.goto(process.env.DOG_URL||'http://127.0.0.1:4178',{waitUntil:'domcontentloaded'});await rp.bringToFront();await rp.waitForFunction(()=>document.querySelector('canvas')?.dataset.reduced==='true');await rp.waitForTimeout(3500);const fps=await rp.locator('canvas').first().evaluate(c=>+c.dataset.fps);assert(fps<=7,'Reduced motion render budget');await rb.close();console.log('PASS: illustrated identity, four viewport fps/geometry, all core care motions, touch, sleep, simulated visibility pause and reduced motion.');
})().catch(e=>{console.error(e);process.exit(1)});
