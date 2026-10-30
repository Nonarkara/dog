const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.DOG_URL||'http://127.0.0.1:4178';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date(2026,9,30,12));await p.goto(base+'/?mode=play');await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.motionReady==='true');
const state=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021']);
await p.getByRole('button',{name:'Open Commons park'}).click();await p.waitForFunction(()=>document.querySelector('.park-world canvas')?.dataset.motionReady==='true');await p.getByRole('button',{name:'Back to dog'}).click();assert.equal((await state()).game?.lastOutingAt,undefined,'An empty visit earns nothing');
await p.getByRole('button',{name:'Open Commons park'}).click();await p.waitForFunction(()=>document.querySelector('.park-world canvas')?.dataset.motionReady==='true');
const start=await state(),canvas=p.locator('.park-world canvas'),frames=+(await canvas.getAttribute('data-frames'));
for(const key of ['d','s','a','w','d','s']){await p.keyboard.down(key);await p.waitForTimeout(3500);await p.keyboard.up(key);}
const rendered=+(await canvas.getAttribute('data-frames'))-frames;await p.getByRole('button',{name:'Back to dog'}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].game?.lastOutingAt>0);
const earned=await state();assert(earned.trust>=start.trust+3);assert(earned.game.coins>=start.game.coins+3);assert(earned.life.boredom<=start.life.boredom);await p.reload();await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.motionReady==='true');assert.equal((await state()).game.lastOutingAt,earned.game.lastOutingAt);assert.deepEqual(errors,[]);console.log('PASS actual park movement -> home benefit -> reload persistence; render updates during 21s:',rendered);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
