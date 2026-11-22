// Keep every Coach mode and the help control usable in narrow columns.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.DOG_URL || 'http://127.0.0.1:4190';
const evidence = process.env.DOG_EVIDENCE || '/tmp/dog-coach-header';
fs.mkdirSync(evidence, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = [];
  try {
    for (const [width, height] of [[390, 844], [1024, 768], [1297, 900], [1298, 900], [1299, 900], [1440, 900]]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date(2026, 10, 22, 12));
      await page.goto(new URL('/?mode=play', base).href);
      if (width < 1024) await page.getByRole('tab', { name: 'Coach', exact: true }).click();
      const head = page.locator('.coach-head');
      await head.getByRole('button', { name: 'REAL LOG', exact: true }).click();
      const measure = () => head.evaluate(element => {
        const box = element.getBoundingClientRect();
        const buttons = [...element.querySelectorAll('button')].map(button => {
          const rect = button.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return { name: button.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, reachable: !!hit && button.contains(hit) };
        });
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: element.clientWidth, scroll: element.scrollWidth, buttons };
      });
      for (const enlarged of [false, true]) {
        if (enlarged) await page.addStyleTag({ content: '.coach-head button,.coach-head .data,.coach-head h2,.coach-head .label{font-size:22px!important;}' });
        const value = await measure();
        assert(value.scroll <= value.width + 1, JSON.stringify(value));
        assert.equal(value.buttons.length, 5, 'Help and all four mode buttons remain');
        for (const button of value.buttons) {
          assert(button.left >= value.left && button.right <= value.right, JSON.stringify(button));
          assert(button.top >= value.top && button.bottom <= value.bottom, JSON.stringify(button));
          assert(button.reachable, `${button.name} is covered`);
        }
        assert(value.bottom - value.top <= (enlarged ? 110 : 65), 'Header fits its controls without a stretched band');
        await page.screenshot({ path: `${evidence}/${width}-${enlarged ? 'large' : 'normal'}.png` });
        report.push({ width, enlarged, height: value.bottom - value.top });
      }
      await head.getByRole('button', { name: 'How training works' }).click();
      assert(await page.getByRole('tooltip').isVisible(), 'Training help opens');
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, []);
      if (width === 1024) {
        // Restore the original nowrap header, including its full title. The same
        // geometry check must catch the defect, not just bless our replacement.
        await page.addStyleTag({ content: '.coach-head,.coach-modes{flex-wrap:nowrap!important}.coach-modes{flex-shrink:0!important}.coach-head h2,.coach-head .label{display:block!important}' });
        const old = await measure();
        assert(old.scroll > old.width + 1, 'The original header must fail the width budget');
      }
      await page.close();
    }
    console.log('PASS Coach modes, touch targets, help and enlarged text', JSON.stringify(report));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
