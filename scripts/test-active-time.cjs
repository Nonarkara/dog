const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.clock.install({time:new Date(2026,10,12,12)});
  await page.goto((process.env.DOG_URL||'http://127.0.0.1:3100')+'/?mode=play');
  await page.waitForSelector('.region-stage canvas');
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021']);
  await page.clock.fastForward(16_000);
  assert.equal((await read()).together?.totalSec??0,0,'A fresh open page with no activity cannot earn time or coins');
  await page.mouse.move(180,230);
  await page.clock.fastForward(16_000);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].together?.totalSec>0);
  const earned=(await read()).together.totalSec;
  assert(earned<=15);
  console.log('PASS passive page earned 0 seconds; deliberate activity earned',earned);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
