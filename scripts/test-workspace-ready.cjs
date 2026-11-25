const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:process.env.DOG_BUNDLED_CHROMIUM?'chromium':'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:900}});await p.addInitScript(()=>{try{localStorage.setItem('tdc_record_open','0');}catch{}});/* the record starts open on a tall wide screen; these steps open it themselves */let releaseApp,releaseRecord,appRequested=false,recordRequested=false;
 const appHeld=new Promise(resolve=>releaseApp=resolve),recordHeld=new Promise(resolve=>releaseRecord=resolve);
 await p.route('**/App-*.js',async route=>{appRequested=true;await appHeld;await route.continue();});
 await p.route('**/RecordPanel-*.js',async route=>{recordRequested=true;await recordHeld;await route.continue();});
 await p.route('**/dogs/expo-sick.webp',route=>route.abort());
 await p.goto(process.env.DOG_URL||'http://127.0.0.1:4178/?mode=play',{waitUntil:'domcontentloaded'});
 await p.waitForSelector('.entry-loading');assert(appRequested);assert.equal(await p.locator('main').getAttribute('data-study-ready'),'false');
 const optionalFailure=p.waitForEvent('requestfailed',{predicate:r=>r.url().endsWith('/dogs/expo-sick.webp')});
 releaseApp();await optionalFailure;await p.waitForFunction(()=>+document.querySelector('.region-stage canvas')?.dataset.frames>3);await p.waitForFunction(()=>document.querySelector('main')?.dataset.studyReady==='true');
 // On the desktop column the record is a FOLD, not a tab: the tab row only
 // exists on a screen that can show one region at a time. Both open the same
 // lazily loaded RecordPanel, and the audit must wait for it either way.
 await p.getByRole('button',{name:'Record',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-workspace-loading]')?.textContent.includes('Record'));assert(recordRequested);assert.equal(await p.locator('main').getAttribute('data-study-ready'),'false');assert.equal(await p.locator('main').getAttribute('aria-busy'),'true');assert.equal(await p.locator('.region-record').count(),0);
 releaseRecord();await p.waitForFunction(()=>document.querySelector('main')?.dataset.studyReady==='true');assert.equal(await p.locator('main').getAttribute('aria-busy'),'false');assert(await p.locator('.region-record').isVisible());assert.equal(await p.locator('[data-workspace-loading]').count(),0);
 assert(await p.locator('.home-scene').isVisible(),'An unavailable optional pose must not replace the illustrated dog');
 console.log('PASS optional pose failure preserves the illustrated dog; delayed entry App and Record modules keep geometry audit waiting for real panels/art.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
