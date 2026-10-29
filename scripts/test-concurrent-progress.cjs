const{chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
const url=process.env.DOG_URL||'http://127.0.0.1:4178',out=process.env.DOG_EVIDENCE||'/tmp/dog-concurrent',old=process.env.DOG_EXPECT_OLD==='1';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:390,height:844}});
 const a=await context.newPage(),b=await context.newPage(),noon=new Date(2026,9,30,12).getTime();
 // Deliberately withhold update events from B: correctness must not rely on an event arriving before the next mutation.
 await b.addInitScript(()=>window.addEventListener('storage',event=>event.stopImmediatePropagation(),true));
 for(const page of[a,b]){await page.clock.setFixedTime(noon);await page.goto(url);await page.getByRole('button',{name:'Pet Expo',exact:true}).waitFor();}
 const state=()=>b.evaluate(()=>{const s=JSON.parse(localStorage.getItem('canine_os_save_v3')||'null');return s?s.pets['expo-2021']:JSON.parse(localStorage.getItem('canine_os_pet_states_v1'))['expo-2021'];});
 await a.getByRole('group',{name:'Care controls'}).getByRole('button',{name:'Pet Expo',exact:true}).click();
 await a.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('canine_os_save_v3')||'null');return(s?s.pets['expo-2021']:JSON.parse(localStorage.getItem('canine_os_pet_states_v1'))?.['expo-2021'])?.trust>=64;});
 const afterCare=await state();await a.close();await b.clock.setFixedTime(noon+10000);
 await b.waitForFunction(at=>{const s=JSON.parse(localStorage.getItem('canine_os_save_v3')||'null');return(s?s.pets['expo-2021']:JSON.parse(localStorage.getItem('canine_os_pet_states_v1'))?.['expo-2021'])?.updatedAt>=at;},noon+10000);
 const afterTick=await state();fs.writeFileSync(out+'/report.json',JSON.stringify({afterCare,afterTick},null,2));
 if(old){assert(afterTick.trust<61);console.log('BASELINE: passive stale tab erased a newer care action.');await browser.close();return;}
 assert(afterTick.trust>63.9,'A passive stale tab must preserve the newer care reward');
 const save=()=>b.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')));
 const c=await context.newPage();await c.goto(url);await c.getByRole('button',{name:'Pet Expo',exact:true}).waitFor();
 const pet=page=>page.getByRole('group',{name:'Care controls'}).getByRole('button',{name:'Pet Expo',exact:true}).click();
 let expected=(await save()).pets['expo-2021'].trust;
 for(let i=0;i<3;i++){
  await Promise.all([pet(b),pet(c)]);expected+=8;
  await b.waitForFunction(target=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].trust>=target-.001,expected);
  await b.waitForTimeout(2100);
 }
 const choose=async(page,name)=>{await page.locator('[aria-controls="dog-switcher"]').click();await page.getByRole('option').filter({hasText:new RegExp('^'+name)}).click();};
 await choose(c,'Mali');await c.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['mali-2022']);
 const maliBefore=(await save()).pets['mali-2022'].trust;
 await Promise.all([pet(b),c.getByRole('button',{name:'Pet Mali',exact:true}).click()]);
 await b.waitForFunction(({e,m})=>{const s=JSON.parse(localStorage.getItem('canine_os_save_v3'));return s.pets['expo-2021'].trust>=e-.001&&s.pets['mali-2022'].trust>=m-.001;},{e:expected+4,m:maliBefore+4});
 assert((await b.locator('[aria-controls="dog-switcher"]').innerText()).includes('Expo'),'Other tab selection stays independent');
 await choose(c,'Expo');await c.getByRole('tab',{name:'Coach',exact:true}).click();await c.getByRole('button',{name:'REAL LOG',exact:true}).click();
 await c.getByLabel('Manual delay',{exact:true}).fill('100');
 await Promise.all([pet(b),c.getByRole('button',{name:'Log',exact:true}).click()]);
 await b.waitForFunction(expected=>{const p=JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'];return p.behaviours.sit?.reps===1&&p.trust>expected+8;},expected);
 let trained=(await save()).pets['expo-2021'];assert(trained.trust>expected+8,'Care and real training rewards both survive');
 const strength=trained.behaviours.sit.strength;
 await c.getByRole('button',{name:'Next rep',exact:true}).click();await c.getByRole('button',{name:'REHEARSAL',exact:true}).click();await c.getByLabel('Manual delay',{exact:true}).fill('100');await c.getByRole('button',{name:'Log',exact:true}).click();
 await b.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021'].behaviours.sit.rehearsals===1);
 trained=(await save()).pets['expo-2021'];assert.equal(trained.behaviours.sit.reps,1);assert.equal(trained.behaviours.sit.strength,strength);
 // Record edits and care share the same atomic envelope.
 await c.getByRole('tab',{name:'Record',exact:true}).click();await c.getByRole('tab',{name:/Vaccin/}).click();await c.getByRole('button',{name:/Record a dose/}).click();
 await c.getByLabel('Vaccine name',{exact:true}).fill('Concurrency test dose');
 await c.getByLabel('Next due',{exact:true}).fill('2027-10-30');
 await Promise.all([c.getByRole('button',{name:'Save to passport',exact:true}).click(),pet(b)]);
 await b.waitForFunction(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs.find(d=>d.id==='expo-2021').vaccinations.some(v=>v.name==='Concurrency test dose'));
 const record=(await save()).dogs.find(d=>d.id==='expo-2021');assert.equal(record.vaccinations.filter(v=>v.name==='Concurrency test dose').length,1);assert.equal(record.tamagotchi.happiness,Math.round(record.tamagotchi.happiness));
 const snapshot=await save();fs.writeFileSync(out+'/shared-tab-report.json',JSON.stringify(snapshot,null,2));
 // A legacy format is migrated once; old running code can never replace the new envelope.
 const migratedContext=await browser.newContext({viewport:{width:390,height:844}}),m=await migratedContext.newPage();
 snapshot.dogs.find(d=>d.id==='expo-2021').distinctiveMarks.push('Owner note preserved');snapshot.pets['expo-2021'].trust=88;
 await m.addInitScript(s=>{localStorage.setItem('canine_os_dogs_v1',JSON.stringify(s.dogs));localStorage.setItem('canine_os_pet_states_v1',JSON.stringify(s.pets));},snapshot);
 await m.clock.setFixedTime(noon+10000);await m.goto(url);await m.waitForFunction(()=>!!localStorage.getItem('canine_os_save_v3'));
 const migrated=await m.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')));
 assert.equal(migrated.pets['expo-2021'].trust,88);assert.equal(migrated.pets['expo-2021'].behaviours.sit.reps,1);assert(migrated.dogs.find(d=>d.id==='expo-2021').distinctiveMarks.includes('Owner note preserved'));
 const writer=await migratedContext.newPage();await writer.route(url,route=>route.fulfill({contentType:'text/html',body:'<title>Older tab fixture</title>'}));await writer.goto(url);
 await writer.evaluate(()=>localStorage.setItem('canine_os_pet_states_v1',JSON.stringify({'expo-2021':{trust:1}})));
 await m.getByText(/An older dog tab is open/).waitFor();assert.equal((await m.evaluate(()=>JSON.parse(localStorage.getItem('canine_os_save_v3')))).pets['expo-2021'].trust,88);
 // A failed atomic write cannot change bytes or claim a successful action.
 await m.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='canine_os_save_v3')throw new DOMException('Test quota','QuotaExceededError');return original.call(this,key,value);};});
 const beforeFailure=await m.evaluate(()=>localStorage.getItem('canine_os_save_v3'));await m.getByRole('button',{name:'Pet Expo',exact:true}).click();await m.getByText(/Could not save this action/).waitFor();
 assert.equal(await m.evaluate(()=>localStorage.getItem('canine_os_save_v3')),beforeFailure);
 await m.screenshot({path:out+'/failed-save.png'});
 await browser.close();console.log('PASS stale tick, simultaneous same/different dogs, real/rehearsal plus care, record plus care, legacy migration/old-writer isolation, atomic failed-save honesty.');
})().catch(error=>{console.error(error);process.exit(1);});
