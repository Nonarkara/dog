const{chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const url=process.env.DOG_URL||'http://127.0.0.1:4178/?mode=play',out=process.env.DOG_EVIDENCE||'/tmp/dog-fallback-acts';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true}),report=[];try{
const context=await b.newContext({viewport:{width:390,height:844},recordVideo:{dir:out+'/video',size:{width:390,height:844}}}),p=await context.newPage();p.setDefaultTimeout(20000);await p.clock.setFixedTime(new Date(2026,9,30,12));await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);await p.evaluate(()=>{const k='canine_os_save_v3',s=JSON.parse(localStorage.getItem(k));s.dogs.find(d=>d.id==='expo-2021').avatarConfig.pattern='solid';localStorage.setItem(k,JSON.stringify(s));});await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.idleAct!==undefined);
// A healthy, energetic virtual-dog fixture; actual scene and transforms remain normal.
await p.evaluate(()=>{const k='canine_os_save_v3',s=JSON.parse(localStorage.getItem(k)),d=s.pets['expo-2021'];d.trust=90;d.arousal=80;d.needs.energy=80;d.needs.hunger=80;d.updatedAt=Date.now();localStorage.setItem(k,JSON.stringify(s));});await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);await p.bringToFront();assert(await p.getByRole('progressbar',{name:/80 percent, Wired/}).isVisible());const c=await context.newCDPSession(p);
for(const [name,draw]of[['shift',.01],['look',.15],['sniff',.25],['pawtip',.6],['hop',.7],['bow',.95]]){
 let found=false;
 for(let attempt=0;attempt<4&&!found;attempt++){
  await p.waitForFunction(()=>{const d=document.querySelector('canvas')?.dataset;return d?.idleAct==='none'&&+d.idleWait<.3&&+d.idleWait>.08;});
  const before=await p.locator('canvas').evaluate(c=>+c.dataset.idleStarts);
  // One draw only, after scene creation. Restoring immediately avoids constant UUID/random streams.
  await p.evaluate(value=>{const original=Math.random;Math.random=()=>{Math.random=original;return value;};},draw);
  await p.waitForFunction(n=>+document.querySelector('canvas')?.dataset.idleStarts>n,before);
  found=await p.locator('canvas').evaluate((c,name)=>c.dataset.idleAct===name,name);
 }
 assert(found,`Could not select ${name} in actual renderer`);
 await p.waitForFunction(name=>{const d=document.querySelector('canvas').dataset;return d.idleAct===name&&+d.idleWeight>.6&&(name!=='hop'||+d.bodyY>.025);},name);
 const before=await p.locator('canvas').evaluate(c=>({...c.dataset})),{data}=await c.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(`${out}/${name}.png`,Buffer.from(data,'base64'));report.push({name,before,after:await p.locator('canvas').evaluate(c=>({...c.dataset}))});
}
await context.close();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log('PASS all six actual fallback idle acts captured with one-shot controlled draw, real frame metadata and video.',out);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
