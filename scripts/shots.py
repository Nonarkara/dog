#!/usr/bin/env python3
"""Screenshot the built site at the law's viewports.
   python3 scripts/shots.py <label> [url]

   Uses a direct CDP capture: the app runs a continuous WebGL requestAnimationFrame
   loop, and Playwright's screenshot() waits for a stable frame that never comes.
   CDP captures whatever is on screen right now, which is what we want to audit.
"""
import json, sys, os
from playwright.sync_api import sync_playwright

label = sys.argv[1] if len(sys.argv) > 1 else "current"
url = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:4173/"
EXPECTED_TITLE = sys.argv[3] if len(sys.argv) > 3 else "Tama-Dog-Chi"
out = os.path.join(".audit", label)
os.makedirs(out, exist_ok=True)

VIEWPORTS = [(320, 568), (390, 844), (1024, 768), (1440, 900)]

PROBE = """() => {
  const de = document.documentElement;
  const rect = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
  const hdr = rect('header'), ftr = rect('footer');
  const wide = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > de.clientWidth + 1) {
      wide.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 70),
                  w: Math.round(r.width), left: Math.round(r.left) });
    }
  });
  return {
    scrollW: de.scrollWidth, clientW: de.clientWidth, docH: de.scrollHeight,
    headerH: hdr ? Math.round(hdr.height) : 0,
    footerH: ftr ? Math.round(ftr.height) : 0,
    headerBottom: hdr ? Math.round(hdr.bottom) : 0,
    viewportH: window.innerHeight,
    overflowing: wide.slice(0, 8),
  };
}"""


def shot(page, path):
    """Capture what the reader would see.

    PLAYWRIGHT'S OWN SCREENSHOT, NOT RAW CDP.

    Two different captures of the same live page disagreed, and the CDP one
    was wrong. `Page.captureScreenshot` clips against the COMPOSITOR
    SURFACE, which in this headless browser is shorter than the viewport: it
    returned a black band along the bottom of every photograph, from the
    entry screen to the park. A plain viewport screenshot of the same page
    had no band at all — the pixels there are cream.

    A band that is not in the product is the worst kind of evidence: it is
    convincing, it is specific, and it sends you to fix a defect that does
    not exist. So the capture uses the path that agrees with the DOM, and
    if it cannot, the run says so instead of writing a file.

    The old reason for CDP was that the app ran a continuous WebGL rAF loop
    and `screenshot()` waited for a stable frame that never came. The scenes
    are illustrations now, and the capture completes.
    """
    page.screenshot(path=path, timeout=30000)


with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="chrome",
        args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
    )
    for w, h in VIEWPORTS:
        page = browser.new_page(viewport={"width": w, "height": h})
        page.set_default_timeout(45000)
        page.goto(url, wait_until="load")
        page.wait_for_timeout(1500)
        page.wait_for_timeout(2500)

        # WHICH PAGE IS THIS?
        #
        # A capture of the wrong site is worse than no capture: it looks like
        # evidence. The port can already be serving something else — another
        # project's preview, a stale server — so the title is checked BEFORE
        # anything is written to disk, and the run fails loudly rather than
        # quietly producing photographs of somebody else's screen.
        title = page.title()
        if EXPECTED_TITLE and EXPECTED_TITLE not in title:
            raise SystemExit(
                f"WRONG PAGE at {url}: the title is {title!r}, expected to contain "
                f"{EXPECTED_TITLE!r}. Refusing to write evidence for another site."
            )

        facts = page.evaluate(PROBE)
        print(f"\n=== {w}x{h} === ({title})")
        print(json.dumps(facts, indent=2))

        shot(page, os.path.join(out, f"{w}.png"))
        page.close()
    browser.close()
print(f"\nwrote {out}/")
