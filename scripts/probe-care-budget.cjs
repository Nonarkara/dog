const { chromium } = require('playwright');

/* The care console has a 102px budget. The long-call state is the one that
   goes over it — so measure every state, and read what is actually taller
   than the rest. */
const BASE = process.env.DOG_URL || 'http://localhost:3199';

const SET = (kind) => {
  const key = 'canine_os_save_v3';
  const states = JSON.parse(localStorage.getItem(key)).pets;
  const s = states['paolo-pug'];
  s.updatedAt = Date.now();
  s.needs = { hunger: 69, energy: 73, hygiene: 84 };
  s.trust = 80;
  s.arousal = 0;
  s.sick = kind === 'sick';
  s.poopCount = 0;
  s.life = { bladder: 0, boredom: kind === 'long-call' ? 85 : 0, digestionMinutes: 0, lowFullnessMinutes: 0, peeCount: 0 };
  s.sleep = { asleep: kind === 'sleeping', fellAsleepAt: kind === 'sleeping' ? Date.now() : null, wokenAt: null, wakeCount: 0, restlessness: 0 };
  s.call = kind === 'long-call' ? { reason: 'bored', since: Date.now() } : undefined;
  localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), pets: states }));
  const dogs = JSON.parse(localStorage.getItem(key)).dogs;
  dogs.find((d) => d.id === 'paolo-pug').name = kind === 'long-call' ? 'Paolo Mandes de Rocha' : 'Paolo';
  localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)), dogs }));
};

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      await p.goto(`${BASE}/?mode=play`);
      await p.waitForSelector('.region-stage canvas');
      await p.waitForTimeout(800);
      for (let i = 0; i < 5; i++) {
        if (await p.locator('#dog-switcher').count()) break;
        await p.evaluate(() =>
          document.querySelector('[aria-controls="dog-switcher"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
        );
        await p.waitForTimeout(250);
      }
      await p.getByRole('option').filter({ hasText: /^Paolo/ }).click();
      await p.waitForFunction(() => document.querySelector('canvas')?.dataset.dog === 'paolo-pug');
      for (const kind of ['flat', 'sick', 'long-call', 'sleeping']) {
        await p.evaluate(SET, kind);
        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForFunction(() => +document.querySelector('canvas')?.dataset.frames > 5);
        await p.evaluate(() => document.fonts.ready);
        await p.waitForTimeout(150);
        const m = await p.evaluate(() => {
          const care = document.querySelector('.region-care:not(.care-detail-view)');
          const body = care.querySelector('.panel-body');
          const now = care.querySelector('.care-now');
          const nowRows = now ? [...now.children].map((el)=>({cls:el.className.toString().slice(0,26),h:+el.getBoundingClientRect().height.toFixed(3),txt:(el.textContent||'').trim().slice(0,60),lh:getComputedStyle(el).lineHeight})) : [];
          const step = care.querySelector('.care-step');
          const stepP = step?.querySelector('p');
          const rows = [...body.children].map((el) => ({
            cls: el.className.toString().slice(0, 40),
            h: +el.getBoundingClientRect().height.toFixed(3),
            txt: (el.textContent || '').trim().slice(0, 40),
          }));
          return {
            panelH: +care.getBoundingClientRect().height.toFixed(4),
            bodyH: body.clientHeight,
            scrollH: body.scrollHeight,
            nowRows,
            stepTextH: stepP ? +stepP.getBoundingClientRect().height.toFixed(3) : null,
            rows,
          };
        });
        console.log(`${w}x${h} ${kind.padEnd(10)} panel=${m.panelH} body=${m.bodyH}/${m.scrollH}`);
        for (const r of m.nowRows) console.log(`      now ${String(r.h).padStart(8)} lh=${r.lh.padEnd(8)} ${r.cls.padEnd(26)} ${r.txt}`);
        console.log(`      stepText=${m.stepTextH}`);
      }
      await p.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
