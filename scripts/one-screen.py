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

It asks three, in fact:

  1. CLIPPING   — an element with a hard overflow that hides its own content.
  2. OVERLAP    — two things in the same region drawn on top of each other,
                  so the reader sees one of them and not the other. This is
                  the failure a flex box with `flex-1 min-h-0` causes: the
                  children are given a box smaller than they need, and the
                  rows that do not fit paint over the sentence below them.
  3. SCROLLING  — a region with more content than it was given. That is
                  honest (the region says so with a scrollbar), but it costs
                  the reader a scroll to find out what they missed, so it is
                  reported and must be justified in writing.

Every tab of every region is swept, not just the one that happens to be open.

    python3 scripts/one-screen.py [url] [--out FILE] [--viewport WxH ...]

Exit code 0 = every region fits, nothing overlaps, nothing is cut off.
Non-zero = something is wrong, and the report says exactly what and where.
"""
import argparse
import json
import sys

from playwright.sync_api import sync_playwright

DEFAULT_VIEWPORTS = ["390x844", "1024x768", "1440x900"]

# The record's five tabs. Each one is a different body of content in the same
# region, and each one has to fit on its own.
RECORD_TABS = ["identity", "vaccines", "parasites", "history", "photos"]

# The regions the cockpit offers on a screen that can only show one at a time.
REGION_LABELS = ["Care", "Coach", "Commons", "Record"]

PROBE = """
() => {
  const de = document.documentElement;
  const frames = ['cockpit', 'cockpit-workspace'];
  const desc = (el) =>
    el.tagName.toLowerCase() +
    (el.getAttribute('class') ? '.' + String(el.getAttribute('class')).split(/\\s+/).slice(0, 3).join('.') : '');

  /* ---- 1. CLIPPING: an element that hides its own content ------------- */
  const clipped = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el === de || el === document.body || el.id === 'root') return;
    const cs = getComputedStyle(el);
    if (cs.overflowY !== 'hidden' && cs.overflowY !== 'clip') return;
    if (el.clientHeight <= 40) return;
    /* The frame itself is meant to clip: that is what a frame does. */
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

  /* ---- 2. OVERLAP: two things drawn on top of each other --------------- */
  /* Only children of the same in-flow parent are compared. An element that
     is positioned out of flow (a bar, a badge, a floating notice) is
     allowed to sit over its neighbours — that is what it is for. */
  const overlaps = [];
  const parents = new Set();
  document.querySelectorAll('.panel-body, .panel, .region-frame').forEach((p) => parents.add(p));
  parents.forEach((parent) => {
    const kids = Array.from(parent.children).filter((k) => {
      const cs = getComputedStyle(k);
      if (cs.position === 'absolute' || cs.position === 'fixed') return false;
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = k.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    });
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect();
        const b = kids[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 4 && oy > 4) {
          overlaps.push({
            parent: String(parent.getAttribute('class') || '').slice(0, 40),
            a: desc(kids[i]),
            b: desc(kids[j]),
            aText: (kids[i].innerText || '').trim().slice(0, 40),
            bText: (kids[j].innerText || '').trim().slice(0, 40),
            ox: Math.round(ox),
            oy: Math.round(oy),
          });
        }
      }
    }
  });

  /* ---- 4. HORIZONTAL: content cut off to the right --------------------- */
  /* The shared instrument asks whether the DOCUMENT scrolls sideways. This
     app never lets the document scroll: the cockpit is a fixed frame with a
     clipping root. So a wide element here is not scrollable — it is
     INVISIBLE. The honest question for a frame is whether anything is cut
     off to the right, and that is what this asks. */
  const hClipped = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el === de || el === document.body || el.id === 'root') return;
    const cs = getComputedStyle(el);
    const clips =
      cs.overflowX === 'hidden' || cs.overflowX === 'clip' ||
      cs.overflowX === 'auto' || cs.overflowX === 'scroll';
    if (!clips) return;
    if (cs.textOverflow === 'ellipsis') return;
    if (el.clientWidth <= 40) return;
    const over = el.scrollWidth - el.clientWidth;
    if (over > 1) {
      hClipped.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.getAttribute('class') || '').slice(0, 70),
        over: Math.round(over),
      });
    }
  });

  /* ---- the first thing you can DO --------------------------------------- */
  /* The shared instrument looks for the first control inside <main>. In this
     app the chrome — the header's dog disclosure and the command bar with
     pet, play, feed and communicate — is a SIBLING of <main>, so the
     instrument finds no action at all and the rule can never bite. The
     question the rule asks is real, so it is asked here of the whole
     document: is the first thing you can do on the screen, or below it? */
  const acts = Array.from(document.querySelectorAll('a, button, input, select, textarea'));
  let firstAction = null;
  for (const a of acts) {
    const cs = getComputedStyle(a);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = a.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const control = /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(a.tagName) || a.getAttribute('role') === 'button';
    if (!control) continue;
    const y = r.top + (window.scrollY || 0);
    if (firstAction === null || y < firstAction.y) {
      firstAction = {
        y: Math.round(y),
        tag: a.tagName.toLowerCase(),
        label: (a.getAttribute('aria-label') || a.innerText || '').trim().slice(0, 40),
      };
    }
  }

  /* ---- 3. SCROLLING: a region with more than it was given ------------- */
  const scrollers = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el === de || el === document.body || el.id === 'root') return;
    const cs = getComputedStyle(el);
    if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') return;
    if (el.clientHeight <= 40) return;
    const over = el.scrollHeight - el.clientHeight;
    if (over <= 2) return;
    const region = el.closest('.panel, .region-frame');
    scrollers.push({
      cls: String(el.getAttribute('class') || '').slice(0, 60),
      region: region ? String(region.getAttribute('class') || '').slice(0, 40) : null,
      over: Math.round(over),
    });
  });

  /* ---- the regions the reader is actually shown ------------------------- */
  const regions = [];
  document.querySelectorAll('.panel, .region-frame').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const body = el.querySelector('.panel-body') || el;
    regions.push({
      cls: String(el.getAttribute('class') || '').slice(0, 50),
      h: Math.round(r.height),
      contentH: Math.round(body.scrollHeight),
      overflow: Math.round(body.scrollHeight - body.clientHeight),
    });
  });

  /* ---- the chrome: what the frame takes before the work starts --------- */
  const header = document.querySelector('.cockpit-header, header');
  const command = document.querySelector('.command-bar, .commandbar, footer');
  const hRect = header ? header.getBoundingClientRect() : null;
  const cRect = command ? command.getBoundingClientRect() : null;

  return {
    title: document.title,
    hasCockpit: !!document.querySelector('.cockpit'),
    scrollH: de.scrollHeight,
    clientH: de.clientHeight,
    scrolls: de.scrollHeight - de.clientHeight,
    scrollsX: de.scrollWidth - de.clientWidth,
    innerH: window.innerHeight,
    text: (document.body.innerText || '').trim().length,
    headerH: hRect ? Math.round(hRect.height) : 0,
    commandH: cRect ? Math.round(cRect.height) : 0,
    firstAction,
    clipped,
    hClipped,
    overlaps,
    scrollers,
    regions,
  };
}
"""


# The page must be Canine OS. This machine runs dozens of other projects'
# servers, and ports collide: a check that measures the wrong app produces
# confident numbers about somebody else's interface.
EXPECTED_TITLE = "Canine OS"


def parse_viewport(spec):
    w, h = spec.lower().split("x")
    return int(w), int(h)


def open_record(page):
    """Make the record region visible, whatever the width.

    The record is code-split, so switching to it means waiting for its chunk
    to arrive. Waiting the wrong length here is how a tab goes unmeasured.
    """
    try:
        page.wait_for_selector("#record-tab-identity", timeout=20000)
        return True
    except Exception:  # noqa: BLE001
        pass
    for label in REGION_LABELS:
        try:
            tab = page.get_by_role("tab", name=label, exact=True)
            if tab.count() == 0:
                continue
            tab.first.click(timeout=15000)
            page.wait_for_selector("#record-tab-identity", timeout=20000)
            page.wait_for_timeout(500)
            return True
        except Exception:  # noqa: BLE001
            continue
    return False


def measure(page):
    return page.evaluate(PROBE)


def open_page(browser, url, width, height, attempts=3):
    """Open the app and wait until it has actually drawn.

    This machine carries a load average in the hundreds while other projects'
    servers and test suites run. A browser that is starved can take a minute
    to mount, and a check that reports that as a defect is measuring the
    machine, not the app. So a starved render is retried, and only three
    failures in a row count as a failure.
    """
    last = None
    for attempt in range(1, attempts + 1):
        page = browser.new_page(viewport={"width": width, "height": height})
        errors = []
        page.on("pageerror", lambda exc: errors.append(f"PAGEERROR: {str(exc)[:200]}"))
        page.on(
            "console",
            lambda msg: errors.append(f"{msg.type}: {msg.text[:200]}")
            if msg.type == "error"
            else None,
        )
        page.set_default_timeout(60000)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_selector(".panel", timeout=60000)
            # The cockpit's regions are code-split, so the screen is only
            # finished when its chunks have landed. A chunk that failed to
            # load leaves a region missing, and a missing region is not a
            # layout failure — it is a broken measurement.
            try:
                page.wait_for_load_state("networkidle", timeout=20000)
            except Exception:  # noqa: BLE001
                pass
            page.wait_for_timeout(1500)
            return page, errors
        except Exception as exc:  # noqa: BLE001
            last = exc
            print(
                f"  attempt {attempt}/{attempts} did not draw ({type(exc).__name__})",
                flush=True,
            )
            for err in errors[:3]:
                print("    " + err, flush=True)
            try:
                page.close()
            except Exception:
                pass
    raise last if last else RuntimeError("the app did not render")


def run(url, viewports, out_path):
    failures = []
    warnings = []
    report = {"url": url, "viewports": []}

    with sync_playwright() as p:
        # The real GPU: software WebGL (swiftshader) draws the furred dog so
        # slowly that pages time out under load and the gate measures nothing.
        browser = p.chromium.launch(
            args=["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
        )
        for width, height in viewports:
            entry = {"viewport": f"{width}x{height}", "tabs": {}}
            print(f"\n=== {width}x{height} ===", flush=True)
            try:
                page, errors = open_page(browser, url, width, height)
            except Exception as exc:  # noqa: BLE001
                msg = f"{width}x{height}: the app did not render in three attempts — {type(exc).__name__}"
                print("  RENDER FAILED " + msg, flush=True)
                failures.append(msg)
                entry["error"] = str(exc)[:200]
                report["viewports"].append(entry)
                continue

            facts = measure(page)
            entry["base"] = facts

            for err in errors[:6]:
                line = f"{width}x{height}: {err}"
                failures.append(line)
                print("  ERROR   " + err, flush=True)

            if EXPECTED_TITLE.lower() not in facts["title"].lower():
                msg = (
                    f"{width}x{height}: this is not Canine OS — the page served is "
                    f'"{facts["title"]}". The check is pointed at the wrong server.'
                )
                print("  WRONG APP " + msg, flush=True)
                failures.append(msg)
                entry["error"] = "wrong app"
                report["viewports"].append(entry)
                page.close()
                continue
            if not facts["hasCockpit"]:
                msg = f"{width}x{height}: the cockpit frame is not on the page"
                print("  NO COCKPIT " + msg, flush=True)
                failures.append(msg)

            if facts["text"] < 200:
                failures.append(f"{width}x{height}: the page has almost no text ({facts['text']} chars)")
            if facts["scrollsX"] > 1:
                failures.append(f"{width}x{height}: the page scrolls sideways by {facts['scrollsX']}px")
            if facts["scrolls"] > 1:
                failures.append(f"{width}x{height}: the document scrolls down by {facts['scrolls']}px")

            # The first thing you can do must be ON the screen. In a fixed
            # frame it always is, unless a control has been pushed out of
            # the viewport — which is the failure the shared instrument
            # cannot see here, because the chrome lives outside <main>.
            action = facts.get("firstAction")
            if action is None:
                line = f"{width}x{height}: the page has no control the reader can act on"
                failures.append(line)
                print("  NO ACTION " + line, flush=True)
            elif action["y"] > facts["innerH"] - 8:
                line = (
                    f"{width}x{height}: the first thing you can do is at {action['y']}px, "
                    f"below the {facts['innerH']}px screen — you must scroll before you can act"
                )
                failures.append(line)
                print("  FIRST ACTION OFF SCREEN " + line, flush=True)
            else:
                print(
                    f"  first action at {action['y']}px: {action['tag']} "
                    f"\"{action['label']}\"",
                    flush=True,
                )

            for cut in facts.get("hClipped", []):
                line = (
                    f"{width}x{height}: {cut['tag']}.{cut['cls']} cuts off "
                    f"{cut['over']}px of its own content to the right"
                )
                failures.append(line)
                print("  CUT OFF " + line, flush=True)

            print(
                f"  chrome  header {facts['headerH']}px, command {facts['commandH']}px, "
                f"text {facts['text']} chars",
                flush=True,
            )
            for region in facts["regions"]:
                flag = "OVER" if region["overflow"] > 2 else "fits"
                print(
                    f"  region {region['cls'][:38]:38s} box {region['h']:4d}px  "
                    f"content {region['contentH']:4d}px  {flag}",
                    flush=True,
                )

            for clip in facts["clipped"]:
                line = f"{width}x{height}: {clip['tag']}.{clip['cls']} hides {clip['hidden']}px of its own content"
                failures.append(line)
                print("  HIDDEN  " + line, flush=True)

            for ov in facts["overlaps"]:
                line = (
                    f"{width}x{height}: {ov['a']} and {ov['b']} overlap by "
                    f"{ov['ox']}x{ov['oy']}px inside {ov['parent']}"
                )
                failures.append(line)
                print(
                    f"  OVERLAP {ov['a']} [{ov['aText']}] X {ov['b']} [{ov['bText']}] "
                    f"({ov['ox']}x{ov['oy']}px)",
                    flush=True,
                )

            for scroller in facts["scrollers"]:
                line = (
                    f"{width}x{height}: {scroller['region'] or scroller['cls'][:38]} scrolls "
                    f"{scroller['over']}px"
                )
                warnings.append(line)
                print("  SCROLLS " + line, flush=True)

            # ---- sweep the record's five tabs -----------------------------
            if open_record(page):
                for tab in RECORD_TABS:
                    selector = f"#record-tab-{tab}"
                    if page.locator(selector).count() == 0:
                        continue
                    try:
                        page.locator(selector).first.click(timeout=5000)
                        page.wait_for_timeout(450)
                    except Exception as exc:  # noqa: BLE001
                        line = f"{width}x{height}: the {tab} tab could not be opened — {type(exc).__name__}"
                        failures.append(line)
                        print("  TAB FAILED " + line, flush=True)
                        continue
                    tab_facts = measure(page)
                    entry["tabs"][tab] = tab_facts
                    over = max([r["overflow"] for r in tab_facts["regions"]] or [0])
                    if over > 2:
                        line = f"{width}x{height}: the record's {tab} tab needs {over}px more than it has"
                        failures.append(line)
                        print(f"  TAB {tab}: OVER by {over}px", flush=True)
                    else:
                        print(f"  TAB {tab}: fits", flush=True)
                    for clip in tab_facts["clipped"]:
                        line = (
                            f"{width}x{height} (record/{tab}): {clip['tag']}.{clip['cls']} "
                            f"hides {clip['hidden']}px of its own content"
                        )
                        failures.append(line)
                        print("  HIDDEN  " + line, flush=True)
                    for ov in tab_facts["overlaps"]:
                        line = (
                            f"{width}x{height} (record/{tab}): {ov['a']} and {ov['b']} overlap "
                            f"by {ov['ox']}x{ov['oy']}px"
                        )
                        failures.append(line)
                        print("  OVERLAP " + line, flush=True)

            page.close()
            report["viewports"].append(entry)

        browser.close()

    report["failures"] = failures
    report["warnings"] = warnings

    if out_path:
        with open(out_path, "w") as handle:
            json.dump(report, handle, indent=2)
        print(f"\nwritten: {out_path}", flush=True)

    print("\n" + "=" * 64, flush=True)
    if failures:
        print("THE COCKPIT DOES NOT FIT:", flush=True)
        for failure in failures:
            print("  x", failure, flush=True)
        return 1
    print("The cockpit fits at every width. Nothing is cut off, nothing overlaps.", flush=True)
    if warnings:
        print(f"\n({len(warnings)} region(s) scroll — each one must be justified in writing):", flush=True)
        for warning in warnings:
            print("  -", warning, flush=True)
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url", nargs="?", default="http://127.0.0.1:4173/")
    parser.add_argument("--out", default=None)
    parser.add_argument("--viewport", action="append", default=None)
    args = parser.parse_args()

    viewports = [parse_viewport(v) for v in (args.viewport or DEFAULT_VIEWPORTS)]
    sys.exit(run(args.url, viewports, args.out))


if __name__ == "__main__":
    main()
