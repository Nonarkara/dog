#!/usr/bin/env python3
"""THE PROJECT'S OWN CHECK: does the cockpit actually FIT?

The shared spatial instrument is byte-identical to its package, on purpose: a
number that means one thing in this project has to mean the same thing in
every other project that uses it. So the rules that belong to THIS product do
not go into it. They live here.

THE RULE: the cockpit is one screen.

A Tamagotchi had one screen. Everything the animal needed was on it. The
cockpit here is the same idea: a frame that never changes, a header band, a
workspace of regions, and a command bar docked at the bottom. Neither the
frame nor the workspace scrolls.

And that creates a risk the shared instrument cannot see. A frame that clips
its overflow turns "too much content" into "content you cannot see" — and a
region that quietly cuts off the bottom of a table, a note or a form is a
worse failure than a page that scrolls. So this check asks the question the
frame hides: does everything inside the frame FIT?

    python3 scripts/one-screen.py [url]

Exit code 0 = every region fits at every width. Non-zero = something is
being cut off, and the report says what.
"""
import json
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/"
VIEWPORTS = [(390, 844), (1024, 768), (1440, 900)]

PROBE = """
() => {
  const de = document.documentElement;
  const clipped = [];
  const frames = ['cockpit', 'cockpit-workspace'];
  document.querySelectorAll('*').forEach((el) => {
    if (el === de || el === document.body || el.id === 'root') return;
    const cs = getComputedStyle(el);
    if (cs.overflowY !== 'hidden' && cs.overflowY !== 'clip') return;
    if (el.clientHeight <= 40) return;
    // The frame itself is meant to clip: that is what a frame does.
    if (el.classList && frames.some((f) => el.classList.contains(f))) return;
    const hidden = el.scrollHeight - el.clientHeight;
    if (hidden > 2) {
      clipped.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.getAttribute('class') || '').slice(0, 70),
        hidden: Math.round(hidden),
        clientH: el.clientHeight,
        scrollH: el.scrollHeight,
      });
    }
  });

  // A region that has more content than it was given SCROLLS, and says so
  // with a scrollbar. That is honest: the reader is told there is more. A
  // region that CLIPS its content is not — the reader loses it silently.
  const scrollers = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el === de || el === document.body || el.id === 'root') return;
    const cs = getComputedStyle(el);
    if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') return;
    if (el.clientHeight <= 40) return;
    const over = el.scrollHeight - el.clientHeight;
    if (over <= 2) return;
    const region = el.closest('[class*="region-"], .panel, .region-frame');
    scrollers.push({
      cls: String(el.getAttribute('class') || '').slice(0, 60),
      region: region ? String(region.getAttribute('class') || '').slice(0, 40) : null,
      over: Math.round(over),
    });
  });

  // The regions are what the reader is actually shown. Each one must show
  // its own content without cutting it.
  const regions = [];
  document.querySelectorAll('[class*="region-"], .panel').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const body = el.querySelector('.panel__body') || el;
    regions.push({
      cls: String(el.getAttribute('class') || '').slice(0, 50),
      h: Math.round(r.height),
      contentH: Math.round(body.scrollHeight),
      overflow: Math.round(body.scrollHeight - body.clientHeight),
    });
  });

  return {
    scrollH: de.scrollHeight,
    clientH: de.clientHeight,
    scrolls: de.scrollHeight - de.clientHeight,
    clipped,
    scrollers,
    regions,
  };
}
"""


def main():
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="chrome",
            args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
        )
        for width, height in VIEWPORTS:
            page = browser.new_page(viewport={"width": width, "height": height})
            page.set_default_timeout(45000)
            page.goto(URL, wait_until="load")
            page.wait_for_timeout(2500)
            facts = page.evaluate(PROBE)
            page.close()

            print(f"\n=== {width}x{height} ===")
            print(
                f"  document scrolls down by {facts['scrolls']}px "
                f"(scrollHeight {facts['scrollH']} / clientHeight {facts['clientH']})"
            )
            if facts["scrolls"] > 1:
                failures.append(f"{width}x{height}: the document scrolls down by {facts['scrolls']}px")
            for region in facts["regions"]:
                if region["overflow"] > 2:
                    failures.append(
                        f"{width}x{height}: {region['cls']} cuts off {region['overflow']}px of its own content"
                    )
            for scroller in facts.get("scrollers", []):
                print(f"  SCROLLS {scroller['region'] or scroller['cls'][:38]:38s} {scroller['over']:4d}px")
            for clip in facts["clipped"]:
                failures.append(
                    f"{width}x{height}: {clip['tag']}.{clip['cls']} hides {clip['hidden']}px of its own content"
                )
                print(f"  HIDDEN  {clip['tag']}.{clip['cls']} — {clip['hidden']}px")
            if facts["regions"]:
                for region in facts["regions"]:
                    print(
                        f"  region {region['cls'][:38]:38s} box {region['h']:4d}px  "
                        f"content {region['contentH']:4d}px  overflow {region['overflow']:4d}px"
                    )
        browser.close()

    print("\n" + "=" * 60)
    if failures:
        print("THE COCKPIT DOES NOT FIT:")
        for failure in failures:
            print("  ✗", failure)
        raise SystemExit(1)
    print("The cockpit fits at every width. Nothing is cut off.")


if __name__ == "__main__":
    main()
