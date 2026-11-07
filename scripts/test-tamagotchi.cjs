const {openPlay}=require('./fixtures/open-play.cjs');
/* Rendered regression checks. Run with Playwright installed or NODE_PATH set. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const url = process.env.DOG_URL || 'http://127.0.0.1:3100';
const out = process.env.DOG_EVIDENCE || '/tmp/dog-tamagotchi-evidence';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: process.env.DOG_NATIVE_GL ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.clock.setFixedTime(new Date(2026,9,30,12));
  page.setDefaultTimeout(60000);
  page.on('pageerror', e => { errors.push(e.message); console.error('Browser error:',e.message); });
  console.log('Opening',url);
  await openPlay(page,url);
  console.log('DOM loaded');
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles).catch(async e => { console.error(await page.evaluate(() => ({visibility:document.visibilityState,text:document.body.innerText.slice(0,800),canvas:[...document.querySelectorAll('canvas')].map(c=>c.dataset)}))); throw e; });
  console.log('Avatar ready');
  const choose = async name => {
    const opt=page.getByRole('option').filter({ hasText: new RegExp('^' + name) });
    // dispatchEvent: swiftshader frames are too slow for Playwright's 'stable' wait on this moving control.
    // Open, and re-open if a re-render swallowed the click, before choosing.
    for(let i=0;i<3&&!(await opt.isVisible());i++){await page.locator('[aria-controls="dog-switcher"]').dispatchEvent('click');await opt.waitFor({timeout:1500}).catch(()=>{});}
    await opt.dispatchEvent('click');
    const id=({'Expo':'expo-2021','Mali':'mali-2022','Oreo':'oreo-frenchie','Paolo':'paolo-pug','Hachiku':'shiba-chai'})[name];
    await page.waitForFunction(id=>{const c=document.querySelector('canvas');return c?.dataset.dog===id&&+c.dataset.frames>5&&document.querySelector('[aria-controls=dog-switcher]')?.getAttribute('aria-expanded')==='false';},id);
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
      // Ordinary laptop windows must use the desktop column; this is the product contract.
    await page.waitForFunction(() => document.querySelector('.cockpit-workspace')?.classList.contains('cockpit-workspace--wide') === (innerWidth >= 1024 && innerHeight >= 600));
    // The app publishes the decision it made; the stylesheet hangs off the
    // class, so the two must agree.
    assert.equal(await page.evaluate(() => document.querySelector('.cockpit')?.dataset.wide === 'true' ? document.querySelector('.cockpit-workspace')?.classList.contains('cockpit-workspace--wide') : !document.querySelector('.cockpit-workspace')?.classList.contains('cockpit-workspace--wide')), true, 'The published layout decision and the class the CSS hangs off must agree');
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
  const trustBeforeGame = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['shiba-chai'].trust);
  // A dog who has never practised fetch does not play catch (he bows and asks
  // to be taught). Give every dog the lesson, as a player who had taught it.
  await page.evaluate(()=>{const save=JSON.parse(localStorage.getItem('canine_os_save_v3'));for(const pet of Object.values(save.pets))pet.lessons={...pet.lessons,fetch:{streak:0,misses:0,sessionTrials:0,...(pet.lessons&&pet.lessons.fetch),stage:1,skill:.6}};localStorage.setItem('canine_os_save_v3',JSON.stringify(save));});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles);
  await page.getByRole('group',{name:'Care controls'}).getByRole('button', {name:/^Play/}).dispatchEvent('click');
  const readRound=async round=>await(await page.waitForFunction(r=>{
      const hud=document.querySelector('.catch-hud'),text=hud?.textContent??'';
      const turn=text.match(/Round\s+(\d+)\/5/),score=text.match(/Score\s+(\d+)/);
      const target=text.match(/ball\s+(◀\s+left|right\s+▶)/i);
      if(!hud||!turn||+turn[1]!==r||!score||!target||[...hud.querySelectorAll('button')].some(b=>b.disabled))return false;
      return{side:/left/i.test(target[1])?'left':'right',score:+score[1]};
    },round)).jsonValue();
  const catchRound=async round=>{
    const status=await readRound(round);
    assert.equal(status.score,round-1,`Every correct choice must score: round${round}`);
    await page.getByRole('button',{name:status.side==='left'?'◀ Left':'Right ▶',exact:true}).dispatchEvent('click');
    await page.waitForFunction(expected=>{
      const h=document.querySelector('.catch-hud');
      return h&&new RegExp(`Score\\s+${expected}(?![0-9])`).test(h.textContent)&&h.textContent.includes('Caught!');
    },round);
  };
  for(let round=1;round<=5;round++)await catchRound(round);
  await page.locator('.catch-hud').waitFor({state:'hidden'});
  await page.waitForFunction(before=>JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['shiba-chai'].trust>=Math.min(100,before+6.9),trustBeforeGame);
  const trustAfterGame = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['shiba-chai'].trust);
  assert(trustAfterGame >= Math.min(100, trustBeforeGame + 6.9), 'Play +2 and catch victory +5 reach persisted state');
  const rewards=()=>page.evaluate(()=>Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem('canine_os_save_v3')).pets).map(([id,p])=>[id,{trust:p.trust,weight:p.weightKg,coins:p.game?.coins??null,plays:p.careLog?.play??0}])));
  const play=page.getByRole('group',{name:'Care controls'}).getByRole('button',{name:/^Play/});
  // Cancel while the fifth catch's reward is pending, not merely after a
  // harmless first-round callback. Opening Play is included in the baseline.
  await play.dispatchEvent('click');for(let r=1;r<5;r++)await catchRound(r);
  const beforeClose=await rewards();await catchRound(5);
  await page.getByTitle('Close mini-game').dispatchEvent('click');await page.waitForTimeout(1100);
  assert.equal(await page.locator('.catch-hud').count(),0);assert.deepEqual(await rewards(),beforeClose,'Closing cannot grant a delayed victory');
  // Switch identity during the final pending callback as an actual player can.
  await play.dispatchEvent('click');for(let r=1;r<5;r++)await catchRound(r);
  const beforeSwitch=await rewards();await catchRound(5);await choose('Expo');await page.waitForTimeout(1100);
  assert.equal(await page.locator('.catch-hud').count(),0);assert.deepEqual(await rewards(),beforeSwitch,'Switching cannot reward either dog from a cancelled game');
  // Feeding one dog remains isolated from the others.
  await page.evaluate(()=>{const states=JSON.parse(localStorage.getItem('canine_os_save_v3')).pets;states['expo-2021'].needs.hunger=40;localStorage.setItem('canine_os_save_v3',JSON.stringify({...JSON.parse(localStorage.getItem('canine_os_save_v3')),pets:states}));});
  await choose('Expo');
  await page.getByRole('button',{name:/^Feed/}).click();
  await page.waitForTimeout(2200);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['expo-2021']);
  await choose('Mali');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_save_v3')).pets);
  assert.equal(stored['expo-2021'].needs.hunger,before.needs.hunger);
  assert.notEqual(stored['mali-2022'].needs.hunger,before.needs.hunger);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles);
  const dogs = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs);
  assert.equal(dogs.find(d=>d.id==='mali-2022').breed,'Thai Bangkaew Dog');
  assert.equal(dogs.find(d=>d.id==='expo-2021').avatarConfig.pattern,'bangkaew');
  assert.equal(dogs.find(d=>d.id==='oreo-frenchie').avatarConfig.pattern,'spotted');
  assert.equal(dogs.find(d=>d.id==='paolo-pug').avatarConfig.baseColor,'#d8c5a3');
  // An older starter Paolo gains his photo-matched palette without losing his history.
  await page.evaluate(() => {
    const dogs=JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs;
    const p=dogs.find(d=>d.id==='paolo-pug');
    Object.assign(p.avatarConfig,{baseColor:'#c29b68',secondaryColor:'#e7d4ad',maskColor:'#302823'});
    p.metaverseBio='Preserved owner note';
    p.distinctiveMarks=['Owner recorded Paolo’s markings'];
    localStorage.setItem('canine_os_save_v3',JSON.stringify({...JSON.parse(localStorage.getItem('canine_os_save_v3')),dogs:dogs}));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles);
  const paolo = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs.find(d=>d.id==='paolo-pug'));
  assert.equal(paolo.avatarConfig.baseColor,'#d8c5a3');
  assert.equal(paolo.metaverseBio,'Preserved owner note');
  assert.deepEqual(paolo.distinctiveMarks,['Owner recorded Paolo’s markings']);
  assert.equal(dogs.find(d=>d.id==='shiba-chai').name,'Hachiku');
  assert.equal(dogs.find(d=>d.id==='shiba-chai').breed,'Akita Inu');
  // Simulate the previous Shiba starter without touching its state ID.
  const savedTrust = await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['shiba-chai'].trust);
  await page.evaluate(() => {
    const dogs=JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs;
    const d=dogs.find(d=>d.id==='shiba-chai'); d.name='Chai'; d.callName='Chai'; d.breed='Shiba Inu';
    d.distinctiveMarks=['Owner’s Hachiku note'];
    Object.assign(d.avatarConfig,{baseColor:'#bb713d',secondaryColor:'#fff1d9',maskColor:'#493023'});
    localStorage.setItem('canine_os_save_v3',JSON.stringify({...JSON.parse(localStorage.getItem('canine_os_save_v3')),dogs:dogs}));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.triangles);
  const hachiku=await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_save_v3')).dogs.find(d=>d.id==='shiba-chai'));
  assert.equal(hachiku.name,'Hachiku'); assert.equal(hachiku.callName,'Hachiku');
  assert.equal(hachiku.breed,'Akita Inu'); assert.equal(hachiku.avatarConfig.baseColor,'#e2d6bb');
  assert.deepEqual(hachiku.distinctiveMarks,['Owner’s Hachiku note']);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('canine_os_save_v3')).pets['shiba-chai'].trust),savedTrust);
  assert.equal(dogs.length,5); // A fresh browser starts with the five household dogs; there are no older companions to preserve.
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${out}/measurements.json`,JSON.stringify(metrics,null,2));
  console.log('PASS: four viewports, five avatars, deterministic catch, close cleanup, dog isolation, coat persistence; zero runtime errors.');
  console.log(JSON.stringify(metrics));
  } finally {await browser.close();}
})().catch(e=>{console.error(e); process.exit(1)});
