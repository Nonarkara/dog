const {chromium}=require('playwright'),assert=require('node:assert/strict');
/* A HIDDEN TAB IS NOBODY HOME.
 *
 * A background tab keeps ticking. If those ticks ran the dog's fast "together"
 * clock, a game left open in another tab overnight would return a dog ill from
 * its own mess, which is exactly what the alone clock exists to prevent
 * (src/domain/dailyLife.ts ALONE_PACE). The pace is decided in the one decay
 * every commit runs (src/utils/progressStore.ts mutatePet), so this drives the
 * real page: same ticks, same three hours, page shown versus page hidden.
 */
const base=(process.env.DOG_URL||'http://127.0.0.1:4178').replace(/\/?\?.*$/,'').replace(/\/$/,'');
const pause=ms=>new Promise(r=>setTimeout(r,ms)); // real time: the page's own clock is under test
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:process.env.DOG_NATIVE_GL?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const run=async hidden=>{
   const p=await b.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(60000);
   await p.clock.install({time:new Date(2026,10,3,10)});
   await p.goto(base+'/?mode=play');
   await p.waitForFunction(()=>(JSON.parse(localStorage.getItem('canine_os_save_v3')||'null')?.pets||{})['expo-2021']);
   if(hidden)await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   // Three hours of the app's own ticks, one a minute: the rate a browser throttles a background tab to.
   for(let i=0;i<180;i++){await p.clock.fastForward(60_000);await pause(15);}
   await pause(300);
   const s=await p.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021']);
   await p.close();
   return {mess:(s.poopCount||0)+(s.life?.peeCount||0),bladder:s.life?.bladder??0,hunger:s.needs.hunger,sick:!!s.sick,updatedAt:s.updatedAt};
  };
  const shown=await run(false),hiddenTab=await run(true);
  assert(shown.mess>=2,`three hours together on the fast clock makes mess (got ${shown.mess})`);
  assert.equal(hiddenTab.mess,0,`three hours in a hidden tab makes no mess (got ${hiddenTab.mess}, bladder ${hiddenTab.bladder})`);
  assert(hiddenTab.bladder<30,`a hidden tab's bladder is on the alone clock (got ${hiddenTab.bladder})`);
  assert(!hiddenTab.sick);
  assert(Math.abs(shown.hunger-hiddenTab.hunger)<1.5&&hiddenTab.hunger<70,'fullness falls the same either way: only the body clock waits');
  console.log('PASS hidden tab: three hours of real ticks make',shown.mess,'messes when shown and',hiddenTab.mess,'when hidden; fullness falls the same.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
