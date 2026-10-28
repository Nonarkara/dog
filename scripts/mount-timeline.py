#!/usr/bin/env python3
"""Measure WHEN the app's DOM appears, relative to the document's parse.

The spatial gate settles on a document that looks finished. A client-rendered
app has nothing in the document until React mounts, so the settle can close on
an empty page. This script reports the timeline: navigation start, first paint,
module execution, and the moment #root gains children.
"""
import json
import sys
import time

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/"

PROBE = """
(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const t0 = nav ? nav.startTime : 0;
  const marks = { navStart: 0, domContentLoaded: 0, load: 0, rootChildren: null, rootChars: null };
  const root = document.getElementById('root');
  const t = () => Math.round(performance.now() * 10) / 10;
  if (root && root.children.length) {
    marks.rootChildren = t();
    marks.rootChars = document.body.innerText.length;
  }
  const mo = new MutationObserver(() => {
    if (marks.rootChildren === null && root && root.children.length) {
      marks.rootChildren = t();
      marks.rootChars = document.body.innerText.length;
      mo.disconnect();
    }
  });
  if (root) mo.observe(root, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => { marks.domContentLoaded = t(); });
  window.addEventListener('load', () => { marks.load = t(); });
  window.__MARKS__ = marks;
  return true;
})()
"""

AFTER = """
(() => {
  const m = window.__MARKS__ || {};
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]);
  const res = performance.getEntriesByType('resource')
    .filter(r => r.name.endsWith('.js'))
    .map(r => [r.name.split('/').pop(), Math.round(r.startTime), Math.round(r.responseEnd)]);
  const root = document.getElementById('root');
  return JSON.stringify({
    marks: m,
    paint,
    js: res,
    domContentLoadedEventStart: nav ? Math.round(nav.domContentLoadedEventStart) : null,
    loadEventStart: nav ? Math.round(nav.loadEventStart) : null,
    responseEnd: nav ? Math.round(nav.responseEnd) : null,
    rootChildrenNow: root ? root.children.length : null,
    charsNow: document.body.innerText.length,
    h1: document.querySelectorAll('h1').length,
  });
})()
"""


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="chrome",
            args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.add_init_script(PROBE)
        page.goto(URL, wait_until="load")
        time.sleep(2.5)
        out = page.evaluate(AFTER)
        print(out)
        browser.close()


if __name__ == "__main__":
    main()
