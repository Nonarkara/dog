#!/usr/bin/env python3
"""Replicate the spatial gate's harness exactly, and report WHEN it settles.

The gate measures inside a same-origin iframe and waits for the page to stop
changing. This script runs the same wait, with the gate's own browser flags,
and prints the moment the wait closed and what the document looked like at
that moment — the two facts the gate's receipt does not carry.

    python3 scripts/settle-debug.py [url]
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/"

# The gate's settle, transcribed: three identical signatures, at least 100ms of
# real time, 60ms of quiet (no DOM mutation), and everything late arrived.
HARNESS = """
<div id="fwrap"></div>
<script>
window.__LOG__ = [];
const f = document.createElement('iframe');
f.id = 'f';
f.style.width = '1440px';
f.style.height = '900px';
f.style.border = '0';
f.src = %s + '?__spatial=1';
document.getElementById('fwrap').appendChild(f);

function signature(d) {
  const doc = d.documentElement;
  const svgs = d.getElementsByTagName('svg');
  let sw = 0;
  for (let i = 0; i < svgs.length; i++) sw += Math.round(svgs[i].getBoundingClientRect().width);
  const main = d.querySelector('main#content') || d.querySelector('main') || d.body;
  const text = main ? main.textContent.length : 0;
  return doc.scrollWidth + '|' + doc.scrollHeight + '|' +
    d.getElementsByTagName('*').length + '|' + sw + '|' + text;
}

function watch(d) {
  if (d.__spatialWatcher) return d.__spatialWatcher;
  const w = { last: Date.now(), mutations: 0 };
  try {
    const mo = new d.defaultView.MutationObserver(function () { w.last = Date.now(); w.mutations++; });
    mo.observe(d.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
  } catch (e) {}
  d.__spatialWatcher = w;
  return w;
}

function arrived(d) {
  try { const ff = d.fonts; if (ff && ff.status && ff.status !== 'loaded') return false; } catch (e) {}
  const imgs = d.getElementsByTagName('img');
  for (let i = 0; i < imgs.length; i++) if (!imgs[i].complete) return false;
  return true;
}

const T0 = Date.now();
function wait() {
  const d = f.contentDocument;
  if (!d) return setTimeout(wait, 25);
  if (d.readyState === 'loading') return setTimeout(wait, 25);
  const w = watch(d);
  let tries = 0, last = null, stable = 0;
  const start = Date.now();
  function step() {
    const elapsed = Date.now() - start;
    if (tries++ > 600 || elapsed > 5000) {
      window.__LOG__.push({ event: 'deadline', at: Date.now() - T0, elapsed });
      window.__SETTLED__ = { at: Date.now() - T0, state: snapshot(d) };
      return;
    }
    let s;
    try { s = signature(d); } catch (e) { return; }
    if (s === last) stable++; else { stable = 0; last = s; }
    const quiet = Date.now() - w.last >= 60;
    if (stable >= 3 && elapsed >= 100 && quiet && arrived(d)) {
      window.__LOG__.push({ event: 'settle-close', at: Date.now() - T0, elapsed, sig: s });
      window.__SETTLED__ = { at: Date.now() - T0, state: snapshot(d) };
      return;
    }
    setTimeout(step, 25);
  }
  setTimeout(step, 25);
}

function snapshot(d) {
  const main = d.querySelector('main#content') || d.querySelector('main') || d.body;
  const root = d.getElementById('root');
  return {
    readyState: d.readyState,
    mainChars: main ? main.textContent.length : 0,
    h1: d.querySelectorAll('h1').length,
    rootChildren: root ? root.childElementCount : -1,
    elements: d.getElementsByTagName('*').length,
    scrollH: d.documentElement.scrollHeight,
    canvas: d.querySelectorAll('canvas').length,
  };
}

f.addEventListener('load', () => { setTimeout(wait, 10); });
</script>
""" % json.dumps(URL)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="chrome",
            args=[
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-extensions",
            ],
        )
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        logs = []
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text[:200]}"))
        page.on("pageerror", lambda e: logs.append(f"[pageerror] {str(e)[:200]}"))
        # The harness must be SAME-ORIGIN with the page under test, or the
        # browser refuses to hand over the frame's document — and, worse,
        # blocks localStorage inside the app. So it is served from the same
        # static server as the build.
        harness_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist", "__settle_harness__.html")
        os.makedirs(os.path.dirname(harness_path), exist_ok=True)
        with open(harness_path, "w") as fh:
            fh.write("<!doctype html><html><head><meta charset=\"utf-8\"></head><body>" + HARNESS + "</body></html>")
        page.goto("http://127.0.0.1:4173/__settle_harness__.html", wait_until="commit")
        time.sleep(12)
        settled = page.evaluate("() => window.__SETTLED__ || null")
        log = page.evaluate("() => window.__LOG__ || []")
        try:
            live = page.evaluate(
            """() => {
                const d = document.getElementById('f').contentDocument;
                const root = d.getElementById('root');
                const main = d.querySelector('main') || d.body;
                return {
                    now: Math.round(performance.now()),
                    rootChildren: root ? root.childElementCount : -1,
                    h1: d.querySelectorAll('h1').length,
                    chars: main ? main.textContent.length : 0,
                    canvas: d.querySelectorAll('canvas').length,
                };
            }"""
            )
        except Exception as exc:
            live = {"error": str(exc)[:200]}
        print("SETTLED:", json.dumps(settled, indent=1))
        print("LOG:", json.dumps(log, indent=1))
        print("LIVE (12s later):", json.dumps(live, indent=1))
        print("CONSOLE:")
        for entry in logs[:30]:
            print("  ", entry)
        browser.close()


if __name__ == "__main__":
    main()
