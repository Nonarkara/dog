const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.DOG_URL||'http://127.0.0.1:4190';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await browser.newPage({viewport:{width:390,height:844}});await p.clock.setFixedTime(new Date(2026,10,3,12));
 await p.route('**/api/me',r=>r.fulfill({json:{user:null,dog:null,providers:['google','line']}}));
 await p.goto(base+'/?mode=play');await p.waitForSelector('.region-stage canvas');
 await p.evaluate(()=>localStorage.setItem('tama_dog_chi_adoption_v1',JSON.stringify({dogId:'expo-2021',at:Date.now(),seed:'fixture-local-dog',name:'Local Expo'})));
 await p.goto(base+'/?mode=own');await p.waitForFunction(()=>!!localStorage.getItem('canine_os_save_v3_owned_v1'));
 const results=await p.evaluate(async()=>{
  const cloud=await import('/src/utils/cloud.ts'),store=await import('/src/utils/progressStore.ts');
  const backup=store.ownedBackup(),key='canine_os_save_v3_owned_v1',before=localStorage.getItem(key);
  const other=structuredClone(backup);other.adoption.seed='fixture-other-dog';other.save.adoption=other.adoption;other.save.pets[other.adoption.dogId].growth.seed=other.adoption.seed;other.save.revision=1;
  const account={user:{id:'account-B',name:'Owner',provider:'google'},dog:{name:'Account Expo',dog_id:'expo-2021',revision:1,backup:JSON.stringify(other),updated_at:Date.now()},providers:[]};
  const differentDog=await cloud.pullIfNewer(account),untouched=before===localStorage.getItem(key),blocked=!cloud.cloudOn();
  await cloud.resolveCloudDog(account);const resolved=store.ownedBackup().adoption.seed==='fixture-other-dog'&&cloud.cloudOn();
  localStorage.setItem('tama_dog_chi_cloud_owner','account-A');
  const otherAccount=await cloud.pullIfNewer({...account,dog:null}),accountBlocked=!cloud.cloudOn();
  // An identical companion in the same account resumes normally.
  localStorage.setItem('tama_dog_chi_cloud_owner','account-B');
  const sameDog=await cloud.pullIfNewer(account);
  // Capture fetch at the browser boundary. Simulate Chrome's real body ceiling.
  const native=window.fetch,calls=[];window.fetch=async(path,options)=>{if(path==='/api/dog'){const bytes=new TextEncoder().encode(options.body).length;calls.push({bytes,keepalive:options.keepalive,expectedAccountId:JSON.parse(options.body).expectedAccountId,baseRevision:JSON.parse(options.body).baseRevision,revision:JSON.parse(options.body).revision});if(options.keepalive&&bytes>65536)throw new TypeError('keepalive quota');return new Response('{}',{status:200});}return native(path,options);};
  localStorage.setItem('tama_dog_chi_cloud_owner','changed-in-another-tab');
  const small=await cloud.pushOwnedDog(true);
  const large=JSON.parse(localStorage.getItem(key));large.dogs[0].photos=[{url:'data:image/jpeg;base64,'+'A'.repeat(100000)}];localStorage.setItem(key,JSON.stringify(large));
  const big=await cloud.pushOwnedDog(true);
  localStorage.setItem('tama_dog_chi_cloud_owner','account-B');
  // Pulling a newer remote gives the local representation an extra revision.
  // Reopening without edits must not mistake that representation for new care.
  const newer=store.ownedBackup();newer.save.revision=10;
  const newerAccount={...account,dog:{...account.dog,revision:10,backup:JSON.stringify(newer)}};
  const pulled=await cloud.pullIfNewer(newerAccount),afterPull=localStorage.getItem(key);
  const noEditReopen=await cloud.pullIfNewer(newerAccount);
  const keptPulled=afterPull===localStorage.getItem(key);
  // Now both devices genuinely change from the same acknowledged base10.
  const offline=JSON.parse(localStorage.getItem(key));offline.revision+=1;offline.pets['expo-2021'].trust+=1;localStorage.setItem(key,JSON.stringify(offline));
  const localBeforeConflict=localStorage.getItem(key),remoteEdit=structuredClone(newer);remoteEdit.save.revision=11;remoteEdit.save.pets['expo-2021'].trust+=2;
  const editedAccount={...account,dog:{...account.dog,revision:11,backup:JSON.stringify(remoteEdit)}};
  const reopenedConflict=await cloud.pullIfNewer(editedAccount),conflictPreserved=localBeforeConflict===localStorage.getItem(key)&&!cloud.cloudOn();
  await cloud.resolveCloudDog(editedAccount);
  // Migration: same revision and a different history cannot be called newer.
  localStorage.removeItem('tama_dog_chi_cloud_base_v1');
  const ambiguous=store.ownedBackup();ambiguous.save.pets['expo-2021'].trust+=1;
  const migrationConflict=await cloud.pullIfNewer({...account,dog:{...account.dog,revision:ambiguous.save.revision,backup:JSON.stringify(ambiguous)}});
  await cloud.resolveCloudDog(editedAccount);
  let release;window.fetch=async(path,options)=>path==='/api/dog'?await new Promise(resolve=>release=resolve):native(path,options);
  const waiting=cloud.pushOwnedDog(),overlap=await cloud.pushOwnedDog();
  while(!release)await new Promise(resolve=>setTimeout(resolve,0));release(new Response('{}',{status:401}));await waiting;
  const expired=cloud.readSyncStatus()==='auth-required'&&!cloud.cloudOn();window.fetch=native;
  return{differentDog,untouched,blocked,resolved,otherAccount,accountBlocked,sameDog,small,big,calls,overlap,expired,pulled,noEditReopen,keptPulled,reopenedConflict,conflictPreserved,migrationConflict};
 });
 assert.equal(results.differentDog,'conflict');assert(results.untouched&&results.blocked&&results.resolved);assert.equal(results.otherAccount,'conflict');assert(results.accountBlocked);assert.equal(results.sameDog,'kept');assert.equal(results.small,'saved');assert.equal(results.big,'saved');assert.equal(results.calls[0].expectedAccountId,'account-B');assert(results.calls[0].keepalive);assert.equal(results.calls[0].baseRevision,1);assert.equal(results.calls[1].baseRevision,results.calls[0].revision);assert.equal(results.overlap,'skipped');assert(results.expired);assert.equal(results.pulled,'restored');assert.equal(results.noEditReopen,'kept');assert(results.keptPulled);assert.equal(results.reopenedConflict,'conflict');assert(results.conflictPreserved);assert.equal(results.migrationConflict,'conflict');assert(results.calls[1].bytes>65536&&!results.calls[1].keepalive);
 // Exercise the real entry gate with a second account, not only the utility.
 await p.route('**/api/me',r=>r.fulfill({json:{user:{id:'account-C',name:'Owner C',provider:'google'},dog:null,providers:['google']}}));
 await p.reload();await p.getByRole('heading',{name:'Two homes, two dogs'}).waitFor();assert.equal(await p.locator('.region-stage canvas').count(),0);assert(await p.getByRole('button',{name:'Download browser dog'}).isVisible());await p.getByRole('button',{name:'Save this dog to this account'}).click();await p.waitForSelector('.region-stage canvas');
 await p.getByRole('button',{name:/Dog save status/}).click();await p.getByRole('dialog',{name:'Your dog’s saves'}).waitFor();assert(await p.getByText(/Closing the page cannot guarantee/).isVisible());
 await p.getByRole('button',{name:'Close save status'}).click();
 await p.route('**/api/me',r=>r.abort('internetdisconnected'));await p.reload();await p.waitForSelector('.region-stage canvas');
 const beforeReconnect=await p.evaluate(()=>localStorage.getItem('canine_os_save_v3_owned_v1'));
 await p.evaluate(()=>window.dispatchEvent(new Event('online')));
 await p.getByRole('button',{name:'Dog save status: reconnect'}).waitFor();
 assert.equal(await p.evaluate(()=>localStorage.getItem('canine_os_save_v3_owned_v1')),beforeReconnect,'Reconnecting must never replace the active dog in the background');
 await p.getByRole('button',{name:'Dog save status: reconnect'}).click();await p.getByRole('button',{name:'Reopen dog and check saves'}).waitFor();
 console.log('PASS account identity gate, companion seed conflict, explicit resolution, no overwrite, small/large final uploads, visible save explanation',results);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
