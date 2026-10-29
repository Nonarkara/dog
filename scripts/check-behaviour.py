"""Behaviour check: the loops a reader actually performs.

The domain engine is unit-tested in `src/domain/selftest.ts`. This checks the
other half — that the CONTROLS are wired to it, and that what the app says
happens is what happened. A green engine with a dead button is still broken.

    uv run --with playwright python3 scripts/check-behaviour.py <url>

Exits non-zero if any behaviour check fails.
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4281/"
EXPECTED_TITLE = "Canine OS"

results = []


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))
    mark = "✓" if condition else "✗"
    print(f"  {mark} {name}" + (f"  — {detail}" if detail and not condition else ""))


def note_text(page):
    """The note bar under the animal — what the app just told the reader."""
    node = page.query_selector("[role='status']")
    return node.inner_text().strip() if node else ""


def press(page, label):
    """Press a control in the command bar by its visible name."""
    button = page.get_by_role("button", name=label, exact=False).first
    button.click()
    time.sleep(0.4)


with sync_playwright() as p:
    browser = p.chromium.launch(
        channel="chrome",
        args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"],
    )
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.set_default_timeout(30000)
    page.goto(url, wait_until="load")
    page.wait_for_timeout(2500)

    title = page.title()
    check("the right page is measured", EXPECTED_TITLE in title, title)

    # ---- 1. THE BED ------------------------------------------------------
    print("\nTHE BED")
    press(page, "Bed")
    time.sleep(0.6)
    note = note_text(page)
    check("pressing Bed puts him down", "lies down" in note or "asleep" in note.lower(), note)

    bed_label = page.get_by_role("button", name="asleep", exact=False).first.inner_text().strip()
    check("the Bed control shows he is asleep", "asleep" in bed_label.lower(), bed_label)

    # ---- 2. WAKING HIM ---------------------------------------------------
    print("\nWAKING HIM")
    press(page, "Pet")
    time.sleep(0.6)
    note = note_text(page)
    check(
        "waking him says so",
        "was asleep" in note.lower() or "woken" in note.lower(),
        note,
    )
    check("the interaction still happened", "trust" in note.lower() or "hand" in note.lower(), note)

    # ---- 3. THE COST OF KEEPING HIM UP ------------------------------------
    print("\nTHE COST OF KEEPING HIM UP")
    # Three interruptions in one night. The third is the one that puts him
    # past the point where he can be put down at all. Every note is kept:
    # the count appears on the wake that raised it, and by the last one he is
    # refusing to go down, so the last note is not the one that mentions it.
    notes = []
    for _ in range(3):
        press(page, "Bed")
        time.sleep(0.4)
        notes.append(note_text(page))
        press(page, "Pet")
        time.sleep(0.4)
        notes.append(note_text(page))
    check(
        "waking him repeatedly is noticed",
        any("times now" in n.lower() or "settle easily" in n.lower() for n in notes),
        " | ".join(n for n in notes if n)[-240:],
    )

    press(page, "Bed")
    time.sleep(0.6)
    note = note_text(page)
    check(
        "he refuses to settle when he is wound up, and says why",
        "will not settle" in note.lower(),
        note,
    )

    # ---- 4. SPEAKING -----------------------------------------------------
    print("\nSPEAKING")
    cue = page.locator("#cmd-cue")
    cue.fill("dinner")
    cue.press("Enter")
    time.sleep(0.6)
    note = note_text(page)
    check("a spoken word gets an answer", "dinner" in note.lower(), note)

    # ---- 5. THE COACH ----------------------------------------------------
    print("\nTHE COACH")
    # The Coach is a region on a wide screen and a tab on a narrow one.
    if page.viewport_size["width"] < 1024:
        page.get_by_role("tab", name="Coach").first.click()
        time.sleep(0.6)
    # The Coach opens on PRACTICE; switch to REAL LOG to test the rep timer.
    log_btn = page.get_by_role("button", name="REAL LOG", exact=False).first
    if log_btn.is_visible():
        log_btn.click()
        time.sleep(0.4)
    # A real rep: he did it, then he was marked.
    page.get_by_role("button", name="He did it", exact=False).first.click()
    time.sleep(0.6)
    page.get_by_role("button", name="Marked", exact=False).first.click()
    time.sleep(0.8)
    coach_text = page.inner_text("body")
    check("the coach measures the delay", "ms" in coach_text.lower(), coach_text[:200])

    # The cue word must actually be stored, not typed and forgotten.
    cue_field = page.locator("#coach-cue")
    cue_field.click()
    cue_field.fill("sit down")
    cue_field.press("Enter")
    time.sleep(0.5)
    stored = page.evaluate(
        """() => {
            const raw = localStorage.getItem('canine_os_pet_states_v1');
            if (!raw) return null;
            const states = JSON.parse(raw);
            for (const id of Object.keys(states)) {
                const s = states[id];
                for (const name of Object.keys(s.behaviours || {})) {
                    const cues = s.behaviours[name].cues || [];
                    if (cues.length) return cues.join(',');
                }
            }
            return null;
        }"""
    )
    check("a cue word is stored on the behaviour", stored is not None, str(stored))

    # ---- 6. THE OBSERVATION LOG ------------------------------------------
    print("\nTHE OBSERVATION LOG")
    observation = page.locator("#coach-observation")
    observation.select_option(index=1)
    time.sleep(0.3)
    page.get_by_role("button", name="Record", exact=False).first.click()
    time.sleep(1.0)
    observed = page.evaluate(
        """() => {
            const raw = localStorage.getItem('canine_os_pet_states_v1');
            if (!raw) return null;
            const states = JSON.parse(raw);
            for (const id of Object.keys(states)) {
                const n = (states[id].observations || []).length;
                if (n) return n;
            }
            return 0;
        }"""
    )
    check("an observation is kept in the record", observed and observed > 0, str(observed))

    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} behaviour checks passed.")
if failed:
    sys.exit(1)
