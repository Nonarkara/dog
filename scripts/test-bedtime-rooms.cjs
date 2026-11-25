const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const url = process.env.DOG_URL || 'http://127.0.0.1:4190/?mode=play';
const key = 'canine_os_save_v3';
const dog = 'expo-2021';

(async () => {
  const browser = await chromium.launch({ channel:process.env.DOG_BUNDLED_CHROMIUM?'chromium':'chrome' });
  try {
    const page = await browser.newPage({ viewport:{width:390,height:844},reducedMotion:'reduce' });
    await page.clock.setFixedTime(new Date(2026,10,25,12));
    const saved = () => page.evaluate(([key,id]) => JSON.parse(localStorage.getItem(key)).pets[id], [key,dog]);
    const bedtime = () => page.getByRole('button',{name:'Bedtime and wake options for Expo'}).click();
    const history = () => page.getByRole('button',{name:'History and care details'}).click();
    await page.goto(url);
    await page.waitForFunction(key => !!localStorage.getItem(key), key);
    await page.evaluate(([key,id]) => {
      const save=JSON.parse(localStorage.getItem(key));
      save.pets[id].game={...save.pets[id].game,coins:100};
      localStorage.setItem(key,JSON.stringify(save));
    }, [key,dog]);
    await page.reload();

    await bedtime();
    const controls=page.getByRole('region',{name:'Bedtime',exact:true});
    // Queue both edits while the real IndexedDB writer is busy. Each
    // control should update its own field even though both read the old form.
    await page.evaluate(async () => {
      const db=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('canine_os_progress_mutex',1);
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
      });
      const transaction=db.transaction('writer','readwrite');
      const store=transaction.objectStore('writer');
      window.releaseSleepSave=()=>{window.sleepLock=false;};
      window.sleepLock=true;
      await new Promise(resolve=>{
        const spin=()=>{const read=store.get('sleep-test');read.onsuccess=()=>{resolve();if(window.sleepLock)spin();};};
        transaction.oncomplete=()=>db.close();
        spin();
      });
    });
    try {
      await controls.getByRole('combobox',{name:'Bedtime',exact:true}).selectOption('1470');
      await controls.getByLabel('Usual wake time').fill('07:15');
    } finally {
      await page.evaluate(()=>window.releaseSleepSave());
    }
    await page.waitForFunction(([key,id])=>{
      const game=JSON.parse(localStorage.getItem(key)).pets[id].game;
      return game.bedMinute===1470&&game.wakeMinute===435;
    },[key,dog]);
    await page.reload();
    await bedtime();
    assert.equal(await controls.getByRole('combobox',{name:'Bedtime',exact:true}).inputValue(),'1470');
    assert.equal(await controls.getByLabel('Usual wake time').inputValue(),'07:15');
    await controls.getByRole('switch',{name:/Bark when Expo wakes/}).press('Space');
    await page.waitForFunction(([key,id])=>JSON.parse(localStorage.getItem(key)).pets[id].game.wakeBark,[key,dog]);
    await controls.getByRole('button',{name:'Close care extras'}).click();

    await history();
    const details=page.getByRole('dialog');
    const home=details.getByRole('combobox',{name:'Home',exact:true});
    await home.selectOption('farm');
    assert.equal((await saved()).game.coins,100);
    await details.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await home.inputValue(),'house');
    await home.selectOption('farm');
    await details.locator('[data-buy-room]').click();
    await page.waitForFunction(([key,id])=>JSON.parse(localStorage.getItem(key)).pets[id].home==='farm',[key,dog]);
    assert.equal((await saved()).game.coins,50);
    await home.selectOption('house');
    await page.waitForFunction(([key,id])=>JSON.parse(localStorage.getItem(key)).pets[id].home==='house',[key,dog]);
    await home.selectOption('farm');
    await page.waitForFunction(([key,id])=>JSON.parse(localStorage.getItem(key)).pets[id].home==='farm',[key,dog]);
    assert.equal((await saved()).game.coins,50);
    await home.selectOption('heaven');
    assert(await details.locator('[data-buy-room]').isDisabled());
    assert.equal((await saved()).home,'farm');
    await page.reload();
    await history();
    assert.equal(await home.inputValue(),'farm');
    assert.equal((await saved()).game.coins,50);
    console.log('PASS queued bedtime edits, saved preferences, room cancellation, purchase, free return and insufficient coins');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
