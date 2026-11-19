const { chromium } = require('playwright');

/* THE SLOP PROBE.
 *
 * MSH law 1: "A control/chip/stat is <= 2x content width and <= 1.6x content
 * height." The chip row in the coach panel broke it by five times. Rather
 * than find that one by eye, this walks every control on every surface and
 * reports the ones whose BOX is more than twice the INK inside it.
 *
 * INK = the text plus the icons inside the control, not the padding and not
 * the border. A button that says "Did it" inside a 225px cell is 5x; a
 * button that says "Did it" next to an icon is measured on both.
 *
 * A probe, not a gate: it reports, and a human decides.
 */
const BASE = process.env.DOG_URL || 'http://localhost:3199';
const WIDTHS = (process.env.PROBE_WIDTHS || '390,768,1024,1440').split(',').map(Number);
const ROUTES = (process.env.PROBE_ROUTES || '/?mode=play,/?mode=own').split(',');
const LIMIT = Number(process.env.PROBE_LIMIT || 40);

const MEASURE = () => {
  const out = [];
  const els = document.querySelectorAll('button,[role="tab"],a.btn,.chip');
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (el.closest('[hidden]')) continue;
    // Ink = every text run plus every element child (an icon is content).
    let text = 0;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const range = document.createRange();
        range.selectNodeContents(n);
        text += range.getBoundingClientRect().width;
      }
    }
    let icons = 0;
    for (const c of el.children) {
      const cr = c.getBoundingClientRect();
      if (cr.width > 0) icons += cr.width;
    }
    const ink = text + icons;
    if (ink < 4) continue; // no measurable content: not this probe's business
    const ratio = r.width / ink;
    if (ratio > 2.0) {
      out.push({
        label: (el.textContent || '').trim().slice(0, 28),
        cls: el.className.toString().slice(0, 48),
        box: +r.width.toFixed(1),
        ink: +ink.toFixed(1),
        ratio: +ratio.toFixed(2),
        h: +r.height.toFixed(1),
        y: Math.round(r.top),
      });
    }
  }
  return out;
};

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const hits = [];
  try {
    for (const w of WIDTHS) {
      for (const route of ROUTES) {
        const p = await b.newPage({ viewport: { width: w, height: 900 } });
        try {
          await p.goto(`${BASE}${route}`);
          await p.waitForSelector('.region-stage canvas', { timeout: 30000 });
          await p.waitForTimeout(900);
          const found = await p.evaluate(MEASURE);
          for (const f of found) hits.push({ w, route, panel: 'default', ...f });

          // The panels that hide behind a toggle are measured too: the
          // coach's REAL LOG, and every tab of the record.
          const realLog = p.locator('button', { hasText: 'REAL LOG' });
          if (await realLog.count()) {
            await realLog.first().click();
            await p.waitForTimeout(400);
            for (const f of await p.evaluate(MEASURE)) hits.push({ w, route, panel: 'real-log', ...f });
          }
          const tabs = p.locator('.region-record [role="tab"], .record-tab');
          const tabCount = await tabs.count();
          for (let i = 0; i < tabCount; i++) {
            try {
              await tabs.nth(i).click();
              await p.waitForTimeout(300);
              for (const f of await p.evaluate(MEASURE))
                hits.push({ w, route, panel: `record-tab-${i}`, ...f });
            } catch {
              /* a tab that refuses to open is not this probe's business */
            }
          }
        } catch (e) {
          console.error(`${w} ${route}: ${e.message}`);
        }
        await p.close();
      }
    }
  } finally {
    await b.close();
  }
  hits.sort((a, b2) => b2.ratio - a.ratio);
  console.log(`\n${hits.length} control(s) wider than 2x their content:\n`);
  for (const h of hits.slice(0, LIMIT)) {
    console.log(
      `${String(h.ratio).padStart(5)}x  ${String(h.w).padStart(4)}px  ${h.route.padEnd(11)}  ` +
        `${String(h.box).padStart(6)}px box / ${String(h.ink).padStart(5)}px ink  "${h.label}"  [${h.cls}]`,
    );
  }
  if (hits.length > LIMIT) console.log(`\n... and ${hits.length - LIMIT} more`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
