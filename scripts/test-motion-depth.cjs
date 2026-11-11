const{chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.DOG_URL||'http://127.0.0.1:4192';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date(2026,10,4,12));
 await p.goto(base+'/?mode=play');await p.waitForFunction(()=>document.querySelector('.region-stage canvas')?.dataset.motionReady==='true');
 await p.getByRole('button',{name:'Tricks and toys',exact:true}).click();
 await p.evaluate(()=>{
   const canvas=document.querySelector('.region-stage canvas'),samples=[];
   let last;
   window.comeSamples=samples;
   const observer=new MutationObserver(()=>{
     const {frames,motionFrame,strideBlend,trick,fit}=canvas.dataset;
     if(frames===last)return;
     last=frames;
     samples.push({frame:+motionFrame,blend:+strideBlend,trick,fit:+fit});
     if(trick!=='come'&&samples.at(-2)?.trick==='come')observer.disconnect();
   });
   observer.observe(canvas,{attributes:true,attributeFilter:['data-frames']});
 });
 await p.waitForFunction(()=>window.comeSamples.length>0);
 await p.getByRole('button',{name:'Come closer',exact:true}).click();
 await p.waitForFunction(()=>window.comeSamples.at(-2)?.trick==='come'&&window.comeSamples.at(-1).trick!=='come');
 const samples=await p.evaluate(()=>window.comeSamples);
 const start=samples.findIndex(s=>s.trick==='come');
 const approach=samples.slice(start,-1).filter(s=>s.frame>=0);
 const depthSamples=approach.filter(s=>s.frame>=80&&s.frame<96&&s.blend>0&&s.blend<1);
 const firstFrame=approach[0]?.frame,lastFrame=approach.at(-1)?.frame;
 assert(Math.min(Math.abs(firstFrame-48),Math.abs(firstFrame-64))<=2,'Come begins with a turn from the standing side');
 assert(Math.abs(lastFrame-firstFrame)<=2,'Come ends on the same standing side');
 const maxFitStep=Math.max(...samples.slice(start).map((s,i)=>Math.abs(s.fit/samples[start+i-1].fit-1)));
 assert(maxFitStep<.025,`Come changes apparent size gradually, got ${(maxFitStep*100).toFixed(1)}% in one frame`);
 assert(depthSamples.length>=5,'Toward-view legs must move between authored drawings, not freeze until next tile');
 await p.getByRole('button',{name:'Open Commons park'}).click();await p.waitForSelector('.park-world canvas');
 const park=p.locator('.park-world canvas');await p.waitForFunction(()=>+document.querySelector('.park-world canvas')?.dataset.frames>5);
 const own=[];for(let i=0;i<100;i++){await p.waitForTimeout(45);own.push(+(await park.getAttribute('data-blink')));}
 assert(own.some(v=>v>.35),'Park dog has independent natural blink rather than staring continuously');assert(own.some(v=>v===0),'Blink releases fully');assert.deepEqual(errors,[]);
 console.log('PASS approach turns, scale continuity, toward gait in-betweens, and independent park blink', {depthSamples:depthSamples.length,maxFitStep,blinkPeak:Math.max(...own)});
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
