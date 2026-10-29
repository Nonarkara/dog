/* Rendered regression checks. Run with Playwright installed or NODE_PATH set. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const url = process.env.DOG_URL || 'http://127.0.0.1:3100';
const out = process.env.DOG_EVIDENCE || '/tmp/dog-tamagotchi-evidence';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: process.env.DOG_NATIVE_GL ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => { errors.push(e.message); console.error('Browser error:',e.message); });
  console.log('Opening',url);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.bringToFront();
  console.log('DOM loaded');
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles).catch(async e => { console.error(await page.evaluate(() => ({visibility:document.visibilityState,text:document.body.innerText.slice(0,800),canvas:[...document.querySelectorAll('canvas')].map(c=>c.dataset)}))); throw e; });
  console.log('Avatar ready');
  const choose = async name => {
    await page.locator('[aria-controls="dog-switcher"]').click();
    await page.getByRole('option').filter({ hasText: new RegExp('^' + name) }).click();
    await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles);
  };
  // Continuous WebGL motion can prevent Playwright's screenshot stability wait.
  // Capture the actual frame through CDP, as scripts/shots.py already does.
  const cdp = await page.context().newCDPSession(page);
  const capture = async path => {
    const {data} = await cdp.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,...page.viewportSize(),scale:1},captureBeyondViewport:true});
    const bytes=Buffer.from(data,'base64');
    if(path) fs.writeFileSync(path,bytes);
    return bytes;
  };
  const metrics = [];
  for (const [w, h] of [[390,844], [1024,768], [1440,900], [1280,720]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForFunction(() => document.querySelector('.cockpit-workspace')?.classList.contains('cockpit-workspace--wide') === (innerWidth >= 1024 && innerHeight >= 820));
    await page.waitForTimeout(300);
    console.log('Viewport',w);
    const geometry = await page.evaluate(() => {
      const root = document.documentElement;
      const stage = document.querySelector('.stage-frame').getBoundingClientRect();
      const footer = document.querySelector('.command-bar').getBoundingClientRect();
      const header = document.querySelector('header').getBoundingClientRect();
      const canvas = document.querySelector('canvas');
      return { w: innerWidth, h: innerHeight, pageW: root.scrollWidth, pageH: root.scrollHeight,
        chrome: header.height + footer.height, stageW: stage.width, stageH: stage.height,
        actionBottom: footer.bottom, calls: +canvas.dataset.drawCalls, triangles: +canvas.dataset.triangles };
    });
    assert.equal(geometry.pageW, w); assert.equal(geometry.pageH, h);
    assert(geometry.actionBottom <= h + 1);
    assert(geometry.chrome <= 150 && geometry.stageH >= 240, 'Care geometry budget');
    assert(geometry.triangles < 35000, `Triangle budget: ${geometry.triangles}`);
    assert(geometry.calls < 45, `Draw-call budget: ${geometry.calls}`);
    metrics.push(geometry);
    await capture(`${out}/${w}.png`);
  }
  await page.setViewportSize({width:390,height:844});
  // Restore an oversized header in an isolated browser fixture; the same geometry budget rejects it.
  await page.addStyleTag({content:'header { min-height: 500px !important; }'});
  const rejected = await page.evaluate(() => document.querySelector('header').getBoundingClientRect().height + document.querySelector('.command-bar').getBoundingClientRect().height > 150);
  assert(rejected,'Oversized-header negative control must fail the geometry budget');
  // Reload clears fixture-only styles and returns to the real layout.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles);

  const fingerprints = [];
  for (const name of ['Expo','Mali','Oreo','Paolo','Hachiku']) {
    if(name !== 'Expo') await choose(name);
    await page.waitForTimeout(250);
    const image = await capture();
    fingerprints.push(require('node:crypto').createHash('sha256').update(image).digest('hex'));
    await capture(`${out}/${name}.png`);
  }
  assert.equal(new Set(fingerprints).size,5);
  // A visible target governs the score. Five correct choices must always win.
  const trustBeforeGame = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_pet_states_v1'))['shiba-chai'].trust);
  await page.getByRole('group',{name:'Care controls'}).getByRole('button', {name:/^Play/}).click();
  for(let round=1;round<=5;round++) {
    await page.waitForFunction(r => document.querySelector('.catch-hud')?.textContent.includes(`Round ${r}/5`),round);
    const text = await page.locator('.catch-hud').innerText();
    await page.getByRole('button',{name:text.includes('BALL ◀ LEFT') ? '◀ Left' : 'Right ▶', exact:true}).click();
    await page.waitForTimeout(950);
  }
  assert.equal(await page.locator('.catch-hud').count(),0);
  const trustAfterGame = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_pet_states_v1'))['shiba-chai'].trust);
  assert(trustAfterGame >= Math.min(100, trustBeforeGame + 6.9), 'Play +2 and catch victory +5 reach persisted state');
  // New-game reset and close invalidate pending round callbacks.
  await page.getByRole('group',{name:'Care controls'}).getByRole('button',{name:/^Play/}).click();
  await page.getByRole('button',{name:'◀ Left',exact:true}).click();
  await page.getByTitle('Close mini-game').click();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('.catch-hud').count(),0);
  await page.waitForTimeout(1100);
  // Dog state never crosses identities, including during an active game.
  await choose('Expo');
  await page.getByRole('button',{name:/^Feed/}).click();
  await page.waitForTimeout(2200);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_pet_states_v1'))['expo-2021']);
  await choose('Mali');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_pet_states_v1')));
  assert.equal(stored['expo-2021'].needs.hunger,before.needs.hunger);
  assert.notEqual(stored['mali-2022'].needs.hunger,before.needs.hunger);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles);
  const dogs = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_dogs_v1')));
  assert.equal(dogs.find(d=>d.id==='mali-2022').breed,'Thai Bangkaew Dog');
  assert.equal(dogs.find(d=>d.id==='expo-2021').avatarConfig.pattern,'bangkaew');
  assert.equal(dogs.find(d=>d.id==='oreo-frenchie').avatarConfig.pattern,'spotted');
  assert.equal(dogs.find(d=>d.id==='paolo-pug').avatarConfig.baseColor,'#d8c5a3');
  // An older starter Paolo gains his photo-matched palette without losing his history.
  await page.evaluate(() => {
    const dogs=JSON.parse(localStorage.getItem('canine_os_dogs_v1'));
    const p=dogs.find(d=>d.id==='paolo-pug');
    Object.assign(p.avatarConfig,{baseColor:'#c29b68',secondaryColor:'#e7d4ad',maskColor:'#302823'});
    p.metaverseBio='Preserved owner note';
    p.distinctiveMarks=['Owner recorded Paolo’s markings'];
    localStorage.setItem('canine_os_dogs_v1',JSON.stringify(dogs));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles);
  const paolo = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_dogs_v1')).find(d=>d.id==='paolo-pug'));
  assert.equal(paolo.avatarConfig.baseColor,'#d8c5a3');
  assert.equal(paolo.metaverseBio,'Preserved owner note');
  assert.deepEqual(paolo.distinctiveMarks,['Owner recorded Paolo’s markings']);
  assert.equal(dogs.find(d=>d.id==='shiba-chai').name,'Hachiku');
  assert.equal(dogs.find(d=>d.id==='shiba-chai').breed,'Akita Inu');
  // Simulate the previous Shiba starter without touching its state ID.
  const savedTrust = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_pet_states_v1'))['shiba-chai'].trust);
  await page.evaluate(() => {
    const dogs=JSON.parse(localStorage.getItem('canine_os_dogs_v1'));
    const d=dogs.find(d=>d.id==='shiba-chai'); d.name='Chai'; d.callName='Chai'; d.breed='Shiba Inu';
    d.distinctiveMarks=['Owner’s Hachiku note'];
    Object.assign(d.avatarConfig,{baseColor:'#bb713d',secondaryColor:'#fff1d9',maskColor:'#493023'});
    localStorage.setItem('canine_os_dogs_v1',JSON.stringify(dogs));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles);
  const hachiku=await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_dogs_v1')).find(d=>d.id==='shiba-chai'));
  assert.equal(hachiku.name,'Hachiku'); assert.equal(hachiku.callName,'Hachiku');
  assert.equal(hachiku.breed,'Akita Inu'); assert.equal(hachiku.avatarConfig.baseColor,'#e2d6bb');
  assert.deepEqual(hachiku.distinctiveMarks,['Owner’s Hachiku note']);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_pet_states_v1'))['shiba-chai'].trust),savedTrust);
  assert.equal(dogs.length,7); // Five requested dogs plus two preserved companions.
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${out}/measurements.json`,JSON.stringify(metrics,null,2));
  console.log('PASS: four viewports, five avatars, deterministic catch, close cleanup, dog isolation, coat persistence; zero runtime errors.');
  console.log(JSON.stringify(metrics));
  await browser.close();
})().catch(e=>{console.error(e); process.exit(1)});
