# Tama-Dog-Chi Character Sprite Pipeline

Repeatable, review-gated pipeline for authoring consistent 2D orthographic dog sprites that match the household's Wada palettes, NonArchitecture ink linework, and MSH readability budgets.

## 1. Reference Sheet Format

Each canonical companion (`expo`, `mali`, `oreo`, `paolo`, `hachiku`) has 9 orthographic pose sheets in `public/dogs/`:
- `<dog>.webp` (`stand`)
- `<dog>-sit.webp`
- `<dog>-down.webp`
- `<dog>-bow.webp`
- `<dog>-paw.webp`
- `<dog>-pet.webp`
- `<dog>-feed.webp`
- `<dog>-sleep.webp`
- `<dog>-sick.webp`

All sprites are 2D orthographic (no 3D perspective distortion in the sprite frame itself; park depth scaling is applied dynamically at render time in `src/components/IllustratedPark.tsx`).

## 2. Prompt Scaffolding (`character + pose + action`)

```text
[character]: <canonical dog coat, ear shape, collar/tag, Wada 2-4 pigment combo>
[pose]:      <stand | sit | down | bow | paw | pet | feed | sleep | sick>
[action]:    <micro-expression or limb offset, e.g. raised paw, relaxed ear, wagging tail>
[framing]:   2D orthographic flat cel illustration, #614c37 ink outline, readable at 104-128px on 390px phone screen, transparent background, no gradients, no drop shadows.
```

## 3. Palette Lock & Post-Process

- Lock coat + prop fills to each dog's credited Sanzo Wada 2–4 colour combination (`src/data/dogThemes.ts`).
- Single UI highlight accent: `#f59e0b`.
- Ink contour: `#614c37` (or `#294434` on dark accents).
- Phone-first legibility: silhouettes, eyes, and muzzle markings must read clearly at `104px–128px` width (`smallestDogWidth >= 120px` in `IllustratedPark.tsx`).

## 4. Review Gate (`SPRITE_GEN_REVIEW`)

Generated sprites in `public/dogs/sprites/` are **never** surfaced to players automatically:
- `SPRITE_GEN_REVIEW` in `src/utils/fluxDogPlay.ts` defaults to `false` (matching `PLAY_MOMENT_CARDS = false`).
- `src/components/CommonsPanel.tsx` gates any generated sprite override behind `SPRITE_GEN_REVIEW`.
- Run `node scripts/generate-sprite.js --dog expo --pose sit --dry-run` to inspect planned output and metadata before generating or reviewing assets.
