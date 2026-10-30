# Tama-Dog-Chi — what to do next

**Live:** https://dog.nonarkara.org/ <br>
**Repo:** [Nonarkara/dog](https://github.com/Nonarkara/dog) · tip `7163af6` (handwritten care + five-dog household) <br>
**Gate:** 2026-10-30 · desktop + phone · shots in this folder <br>
**Verdict:** Handwriting redesign **PASS**. Park / Commons **FAIL** (still placeholder). No console reds; no hard crash. Ship park rewrite before calling the product done.

---

## 1. What’s already good (keep)

| Area | Why it works |
| --- | --- |
| Non Architecture handwriting + cream / hairline UI | Cohesive, yours, not Inter/slop. |
| Landing (Play / Your dog / Restore) | First-timer starts in &lt;30s; phone layout is strong. |
| Own-a-dog chooser → home | Clear adopt path; five dogs (Expo, Mali, Oreo, Paolo, Hachiku). |
| Care meters + status sentence | Tamagotchi loop is readable. |
| Coach Sit lure → mark → treat | Core clicker loop works; feedback improved (“Early marker…”). |
| “Show control labels” | Good escape hatch for icon-only toolbar. |
| Local-first saves | No account; Play vs Own envelopes — keep. |

Do **not** rip these up while fixing the park.

---

## 2. The park is still bad (root cause)

`src/components/CommonsPanel.tsx` builds the world from **Three.js primitives**:

- Ground: `PlaneGeometry` flat olive (`0xc5d4b2`)
- “Ramp”: dark `BoxGeometry` slab
- “House”: black `BoxGeometry` + orange `ConeGeometry` roof
- “Bowl”: blue `CylinderGeometry` (reads as a floating disc)
- Neighbours: box body / head / ears (low-poly blocks)
- Own dog: optional **2D Sprite** from illustration (Oreo) — no contact shadow

So the illustrated home stage and the park speak two languages. Camera defaults crop the house; neighbour count says “6 dogs” while only a tiny brown block appears late. This matches Non’s call: **park still bad**.

Existing design intent already says replace primitives: `design/3d-asset-brief.md` (Meshy-quality GLBs, Oreo first) and `design/handwritten-play-space.md` (Commons = dedicated world ≥60% of phone, roster/chat on request).

### Recommended direction (pick one, then finish)

**Option A — Illustrated park (fastest visual match)** <br>
Keep Oreo’s 2D art. Rebuild Commons as a **hand-drawn / flat illustrated** park (same Palette + Non Architecture): grass, path, tree, bowl on the ground, other dogs as illustrated sprites with names. Drop Three.js scenery or use it only for camera pan under sprites. <br>
*Best if you want the park to feel like the home stage tomorrow.*

**Option B — Full 3D park (matches `3d-asset-brief.md`)** <br>
Ship one good Oreo GLB (+ neighbours as same-pipeline assets or temporary illustrated billboards with shadows). Replace box house/ramp/bowl with authored props. Fix camera framing to body bounds. <br>
*Best long-term; slower; needs Meshy/Blender pipeline + `RiggedAvatar` gaps closed.*

**Do not** keep mixing high 2D Oreo with untextured boxes. Hide Park behind a “coming soon” home tip until A or B lands if you must ship other fixes first.

---

## 3. Do-list (ordered)

### P0 — Park rewrite (block “done”)

1. **One art language** <br>
   - Choose A or B above. <br>
   - Add a soft contact shadow under the player dog. <br>
   - Scale props to dog size; put bowl on the ground; remove / replace the charcoal slab and giant orange-roof cube.

2. **Camera** <br>
   - Sensible default pitch/zoom so dog + neighbours fit. <br>
   - Horizon above the ground (no pale-blue strip under the plane). <br>
   - Keep ± / re-center from covering the scene; hide “Pinch to zoom” on desktop pointer devices.

3. **Other dogs** <br>
   - If UI says *N* dogs, *N* must be on-screen or in a roster you can open. <br>
   - Same style as Oreo (or clear “visitor” badge). <br>
   - Name tags on hover/tap; “Tap a dog to pet” must hit something.

4. **Park chrome** <br>
   - Rename `COMMONS · LOCAL` → human copy (e.g. “Park”). <br>
   - Confirm before **Clear**. <br>
   - Tip “YOUR LITTLE UNIVERSE” auto-dismiss; don’t permanently eat park height on phone.

**Primary file:** `src/components/CommonsPanel.tsx` <br>
**Related:** `design/3d-asset-brief.md`, `design/handwritten-play-space.md`, `RiggedAvatar.tsx` (if Option B)

### P0 — Header honesty

5. Drop or rewrite **“Age not recorded / Virtual companion”** for owned puppies (unknown → omit, don’t advertise as broken). <br>
6. Explain or remove **“Lemon explorer”** (personality label needs a one-word legend or tooltip).

### P1 — First-timer clarity & load

7. **7-day growth on home** — not only `Puppy · 1/7` in the header: seven dots / bar under the dog + one line (“1 min attention × 7 days → adult”). <br>
8. **Kill blank load** — preload hero + fonts; skeleton instead of `OREO — LOADING` / `COACH — LOADING`; landing dog before first paint. <br>
9. **Toolbar** — show labels on desktop by default; keep “Show control labels” on phone. Clarify Walk vs Park. <br>
10. **Coach first-run** — one tip: wait for the move → Yes → Treat; greyed buttons need a reason. Soften “early marker” copy. Clarify **WITH THE REAL … NOTES** (virtual practice vs log with the real dog). <br>
11. **Phone tips** — one toast lane, auto-hide, no truncation / stray `?`. <br>
12. **Desktop home** — enlarge care/coach type (~12px min for handwriting body); shrink empty cream under Coach; dog stays focal. <br>
13. **Reset** — confirm before factory reset in the header.

### P1 — Perf sniff

14. Clicks sometimes stall (heavy main thread / WebGL). Profile park open + care actions; pause hidden-tab work (already intended); consider not mounting Three until Park opens.

### P2 — Polish

15. Trick-button tooltips; softer non-alarm **FLAT** arousal. <br>
16. Own chooser: small dog previews, not text chips only. <br>
17. Clear Home return in park (phone tree icon alone is weak).

---

## 4. Acceptance checks (re-gate after park)

- [ ] Squint test: park looks like the same product as home (one art language). <br>
- [ ] Player dog grounded (shadow); no floating blue disc; no giant cropped house. <br>
- [ ] All listed dogs visible or rostered with names. <br>
- [ ] Default camera: dog + at least two neighbours framed; horizon correct. <br>
- [ ] Desktop: no “Pinch to zoom”; Clear asks confirm. <br>
- [ ] Header: no “Age not recorded” for virtual puppies; Lemon explorer explained or gone. <br>
- [ ] Cold load: no empty `— LOADING` panels &gt;1s; landing hero painted early. <br>
- [ ] Phone 390: ≤1 tip bar; dog stage ≥ ~half viewport in Care. <br>
- [ ] Home shows 7-day progress with one-line why. <br>
- [ ] `npm run test:domain` + spatial check still green; Playwright suite if present.

---

## 5. Suggested PR split (for @Git)

| PR | Scope |
| --- | --- |
| **dog-park-art** | Commons rewrite (Option A *or* B), camera, neighbours, chrome (P0 §1–4) |
| **dog-first-timer** | Growth UI, load skeletons, toolbar labels, coach tip, tip lane, header copy, Reset confirm (P0 §5–6 + P1 §7–13) |
| **dog-perf** | Park lazy-mount + input jank (P1 §14) |

Play re-gates after each draft lands (local `bun run dev` on `:3100` or live after `wrangler deploy`).

---

## 6. Evidence shots (this folder)

| File | What it shows |
| --- | --- |
| `01-landing-desktop.png` | Handwriting landing |
| `01b-landing-desktop-dog-not-yet-loaded.png` | Blank hero flash |
| `02-home-desktop.png` | Care + coach home |
| `02a-home-loading-shells.png` | OREO/COACH LOADING |
| `03-park-desktop.png` | 2D Oreo + box park (bad) |
| `03b-park-desktop-other-dog-block.png` | Block neighbour |
| `04-phone-*.png` | Landing, care, tip stack, coach, park |

Earlier gate (pre-recheck): `/workspace/dog-gate/`.

---

*Play · Master Game Tester · 2026-10-30 (Asia/Bangkok)*
