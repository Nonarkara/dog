const{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:900}});let releaseApp,releaseRecord,appRequested=false,recordRequested=false;
 const appHeld=new Promise(resolve=>releaseApp=resolve),recordHeld=new Promise(resolve=>releaseRecord=resolve);
 await p.route('**/App-*.js',async route=>{appRequested=true;await appHeld;await route.continue();});
 await p.route('**/RecordPanel-*.js',async route=>{recordRequested=true;await recordHeld;await route.continue();});
 await p.goto(process.env.DOG_URL||'http://127.0.0.1:4178/?mode=play',{waitUntil:'domcontentloaded'});
 await p.waitForSelector('.entry-loading');assert(appRequested);assert.equal(await p.locator('main').getAttribute('data-study-ready'),'false');
 releaseApp();await p.waitForFunction(()=>+document.querySelector('.region-stage canvas')?.dataset.frames>3);await p.waitForFunction(()=>document.querySelector('main')?.dataset.studyReady==='true');
 await p.getByRole('tab',{name:'Record',exact:true}).click();await p.waitForFunction(()=>document.querySelector('[data-workspace-loading]')?.textContent.includes('Record'));assert(recordRequested);assert.equal(await p.locator('main').getAttribute('data-study-ready'),'false');assert.equal(await p.locator('main').getAttribute('aria-busy'),'true');assert.equal(await p.locator('.region-record').count(),0);
 releaseRecord();await p.waitForFunction(()=>document.querySelector('main')?.dataset.studyReady==='true');assert.equal(await p.locator('main').getAttribute('aria-busy'),'false');assert(await p.locator('.region-record').isVisible());assert.equal(await p.locator('[data-workspace-loading]').count(),0);
 console.log('PASS delayed entry App and Record modules keep geometry audit waiting for real panels/art.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
