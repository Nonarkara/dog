const{chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.DOG_URL||'http://127.0.0.1:4192';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date(2026,10,4,12));
 await p.goto(base+'/?mode=play');await p.waitForFunction(()=>document.querySelector('.region-stage canvas')?.dataset.motionReady==='true');
 await p.getByRole('button',{name:'Tricks and toys',exact:true}).click();await p.getByRole('button',{name:'Come closer',exact:true}).click();
 const samples=[];for(let i=0;i<22;i++){await p.waitForTimeout(45);samples.push(await p.locator('.region-stage canvas').evaluate(c=>({frame:+c.dataset.motionFrame,blend:+c.dataset.strideBlend})));}
 assert(samples.filter(s=>s.frame>=80&&s.frame<96&&s.blend>0&&s.blend<1).length>=5,'Toward-view legs must move between authored drawings, not freeze until next tile');
 await p.waitForTimeout(2600);await p.getByRole('button',{name:'Open Commons park'}).click();await p.waitForSelector('.park-world canvas');
 const park=p.locator('.park-world canvas');await p.waitForFunction(()=>+document.querySelector('.park-world canvas')?.dataset.frames>5);
 const own=[];for(let i=0;i<100;i++){await p.waitForTimeout(45);own.push(+(await park.getAttribute('data-blink')));}
 assert(own.some(v=>v>.35),'Park dog has independent natural blink rather than staring continuously');assert(own.some(v=>v===0),'Blink releases fully');assert.deepEqual(errors,[]);
 console.log('PASS authored toward gait in-betweens and independent park blink', {depthSamples:samples.filter(s=>s.frame>=80&&s.frame<96&&s.blend>0).length,blinkPeak:Math.max(...own)});
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
