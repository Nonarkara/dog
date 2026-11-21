const{openToys}=require('./fixtures/open-toys.cjs');
const{chromium}=require('playwright');const fs=require('fs');const assert=require('assert/strict');
const url=process.env.DOG_URL||'http://127.0.0.1:4178/?mode=play',out=process.env.DOG_EVIDENCE||'/tmp/dog-daily-life';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(25000);
 const noon=new Date(2026,9,30,12).getTime();await p.clock.setFixedTime(noon);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto(url);await p.bringToFront();
 const ready=()=>p.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);
 await ready();const c=await p.context().newCDPSession(p);
 const shot=async n=>{const{data}=await c.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,...p.viewportSize(),scale:1},captureBeyondViewport:true});fs.writeFileSync(`${out}/${n}.png`,Buffer.from(data,'base64'));};
 const state=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021']);
 const original=await state();
 const seed=async patch=>{await p.clock.setFixedTime(noon);await p.evaluate(({base,patch,now})=>{const states=JSON.parse(localStorage.getItem('canine_os_save_v3')).pets;states['expo-2021']={...base,...patch,updatedAt:now};localStorage.setItem('canine_os_save_v3',JSON.stringify({...JSON.parse(localStorage.getItem('canine_os_save_v3')),pets:states}));localStorage.setItem('canine_os_active_dog_id','expo-2021');},{base:original,patch,now:noon});await p.reload();await ready();};
 const pose=async name=>p.waitForFunction(name=>document.querySelector('canvas').dataset.artPose===name&&document.querySelector('canvas').dataset.transition==='0',name);
 // The status bubble sits under the dog art; the canvas forwards a tap at its position, so tap like a finger does.
 const tap=async l=>{await l.waitFor();const b=await l.boundingBox();await p.mouse.click(b.x+b.width/2,b.y+b.height/2);};
 const life={bladder:0,boredom:0,digestionMinutes:0,lowFullnessMinutes:0,peeCount:0};
 // Autonomous wandering happens without a command and never awards care. A phone has no floor to complete a stride (the dog sniffs instead), so this runs on a desktop-width page.
 const wide=await b.newPage({viewport:{width:1440,height:900}});wide.setDefaultTimeout(25000);await wide.clock.setFixedTime(noon);await wide.goto(url);await wide.bringToFront();await wide.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);
 const wideState=()=>wide.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021']);
 const trust=(await wideState()).trust;await wide.waitForFunction(()=>document.querySelector('canvas').dataset.behaviour==='wandering',null,{timeout:90000});
 await wide.waitForFunction(()=>Math.abs(+document.querySelector('canvas').dataset.travelX)>.015,null,{timeout:60000});await wide.screenshot({path:`${out}/wandering.png`});assert.equal((await wideState()).trust,trust);assert.equal(await wide.locator('.dog-cheer').count(),0);await wide.close();await p.bringToFront();
 await seed({life:{...life,boredom:85},lessons:{...original.lessons,fetch:{streak:0,misses:0,sessionTrials:0,...(original.lessons&&original.lessons.fetch),stage:1,skill:.6}}}); // Play only starts catch once fetch is learned; otherwise it shows the fetch introduction
 await p.waitForFunction(()=>document.querySelector('canvas').dataset.mood==='bored');
 // A bored dog's acts are drawn from a pool (sigh/down, paw at the screen, head-tilt), so no single pose is guaranteed; wait for any settled bored pose, never plain standing.
 /* a bored dog acts from the bored pool (dogBehaviour.ts); three of its five acts are standing, so check the act, not a pose */await p.waitForFunction(()=>{const d=document.querySelector('canvas').dataset;return ['paw-screen','head-tilt','sighing','nose-nudge','wandering'].includes(d.behaviour)&&d.transition==='0';},null,{polling:100});await shot('bored');
 await tap(p.locator('.dog-daily-status button',{hasText:/Bored(… | — )play with me/})) /* the bubble text turns into the call wording "Bored — play with me" once he calls; its accessible name is "play Expo: <text>" */;await p.locator('.catch-hud').waitFor();assert((await state()).life.boredom<55);await p.getByTitle('Close mini-game').click();
 // An outdoor break prevents an indoor accident, without deleting existing mess.
 await seed({life:{...life,bladder:85,peeCount:1},poopCount:1});await p.locator('.dog-daily-status button',{hasText:'Need to go! · walk'}).waitFor();await shot('toilet-warning');await tap(p.locator('.dog-daily-status button',{hasText:'Need to go! · walk'}));
 // Walk is now a real park outing (move for 10s+, then go home) and empties the bladder: the toilet call is answered.
 await p.waitForFunction(()=>document.querySelector('.park-world canvas')?.dataset.motionReady==='true');
 for(const key of ['d','s','a','w','d','s']){await p.keyboard.down(key);await p.waitForTimeout(3500);await p.keyboard.up(key);}
 await p.getByRole('button',{name:'Back to dog'}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].life.bladder<70);assert((await state()).life.bladder<70);assert.equal((await state()).life.peeCount,1);assert.equal((await state()).poopCount,1);
 // Advance Date while normal animation/timers keep running: next 10s tick causes a wee.
 await seed({life:{...life,bladder:99.9}});await p.clock.setFixedTime(noon+10_000);await p.getByLabel('Having a wee').waitFor();await pose('sit');await shot('having-a-wee');assert.equal(await p.getByRole('button',{name:'Clean puddle',exact:true}).count(),1);assert(await p.getByRole('button',{name:'Clean puddle',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return el===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)||el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Puddle must not hide behind a call overlay');const peeAt=(await state()).life.lastPeedAt;assert.equal(peeAt,noon+10_000);await p.getByRole('button',{name:'Clean puddle',exact:true}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].life.peeCount===0);assert.equal((await state()).life.peeCount,0);await p.waitForTimeout(2300);await p.reload();await ready();assert.equal(await p.getByRole('button',{name:'Clean puddle',exact:true}).count(),0);assert.equal(await p.getByLabel('Having a wee').count(),0,'Old toilet event must not replay on reload');

 await seed({life:{...life,bladder:99.9}});await openToys(p);const interruptedTrust=(await state()).trust;await p.getByRole('button',{name:'Find the treat',exact:true}).click();await p.clock.setFixedTime(noon+10_000);await p.getByLabel('Having a wee').waitFor();assert.equal(await p.locator('.treat-game').count(),0);assert((await state()).trust<=interruptedTrust);
 await seed({sick:true,sickSince:noon,life});await pose('sick');await openToys(p);assert(await p.getByRole('button',{name:'Zoomies',exact:true}).isDisabled());await shot('sick');await tap(p.locator('.dog-daily-status button',{hasText:'Feeling poorly · medicine'}));await p.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].sick===false);assert.equal((await state()).sick,false);await p.waitForTimeout(2400);await pose('stand');await shot('recovered');
 await seed({sleep:{...original.sleep,asleep:true,fellAsleepAt:noon},life:{...life,peeCount:1}});await pose('sleep');await shot('sleeping');await p.getByRole('button',{name:'Clean puddle',exact:true}).click();assert((await state()).sleep.asleep);await p.waitForTimeout(2300);await p.getByRole('group',{name:'Care controls'}).getByRole('button',{name:/^Pet /}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].sleep.asleep===false);assert.equal((await state()).sleep.asleep,false);await p.waitForTimeout(2400);await pose('stand');
 // A fresh, tired dog puts itself down; a restored nap wakes naturally.
 await seed({needs:{...original.needs,energy:10},life});await p.clock.setFixedTime(noon+10_000);await p.waitForFunction(()=>document.querySelector('canvas').dataset.mood==='sleeping');await pose('sleep');await shot('automatic-nap');
 await seed({sleep:{...original.sleep,asleep:true,fellAsleepAt:noon-61*60_000},life,needs:{...original.needs,energy:80}});await p.clock.setFixedTime(noon+10_000);await p.waitForFunction(()=>document.querySelector('canvas').dataset.mood!=='sleeping');assert.equal((await state()).sleep.wakeCount,0);
 // A genuinely different household dog has independent bladder/boredom/mess.
 await seed({life:{...life,bladder:88,boredom:77,peeCount:2}});await p.locator('[aria-controls="dog-switcher"]').click();await p.getByRole('option').filter({hasText:/^Mali/}).click();await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.dog==='mali-2022');assert.equal(await p.getByRole('button',{name:'Clean puddle',exact:true}).count(),0);assert.equal((await state()).life.peeCount,2);
 assert.deepEqual(errors,[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);
 await p.close();
 const reduced=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await reduced.clock.setFixedTime(noon);await reduced.goto(url);await reduced.bringToFront();await reduced.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);await reduced.waitForTimeout(10000);assert.equal(+(await reduced.locator('canvas').first().getAttribute('data-travel-x')),0);assert.equal(await reduced.locator('canvas').first().getAttribute('data-reduced'),'true');await reduced.close();
 await b.close();console.log('PASS autonomous wandering, boredom/play, outdoor toilet, live pee/clean/persistence, sickness/recovery, quiet cleaning, automatic sleep/wake, dog isolation, reduced motion; zero browser errors.',out);
})().catch(e=>{console.error(e);process.exit(1)});
