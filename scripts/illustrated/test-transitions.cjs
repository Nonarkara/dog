const {chromium}=require('playwright');const fs=require('fs');const assert=require('assert/strict');
const out=process.env.DOG_EVIDENCE||'/tmp/dog-transitions';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:680,height:650},recordVideo:{dir:out,size:{width:680,height:650}}});p.setDefaultTimeout(60000);const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto((process.env.DOG_URL||'http://127.0.0.1:3189')+'/scripts/illustrated/fixture.html');await p.bringToFront();await p.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>10);await p.waitForTimeout(1000);
const sample=async interrupt=>p.evaluate(async interrupt=>{
 const click=label=>[...document.querySelectorAll('button')].find(b=>b.textContent===label).click();
 const start=performance.now(),records=[];let pet=false,sleep=false,stand=false;
 click(interrupt?'sit':'sleep');
 while(performance.now()-start<2300){await new Promise(requestAnimationFrame);const elapsed=performance.now()-start;
  if(interrupt&&elapsed>80&&!pet){click('pet');pet=true;}if(interrupt&&elapsed>160&&!sleep){click('sleep');sleep=true;}if(interrupt&&elapsed>240&&!stand){click('stand');stand=true;}
  const d=document.querySelector('canvas').dataset;records.push({elapsed,art:d.artPose,phase:+d.transition,duration:+d.transitionMs,frames:+d.frames});
 }
 return records;
},interrupt);
const interrupted=await sample(true);await p.waitForFunction(()=>document.querySelector('canvas').dataset.artPose==='stand'&&document.querySelector('canvas').dataset.transition==='0');const settling=await sample(false);await p.waitForFunction(()=>document.querySelector('canvas').dataset.artPose==='sleep'&&document.querySelector('canvas').dataset.transition==='0');
for(const records of [interrupted,settling]){let last=null;for(const r of records){if(last&&last.art===r.art&&last.phase&&r.phase){assert(r.phase>=last.phase-.005,'An interrupted joint motion must not restart');assert.equal(r.duration,last.duration,'An active step must retain its duration');}last=r;}}
assert(interrupted.some(r=>r.art==='sit'&&r.duration===420&&r.elapsed>100),'Pet request must not shorten in-flight sit');const order=settling.map(r=>r.art).filter((a,i,arr)=>!i||a!==arr[i-1]);assert(order.includes('sit')&&order.includes('down')&&order.includes('sleep'),'Bed settles through sit and down');assert.deepEqual(errors,[]);fs.writeFileSync(out+'/progress.json',JSON.stringify({interrupted,settling,order},null,2));await p.close();await b.close();console.log('PASS opaque registered motion, latched duration, fast interrupted requests, stand/sit/down/sleep sequence.',out);})().catch(e=>{console.error(e);process.exit(1)});
