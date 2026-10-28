#!/usr/bin/env python3
"""Screenshot the built site at the law's viewports.
   python3 scripts/shots.py <label> [url]

   Uses a direct CDP capture: the app runs a continuous WebGL requestAnimationFrame
   loop, and Playwright's screenshot() waits for a stable frame that never comes.
   CDP captures whatever is on screen right now, which is what we want to audit.
"""
import base64, json, sys, os
from playwright.sync_api import sync_playwright

label = sys.argv[1] if len(sys.argv) > 1 else "current"
url = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:4173/"
out = os.path.join(".audit", label)
os.makedirs(out, exist_ok=True)

VIEWPORTS = [(390, 844), (1024, 768), (1440, 900)]

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


def cdp_shot(page, path, full_page=False):
    """Capture via CDP directly — no stability wait."""
    cdp = page.context.new_cdp_session(page)
    params = {"format": "png", "captureBeyondViewport": bool(full_page)}
    if full_page:
        params["clip"] = {
            "x": 0,
            "y": 0,
            "width": page.viewport_size["width"],
            "height": page.evaluate("() => document.documentElement.scrollHeight"),
            "scale": 1,
        }
    res = cdp.send("Page.captureScreenshot", params)
    with open(path, "wb") as f:
        f.write(base64.b64decode(res["data"]))
    cdp.detach()


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

        facts = page.evaluate(PROBE)
        print(f"\n=== {w}x{h} ===")
        print(json.dumps(facts, indent=2))

        cdp_shot(page, os.path.join(out, f"{w}.png"), full_page=True)
        cdp_shot(page, os.path.join(out, f"{w}-fold.png"), full_page=False)
        page.close()
    browser.close()
print(f"\nwrote {out}/")
