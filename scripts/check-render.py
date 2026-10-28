#!/usr/bin/env python3
"""Check a URL for the thing that matters: does the interface actually render?

Prints the console errors, the count of headings, and the visible text length.
A blank page reports zero of all three — and that is the failure the spatial
gate cannot see, because an empty document has no spatial problems.
"""
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173/"

with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="chrome",
        args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
    )
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))
    try:
        page.goto(URL, wait_until="load", timeout=30000)
    except Exception as exc:  # noqa: BLE001
        print("NAVIGATION FAILED:", exc)
    page.wait_for_timeout(3000)
    state = page.evaluate(
        """() => ({
            rootChildren: (document.getElementById('root')||{}).childElementCount ?? -1,
            h1: document.querySelectorAll('h1').length,
            h1Text: (document.querySelector('h1')||{}).innerText || '',
            textLen: (document.body.innerText||'').trim().length,
            title: document.title,
            scrollW: document.documentElement.scrollWidth,
            clientW: document.documentElement.clientWidth,
        })"""
    )
    print("STATE:", state)
    print("CONSOLE:")
    for e in errors[:25]:
        print("  ", e[:400])
    if not errors:
        print("   (none)")
    browser.close()
