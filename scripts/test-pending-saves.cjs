const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.env.DOG_URL||'http://127.0.0.1:4178';
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
const fresh=async()=>{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();
 await page.clock.setFixedTime(new Date(2026,9,30,12));
 await page.goto(url);
 await page.waitForFunction(()=>!!localStorage.getItem('canine_os_save_v3'));
 return page;
};
const hold=async page=>page.evaluate(async()=>{
 await new Promise((resolve,reject)=>{
  const request=indexedDB.open('canine_os_progress_mutex',1);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction('writer','readwrite');
   window.reviewHold=true;
   tx.oncomplete=()=>db.close();
   const loop=()=>{const req=tx.objectStore('writer').get('review-hold');req.onsuccess=()=>{if(window.reviewHold)loop();};};
   loop();resolve();
  };
 });
});
const release=async page=>{await page.evaluate(()=>window.reviewHold=false);};
let page=await fresh();
await hold(page);
await page.getByRole('button',{name:'Lure',exact:true}).click();
await page.getByRole('button',{name:'Treat',exact:true}).click();
assert(await page.getByRole('button',{name:'Treat',exact:true}).isDisabled(),'Second Treat must be disabled during save');
await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('Space');
await release(page);
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].lessons?.sit?.sessionTrials===1);
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].lessons.sit.sessionTrials),1);
await page.getByRole('button',{name:'Next trial',exact:true}).waitFor();
console.log('PASS practice duplicate guard');await page.context().close();
page=await fresh();
await page.getByRole('tab',{name:/^Vaccines,/}).click();
await page.getByRole('button',{name:'Record a dose',exact:true}).click();
await page.getByLabel('Vaccine name',{exact:true}).fill('Review dose');
await page.getByLabel('Next due',{exact:true}).fill('2027-10-30');
await hold(page);await page.getByRole('button',{name:'Save to passport',exact:true}).click();
assert(await page.getByRole('button',{name:'Save to passport',exact:true}).isDisabled(),'Second dose submit must be disabled');
await release(page);
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs[0].vaccinations.some(v=>v.name==='Review dose'));
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs[0].vaccinations.filter(v=>v.name==='Review dose').length),1);
console.log('PASS dose duplicate guard');await page.context().close();
page=await fresh();
await page.locator('[aria-controls="dog-switcher"]').click();
await page.getByRole('option',{name:'Enroll another dog'}).click();
await page.getByRole('textbox',{name:'Dog name',exact:true}).fill('Review enrollment');
await page.getByRole('textbox',{name:'Breed',exact:true}).fill('Mixed');
await page.getByRole('combobox',{name:'Sex',exact:true}).selectOption('female');
await hold(page);await page.getByRole('button',{name:'Create profile',exact:true}).click();
assert(await page.getByRole('button',{name:'Create profile',exact:true}).isDisabled(),'Second enrollment must be disabled');
await release(page);
await page.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs.some(v=>v.name==='Review enrollment'));
const dogs=await page.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs.filter(v=>v.name==='Review enrollment'));
assert.equal(dogs.length,1);assert.match(dogs[0].id,/^dog-[0-9a-f-]{36}$/);
console.log('PASS enrollment duplicate guard and UUID');await page.context().close();
page=await fresh();await hold(page);
await page.getByRole('button',{name:'Pet Expo',exact:true}).click();
await page.locator('[aria-controls="dog-switcher"]').click();await page.getByRole('option').filter({hasText:/^Mali/}).click();
await page.getByRole('button',{name:'Pet Mali',exact:true}).click();await release(page);
await page.waitForFunction(()=>{const pets=JSON.parse(localStorage.getItem('canine_os_save_v3')).pets;return pets['expo-2021']?.trust===64&&pets['mali-2022']?.trust===64;});
assert((await page.locator('[aria-controls="dog-switcher"]').innerText()).includes('Mali'));
console.log('PASS queued care stays with original dog across selection');await page.context().close();
page=await fresh();
await page.evaluate(()=>{
 const save=JSON.parse(localStorage.getItem('canine_os_save_v3'));save.pets['expo-2021'].trust=88;
 localStorage.setItem('canine_os_dogs_v1',JSON.stringify(save.dogs));
 localStorage.setItem('canine_os_pet_states_v1',JSON.stringify({...save.pets,'damaged-entry':{behaviours:{sit:null}}}));
 localStorage.removeItem('canine_os_save_v3');
});
await page.reload();await page.waitForFunction(()=>document.querySelector('.stage-note-slot')?.textContent.match(/Could not save|Saved progress could not be read/));
assert.equal(await page.evaluate(()=>localStorage.getItem('canine_os_save_v3')),null);
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_pet_states_v1'))['expo-2021'].trust),88);
console.log('PASS malformed migration refuses write, preserves valid legacy trust');await page.context().close();
page=await fresh();
const damaged=await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('canine_os_save_v3'));save.pets['expo-2021'].needs=null;const raw=JSON.stringify(save);localStorage.setItem('canine_os_save_v3',raw);return raw;});
await page.reload();await page.getByText('Saved progress could not be read. It has not been replaced.',{exact:true}).waitFor();
assert.equal(await page.evaluate(()=>localStorage.getItem('canine_os_save_v3')),damaged);
console.log('PASS damaged canonical save is not replaced with defaults');await page.context().close();
page=await fresh();
const before=await page.evaluate(()=>localStorage.getItem('canine_os_save_v3'));
await page.evaluate(()=>{
 const set=Storage.prototype.setItem;
 Storage.prototype.setItem=function(key,value){if(key==='canine_os_save_v3')throw new DOMException('Review forced quota','QuotaExceededError');return set.call(this,key,value);};
});
await page.getByRole('group',{name:'Care controls'}).getByRole('button',{name:'Pet Expo',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('.stage-note-slot')?.textContent.match(/Could not save|Saved progress could not be read/));
assert.equal(await page.evaluate(()=>localStorage.getItem('canine_os_save_v3')),before);
console.log('PASS forced quota failure preserves canonical bytes and reports error');await page.context().close();
}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
