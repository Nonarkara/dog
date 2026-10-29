const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.DOG_URL||'http://127.0.0.1:4178',out=process.env.DOG_EVIDENCE||'/tmp/dog-training-walkthrough';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
try{
 const fresh=async(w=390,h=844,reduced=false)=>{const p=await browser.newPage({viewport:{width:w,height:h},reducedMotion:reduced?'reduce':'no-preference'});p.setDefaultTimeout(15000);await p.clock.setFixedTime(new Date(2026,9,30,12));await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await p.bringToFront();await p.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>8);if(w<1024||h<820)await p.getByRole('tab',{name:'Coach',exact:true}).click();return p;};
 const deck=p=>p.locator('[data-practice-phase]');
 const read=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')));
 const forceCue=async p=>{await p.evaluate(()=>{window.originalRandom=Math.random;Math.random=()=>.01;});await deck(p).getByRole('button',{name:'Lure',exact:true}).click();await p.evaluate(()=>{Math.random=window.originalRandom;});};
 const snap=async(p,name)=>{const c=await p.context().newCDPSession(p),{data}=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`${out}/${name}.png`,Buffer.from(data,'base64'));};
 const trial=async(p,name,label,capture)=>{
  const d=deck(p);await d.getByRole('button',{name:label,exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.pose==='stand');
  await p.waitForTimeout(950); // Return from previous reward drawing before cueing a fresh action.
  const before=(await read(p)).pets['expo-2021'];
  await forceCue(p);await p.waitForFunction(n=>document.querySelector('canvas')?.dataset.performancePose===n,name);
  const start=await p.evaluate(()=>performance.now());
  await p.waitForFunction(n=>{const c=document.querySelector('canvas');return c?.dataset.performancePose===n&&c.dataset.performanceDone==='true';},name);
  const rendered=await p.locator('.region-stage canvas').evaluate(c=>({...c.dataset}));
  assert.equal(rendered.transition,'0','The drawing must finish before completion');
  await d.getByRole('button',{name:'Yes! (mark)',exact:true}).click();
  await d.getByRole('button',{name:'Treat',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('[data-practice-phase]')?.dataset.practicePhase==='result');
  const after=(await read(p)).pets['expo-2021'];
  assert.equal(after.lessons[name].sessionTrials,(before.lessons?.[name]?.sessionTrials||0)+1);
  assert(after.lessons[name].skill>(before.lessons?.[name]?.skill??.2),`${name} should earn skill: ${JSON.stringify(after.lessons[name])}`);
  assert.deepEqual(after.behaviours,before.behaviours,'Virtual practice must not change self-reported real skills');
  report.push({name,viewport:p.viewportSize(),rendered,elapsedAfterRequest:+rendered.completedAt-start,lesson:after.lessons[name]});
  if(capture)await snap(p,`${p.viewportSize().width}-${name}`);
  await d.getByRole('button',{name:'Next trial',exact:true}).click();
 };
 let p;
 if(!process.env.DOG_TRAINING_ENROLL_ONLY){
 p=await fresh();
 for(const [name,label]of [['sit','Sit'],['down','Down'],['stay','Stay'],['come','Come'],['paw','Paw'],['wait','Wait'],['leaveIt','Leave it'],['fetch','Fetch']])await trial(p,name,label,true);
 const down=report.find(r=>r.name==='down');assert(down.elapsedAfterRequest>=750,'Down must await both registered drawing transitions, not an assumed 500ms');
 // A marker before the response still promises food; it must not score as patient waiting.
 await forceCue(p);await deck(p).getByRole('button',{name:'Yes! (mark)',exact:true}).click();assert(await deck(p).getByRole('button',{name:'Treat',exact:true}).isEnabled());await deck(p).getByRole('button',{name:'Treat',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-practice-phase]').dataset.practicePhase==='result');assert.match(await deck(p).innerText(),/Marked before the dog finished/);
 await deck(p).getByRole('button',{name:'Next trial',exact:true}).click();
 const beforeCancel=(await read(p)).pets['expo-2021'].lessons.fetch.sessionTrials;
 await forceCue(p);await p.getByRole('tab',{name:'Care',exact:true}).click();await p.waitForTimeout(4000);assert.equal((await read(p)).pets['expo-2021'].lessons.fetch.sessionTrials,beforeCancel,'Leaving practice cancels timers and late renderer acknowledgements');
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);assert.equal((await read(p)).pets['expo-2021'].lessons.fetch.sessionTrials,beforeCancel,'Practice progress reloads');await p.close();
 for(const[w,h]of[[1024,768],[1440,900],[1280,720]]){p=await fresh(w,h);await trial(p,'down','Down',true);await trial(p,'fetch','Fetch',true);await p.close();}
 p=await fresh(390,844,true);await trial(p,'fetch','Fetch',true);await trial(p,'stay','Stay',true);await p.close();
 }
 // Enrollment records only supplied facts, and must not copy the selected dog's photo.
 p=await fresh();await p.locator('[aria-controls="dog-switcher"]').click();await p.getByRole('option',{name:/Enroll another dog/}).click();const form=p.getByRole('dialog',{name:'Enroll a new dog'});await form.getByRole('textbox',{name:'Dog name',exact:true}).fill('Luna audit');await form.getByRole('textbox',{name:'Breed',exact:true}).fill('Mixed');await form.getByLabel('Sex',{exact:true}).selectOption('female');await form.getByRole('button',{name:'Create profile',exact:true}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs.some(d=>d.name==='Luna audit'));
 const dog=(await read(p)).dogs.find(d=>d.name==='Luna audit');assert.equal(dog.birthDate,'');assert.equal(dog.isNeutered,null);assert.equal(dog.microchipId,'Not recorded');assert.equal(dog.primaryPhotoUrl,'');assert.equal(dog.weightKg,0);assert.equal(dog.primaryVetClinic,'');assert.equal(dog.emergencyPhone,'');assert.deepEqual(dog.personalityTraits,[]);assert.deepEqual(dog.quirks,[]);assert.equal(dog.tamagotchi.lastFed,0);report.push({enrolled:dog});await p.reload({waitUntil:'domcontentloaded'});assert.equal((await read(p)).dogs.find(d=>d.id===dog.id).isNeutered,null);await p.close();
 fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(process.env.DOG_TRAINING_ENROLL_ONLY?'PASS honest enrollment and reload.':'PASS rendered completion for eight actions, early marker reward, cancellation/reload, four viewports, reduced motion, honest enrollment.',out);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
