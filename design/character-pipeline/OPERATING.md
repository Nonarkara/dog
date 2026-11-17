# Character Sprite Pipeline — Operating Manual

## Purpose
Produce consistent, review-gated 2D orthographic dog sprites that satisfy MSH, Sanzo Wada palette, and Park world rules.

## Principles
* **2D orthographic first.** Elevation is layering, never geometry. Isometric is rejected.
* **MSH first.** Boxes fit content. Phone-first `390px`. Hero >= 1/2 viewport on entry/home.
* **Palette lock.** Sanzo Wada 2–4 colour combos per dog (`src/data/dogThemes.ts`) + single UI accent `#f59e0b`. No gradients, no drop shadows, zero border-radius except true circles.
* **Honest envelope.** Every generated sprite ships with `{ source, tier, age, reviewGate }` metadata.

## Reference Sheets
Location: `public/dogs/<dog>.webp` (`stand`) and `public/dogs/<dog>-<pose>.webp`
Dogs: `expo`, `mali`, `oreo`, `paolo`, `hachiku`
Canonical 9 poses: `stand`, `sit`, `down`, `bow`, `paw`, `pet`, `feed`, `sleep`, `sick`
Each reference is authored in NonArchitecture handwriting (flat cel + `#614c37` ink contour).

## Generation Contract
Command (supports both `--flag value` and `--flag=value`):
```bash
node scripts/generate-sprite.js --dog expo --pose sit [--seed 42] [--dry-run]
```

Outputs:
* `public/dogs/sprites/<dog>-<pose>.webp`
* `public/dogs/sprites/<dog>-<pose>.meta.json`

Metadata includes `dog`, `pose`, `seed`, `source`, `output`, `tier`, `age`, `projection: "2d-orthographic"`, `paletteLock: "wada-2-4-color"`, `accent: "#f59e0b"`, `readabilityRangePx: [104, 128]`, `reviewGate: "SPRITE_GEN_REVIEW"`, and `generatedAt`.

## Palette 5-Step Gate
1. Enlarge reference
2. Remove hue — check value/structure
3. Assign roles — field, ink, rule, signal
4. Measure contrast — WCAG AA minimum (4.5:1)
5. Test without colour

Accent `#f59e0b` has one job only: live signal.

## MSH Gates
* Box = label + padding. No artificial `min-height` stretch.
* Dense toolbar cells `32px–34px`, isolated primary actions `44px`.
* One screen first: `390x844`, `1024x768`, and `1440x900` fit without document scroll.
* Park dog nameplates stay locked to 2 discrete near/far steps (`13px` / `14px` scaled by `unit`).

## Review Gate
`src/utils/fluxDogPlay.ts`:
```ts
export const PLAY_MOMENT_CARDS = false;
export const SPRITE_GEN_REVIEW = false;
```

All generated sprites in `public/dogs/sprites/` remain gated until owner review:
1. Identity consistency per dog (`expo`, `mali`, `oreo`, `paolo`, `hachiku`)
2. Wada palette lock + AA contrast verified
3. MSH box-fit verified at `390` / `1024` / `1440` (`one-screen.py` + `spatial-check.mjs`)
4. Park canopy and 1-point depth rules intact (`smallestDogWidth >= 120px`, `canvas.dataset.ownCanopy`)
5. Honest envelope metadata present

## Testing
```bash
npm run test:sprite
node scripts/generate-sprite.js --dog expo --pose sit --dry-run
```

## Park World Rules
* Tree canopies (`src/domain/parkCanopy.ts`) are elevated walkable platforms with `CANOPY_HYSTERESIS = 0.06`.
* Trunks pass-through; dogs on canopy draw at `CANOPY_RENDER_ORDER`.
* No grass shadow or paw contacts on canopy; no cross-elevation collision push.
* 1-point eye-level perspective scales dog size (`0.85..1.22` along `y`) while preserving `minTouch >= 120px`.
