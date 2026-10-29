#!/usr/bin/env python3
"""A raw look at the DOM: what is in the workspace, and what did the console say."""
import json
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/"
WIDTHS = [int(w) for w in (sys.argv[2].split(",") if len(sys.argv) > 2 else ["390", "1024", "1440"])]
HEIGHT = int(sys.argv[3]) if len(sys.argv) > 3 else 900

DUMP = """
() => {
  const ws = document.querySelector('.cockpit-workspace');
  const kids = ws ? Array.from(ws.children).map((k) => {
    const r = k.getBoundingClientRect();
    return {
      cls: String(k.getAttribute('class') || '').slice(0, 46),
      w: Math.round(r.width), h: Math.round(r.height),
      top: Math.round(r.top), left: Math.round(r.left),
      display: getComputedStyle(k).display,
    };
  }) : null;
  const rec = document.querySelector('.region-record');
  const tabs = document.querySelectorAll('[id^="record-tab-"]').length;
  const panels = document.querySelectorAll('.panel').length;
  return {
    kids, tabs, panels,
    recordFound: !!rec,
    recordRect: rec ? (() => { const r = rec.getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height)}; })() : null,
    workspaceCls: ws ? String(ws.getAttribute('class')) : null,
    wsRect: ws ? (() => { const r = ws.getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height)}; })() : null,
    bodyText: (document.body.innerText || '').trim().length,
    rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : -1,
  };
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="chrome",
        args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
    )
    for width in WIDTHS:
        page = browser.new_page(viewport={"width": width, "height": HEIGHT})
        msgs = []
        page.on("console", lambda m: msgs.append(f"{m.type}: {m.text[:180]}"))
        page.on("pageerror", lambda e: msgs.append(f"PAGEERROR: {str(e)[:300]}"))
        page.set_default_timeout(60000)
        print(f"\n=== {width}x{HEIGHT} ===", flush=True)
        try:
            page.goto(URL, wait_until="domcontentloaded", timeout=60000)
            print("  goto ok", flush=True)
        except Exception as exc:
            print(f"  GOTO FAILED {type(exc).__name__}: {str(exc)[:200]}", flush=True)
        for wait in (2000, 6000, 12000):
            page.wait_for_timeout(wait)
            info = page.evaluate(DUMP)
            print(f"  after ~{wait}ms cumulative: panels={info['panels']} tabs={info['tabs']} "
                  f"text={info['bodyText']} rootKids={info['rootChildren']} "
                  f"ws={info['wsRect']} wsCls={info['workspaceCls']}", flush=True)
            if info["panels"]:
                for kid in info["kids"] or []:
                    print(f"    kid {kid['cls'][:46]:46s} {kid['w']:4d}x{kid['h']:4d} "
                          f"at {kid['left']},{kid['top']} display={kid['display']}", flush=True)
                print(f"    record: found={info['recordFound']} rect={info['recordRect']}", flush=True)
                break
        for m in msgs[-12:]:
            print("  CONSOLE " + m, flush=True)
        page.close()
    browser.close()
