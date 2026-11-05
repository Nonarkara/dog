const{chromium}=require('playwright'),assert=require('node:assert/strict');
const{installPushFixture,ready}=require('./fixtures/push.cjs');
const base=process.env.DOG_URL||'http://127.0.0.1:4208';
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/New_York'}),p=await context.newPage(),fixture=await installPushFixture(p);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));await ready(p,base);
 const enable=p.getByRole('button',{name:'Let Expo call when the app is closed',exact:true});
 fixture.control.status=503;await enable.click();await p.getByText('Could not reach reminders. Try again.',{exact:true}).first().waitFor();
 assert.equal(await p.evaluate(()=>window.pushFixture.subscribed),false,'Failed registration rolls back a new browser subscription');assert(await enable.isVisible());
 fixture.control.status=200;await enable.click();const off=p.getByRole('button',{name:'Turn off calls for this browser',exact:true});await off.first().waitFor();assert(await off.first().isVisible(),'Enabling keeps a compact Turn off action');
 await p.getByRole('button',{name:'History and care details'}).click();const details=p.getByRole('dialog',{name:'Expo care details'});
 assert.equal(await details.getByRole('checkbox',{name:'One gentle follow-up'}).isChecked(),false,'Single call is default');
 await details.getByRole('checkbox',{name:'One gentle follow-up'}).check();assert.equal(await p.evaluate(()=>localStorage.getItem('tdc-push-followup-v1')),'true');
 await p.keyboard.press('Escape');
 // Exercise the production client against a real worker and IndexedDB. Force
 // only the page's hidden input; the visible-client guard still sees this tab.
 if(!process.env.DOG_UI_ONLY){
 await p.evaluate(async()=>{const m=await import('/src/utils/push.ts');await m.rememberEndpoint();window.testPush=m;});
 const first=fixture.requests.length;
 await p.evaluate(async()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});const raw=JSON.parse(localStorage.getItem('canine_os_save_v3'));await window.testPush.scheduleCall(raw.pets['expo-2021'],'Expo');delete document.visibilityState;});
 assert(fixture.requests.slice(first).every(r=>r.at===0),'A genuinely visible window prevents arming even if another page thinks it left');
 // Same-origin tabs allocate independent commands through actual IndexedDB.
 const p2=await p.context().newPage(),other=await installPushFixture(p2,{subscribed:true});await ready(p2,base);
 await p2.evaluate(async()=>{window.testPush=await import('/src/utils/push.ts');await window.testPush.rememberEndpoint();});
 const allocate=page=>page.evaluate(async()=>{const{pushRevision}=await import('/src/utils/pushState.ts');return Promise.all(Array.from({length:12},()=>pushRevision(undefined,'/?mode=own&source=call')));});
 const revisions=(await Promise.all([allocate(p),allocate(p2)])).flat();assert.equal(new Set(revisions).size,24,'Tabs never reuse a revision');
 // Hold an older hidden-page visibility reply while the other tab returns.
 await p.evaluate(()=>{
   Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
   window.originalSWPost=ServiceWorker.prototype.postMessage;
   ServiceWorker.prototype.postMessage=function(message,ports){if(message?.type==='dog-push-visible'){window.heldPresence=ports[0];return;}return window.originalSWPost.call(this,message,ports);};
   const s=JSON.parse(localStorage.getItem('canine_os_save_v3'));window.pendingArm=window.testPush.scheduleCall(s.pets['expo-2021'],'Expo');
 });
 await p.waitForFunction(()=>!!window.heldPresence);
 await p2.evaluate(()=>window.testPush.clearCall());
 const newer=other.requests.at(-1).revision;fixture.control.status=409;fixture.control.revision=newer;
 const oldCount=fixture.requests.filter(r=>r.at>0).length;
 await p.evaluate(async()=>{window.heldPresence.postMessage({visible:false});await window.pendingArm;ServiceWorker.prototype.postMessage=window.originalSWPost;delete document.visibilityState;});
 const sent=fixture.requests.filter(r=>r.at>0);assert.equal(sent.length,oldCount+1,'Stale requests are not retried');assert(sent.at(-1).revision<newer,'The old hidden intent cannot outrank the return');
 assert.equal(await p.evaluate(()=>window.testPush.pushProblem()),'','A cancelled older request is not a new player-facing error');
 fixture.control.status=200;await p2.close();await p.bringToFront();
 }
 // An unsubscribe refusal must not be reported as turned off.
 await p.evaluate(()=>window.pushFixture.unsubFail=true);await off.first().click();await p.getByText('Could not turn off calls. Try again in browser settings.',{exact:true}).first().waitFor();assert.equal(await p.evaluate(()=>window.pushFixture.subscribed),true);assert(await off.first().isVisible());
 await p.evaluate(()=>window.pushFixture.unsubFail=false);fixture.control.status=503;await off.first().click();await enable.waitFor();assert.equal(await p.evaluate(()=>window.pushFixture.subscribed),false,'Browser unsubscribe stops delivery even when server cleanup is offline');
 const cleanup=await p.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('tdc-reminder-state',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const state=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('current');r.onsuccess=()=>resolve(r.result);});db.close();return{state,closed:window.pushFixture.closed,badge:window.pushFixture.badgesCleared,cache:await caches.has('dog-push')};});assert.equal(cleanup.state.note,null);assert(cleanup.closed>0&&cleanup.badge>0);assert.equal(cleanup.cache,false);
 assert.deepEqual(errors,[]);console.log(process.env.DOG_UI_ONLY?'PASS reminder controls: failure recovery, compact off control, optional choice, unsubscribe refusal and offline cleanup':'PASS real client permission/server failure, compact off control, optional choice, visible-window guard, cross-tab IDB revisions, delayed old intent, unsubscribe refusal and offline cleanup');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
