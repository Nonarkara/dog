const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const url=process.env.DOG_URL||'http://127.0.0.1:4178';
const out=process.env.DOG_EVIDENCE||'/tmp/dog-sleep-recovery';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const night=new Date(2026,9,30,22).getTime();
 await page.clock.setFixedTime(night);await page.goto(url);
 await page.waitForFunction(()=>(JSON.parse(localStorage.getItem('canine_os_save_v3')||'null')?.pets||{})['expo-2021']);
 // A save after several interrupted naps. No real owner data is used.
 await page.evaluate(at=>{
  const key='canine_os_save_v3',states=JSON.parse(localStorage.getItem(key)).pets,s=states['expo-2021'];
  states['expo-2021']={...s,updatedAt:at,arousal:40,needs:{hunger:90,energy:30,hygiene:100},sleep:{asleep:false,fellAsleepAt:null,wokenAt:at,wakeCount:3,restlessness:.72}};
  localStorage.setItem(key,JSON.stringify({...JSON.parse(localStorage.getItem(key)),pets:states}));
 },night);
 await page.reload();
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021']);
 await page.getByRole('button',{name:'Put Expo to bed',exact:true}).click();
 await page.getByText('Expo is restless. Give him some quiet time before trying bed again.',{exact:true}).waitFor();
 const before=await state();assert.equal(before.sleep.asleep,false);
 // Move wall time; normal browser intervals must apply recovery without a click.
 await page.clock.setFixedTime(night+2*3600000);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].sleep.asleep);
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.artPose==='sleep'&&document.querySelector('canvas')?.dataset.transition==='0');
 const after=await state();assert(after.needs.energy>before.needs.energy);assert(after.trust<=before.trust,'Rest cannot manufacture care rewards');
 assert(after.sleep.restlessness>=0&&after.sleep.restlessness<=1);
 await page.reload();await page.getByRole('button',{name:'Expo is asleep',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.artPose==='sleep'&&document.querySelector('canvas')?.dataset.transition==='0');
 assert((await state()).sleep.asleep,'Recovery persists after reload');
 await page.screenshot({path:out+'/recovered-sleep.png'});
 await page.clock.setFixedTime(night+3*3600000);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].sleep.wakeCount===0);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/report.json',JSON.stringify({before,after,final:await state(),errors},null,2));
 await browser.close();console.log('PASS restless bed refusal, autonomous quiet recovery, sleeping artwork, energy restoration, persistence, cleared wake tally; no browser errors.');
})().catch(error=>{console.error(error);process.exit(1);});
