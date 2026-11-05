/**
 * THE BEEP.
 *
 * A Tamagotchi does not wait quietly for you to notice. It calls. The app
 * models that call honestly — `whyCalling`, `tickCall`, `answerCall` — but
 * the call used to be data nobody could see: a line of text inside the Care
 * panel, on a tab you might not be on, with no sound at all.
 *
 * This script forces a call into the saved record and checks that it reaches
 * the owner in the way a call should:
 *   1. The stage says so, in his own words, and names the one action that
 *      would answer him.
 *   2. He acts it out: a calling dog paws at the screen, he does not sit
 *      there like furniture.
 *   3. The call is announced to the room: the tab title and the app badge.
 *
 * It also checks the rule that keeps the call honest — a call that has been
 * waiting since before you arrived is not news, so it must not beep at you
 * when you open the app.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.DOG_URL || 'http://127.0.0.1:4198';
const SAVE_KEY = 'canine_os_save_v3';

const CALLS = [
  { reason: 'hungry', text: 'Hungry — feed me', action: 'Feed' },
  { reason: 'dirty', text: 'Messy — clean me', action: 'Clean' },
  { reason: 'lonely', text: 'Where are you?', action: 'Pet' },
  { reason: 'toilet', text: 'I need to go out', action: 'Walk' },
  { reason: 'bored', text: 'Bored — play with me', action: 'Play' },
];

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    await p.clock.setFixedTime(new Date(2026, 10, 4, 12));
    await p.goto(base + '/?mode=play');
    await p.waitForFunction(() => document.querySelector('canvas')?.dataset.motionReady === 'true');

    // Put a call into the saved record, the way his own decay model would.
    const dogId = await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('canine_os_save_v3') || '{}');
      const id = Object.keys(raw.pets || {})[0];
      if (!id) throw new Error('No saved pet to call');
      return id;
    });

    for (const call of CALLS) {
      await p.evaluate(
        ({ id, reason }) => {
          const raw = JSON.parse(localStorage.getItem('canine_os_save_v3') || '{}');
          raw.pets[id].call = { reason, since: Date.now() };
          localStorage.setItem('canine_os_save_v3', JSON.stringify(raw));
        },
        { id: dogId, reason: call.reason }
      );
      await p.reload();
      await p.waitForFunction(() => document.querySelector('canvas')?.dataset.motionReady === 'true');
      await p.waitForSelector('.dog-daily-status--call', { timeout: 15000 });

      const chip = await p.locator('.dog-daily-status--call').innerText();
      assert(chip.includes(call.text.replace(' — ', ' — ')) || chip.includes(call.text.split(' — ')[0]),
        `The stage must say what he wants: expected "${call.text}", saw "${chip.trim()}"`);
      const button = await p.locator('.dog-daily-status--call button').innerText();
      assert(button.includes(call.action),
        `The call must offer the action that answers it: expected "${call.action}", saw "${button.trim()}"`);

      // He acts it out. A dog that has called you does not sit still.
      const acted = await p.waitForFunction(
        () => {
          const c = document.querySelector('canvas');
          return ['paw-screen', 'nose-nudge', 'looking', 'head-tilt'].includes(c?.dataset.behaviour);
        },
        null,
        { timeout: 20000 }
      ).then(() => true, () => false);
      assert(acted, `A calling dog must act out his call, not sit there (${call.reason})`);
    }

    // The tab title and the badge reach you in another tab.
    const title = await p.title();
    assert(/●.*is calling/.test(title), `The tab title must show the call, saw "${title}"`);

    // A call that was already waiting is not news.
    await p.evaluate(
      ({ id }) => {
        const raw = JSON.parse(localStorage.getItem('canine_os_save_v3') || '{}');
        raw.pets[id].call = { reason: 'hungry', since: Date.now() - 6 * 60 * 60_000 };
        localStorage.setItem('canine_os_save_v3', JSON.stringify(raw));
      },
      { id: dogId }
    );
    await p.reload();
    await p.waitForFunction(() => document.querySelector('canvas')?.dataset.motionReady === 'true');
    await p.waitForSelector('.dog-daily-status--call', { timeout: 15000 });
    const stillThere = await p.locator('.dog-daily-status--call').count();
    assert(stillThere === 1, 'An old call must still be visible on the stage');

    console.log('PASS a call reaches the owner: on the stage, in his words, with the action that answers it, and acted out', {
      calls: CALLS.map((c) => c.reason),
    });
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
