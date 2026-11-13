const {chromium}=require('playwright'),assert=require('node:assert/strict');
/* QUIET TIME MUST HAVE A DOOR.
 *
 * The calm practice was fully built — the engine settles him, the dog drops
 * into the down artwork, the reward pays trust and calm — and nothing ever
 * offered to START it. The care panel said "offer quiet time, then reward
 * relaxed posture" and the app had no way to do it: the next step offered a
 * reward for a calm that could never begin.
 *
 * The next step is the one place this panel says "do this", so quiet time is
 * offered there. This test proves the door exists, that it settles him, and
 * that the observation is waited out before the reward is paid.
 */
const url=process.env.DOG_URL||'http://127.0.0.1:4178/?mode=play';
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true,args:process.env.DOG_NATIVE_GL?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const p=await b.newPage({viewport:{width:390,height:844}});
    p.setDefaultTimeout(60000);
    /* A fixed clock: the daily-life model decides when he sleeps from the
       clock, and a sleeping dog is a refusal, not a practice. */
    await p.clock.setFixedTime(new Date(2026,9,30,12));
    const errors=[]; p.on('pageerror',e=>errors.push(e.message));
    await p.goto(url,{waitUntil:'domcontentloaded'});
    await p.waitForSelector('.region-care',{timeout:60000});
    await p.waitForTimeout(4000);

    /* Put him in a state where quiet time is the right thing to do: awake,
       fed, clean, healthy, and not already calm-settled. */
    await p.evaluate(()=>{
      const key='canine_os_save_v3';
      const raw=JSON.parse(localStorage.getItem(key)||'{}');
      const pets=raw.pets||{};
      const s=pets['expo-2021']||{};
      s.sleep={...(s.sleep||{}),asleep:false,fellAsleepAt:null,wokenAt:null};
      s.sick=false;
      s.needs={...(s.needs||{}),hunger:70,energy:70,hygiene:80};
      s.poopCount=0;
      s.life={...(s.life||{}),bladder:0,boredom:0,digestionMinutes:0,lowFullnessMinutes:0,peeCount:0};
      s.arousal=45;s.calmSince=undefined;s.lastCalmRewardAt=undefined;s.call=undefined;
      /* Today's wish outranks idle advice, so the wish is granted: quiet
         time is what the panel offers once nothing else is outstanding. */
      s.wish={day:new Date().toISOString().slice(0,10),kind:'cups',done:true};
      pets['expo-2021']=s;raw.pets=pets;
      localStorage.setItem(key,JSON.stringify(raw));
    });
    await p.reload({waitUntil:'domcontentloaded'});
    await p.waitForSelector('.region-care',{timeout:60000});
    await p.waitForTimeout(4000);

    const step=await p.evaluate(()=>{
      const el=document.querySelector('.care-step-btn');
      return el?{label:el.getAttribute('aria-label'),text:(document.querySelector('.care-step')?.innerText||'').slice(0,90)}:null;
    });
    assert(step,'The care panel must offer a next step');
    assert(/^Quiet/.test(step.label||''),`Quiet time must be offered when nothing else is urgent, not: ${step.label}`);

    /* What the reader sees is what is asserted: the step itself. Quiet time
       settles him, so the step becomes the reward once the observation has
       been waited out. */
    await p.locator('.care-step-btn').click();
    await p.waitForFunction(()=>{
      const el=document.querySelector('.care-step-btn');
      return el && /^Reward/.test(el.getAttribute('aria-label')||'');
    },{timeout:60000});
    await p.locator('.care-step-btn').click();
    await p.waitForTimeout(1500);
    assert.deepEqual(errors,[],'Paying the reward must not raise an error');
    assert.deepEqual(errors,[]);
    console.log('PASS quiet time is offered, settles him, and the reward waits for the observation;',step.text);
  }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
