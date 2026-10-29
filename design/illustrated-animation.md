# Illustrated Dog-Tamagotchi MVP

The owner chose illustrated 2D animation for the MVP on 29 October 2026. The default stage now uses Expo, Mali, Oreo, Paolo and Hachiku illustrations, with the existing care, catch, training and per-dog persistence contracts. Hachiku keeps the historical `shiba-chai` storage ID. Existing companions, customized coats and imported 3D models retain their render paths.

## Artwork provenance

The existing local FLUX.1 Schnell runtime produced the style study `reference/paolo/flux-cel-v1.png`. That experiment established a useful drawing direction, but its legs, ears and jowls did not match Paolo well enough. The final Paolo illustration and household/pose sheets were generated with the built-in reference-image editor, using the owner’s dog photographs and reviewed references. They are not represented as Flux outputs. No Meshy/Tripo subscription, credits or 3D export was used by this implementation.

Expo keeps the dark sable saddle/mask, tan cheek patches, thin white blaze, thick white chest and plume tail. Mali has a lower, wider body. Oreo keeps the black mask, narrow blaze, mismatched white/dark bat ears and body patches. Paolo has heavy dark jowls, forehead folds, folded ears, short legs and an offset tongue. Hachiku is a cream Akita with one folded ear.

The source sheets are development material under `design/reference/`, excluded from the runtime bundle. Runtime images live in `public/dogs/`. Each 768px alpha WebP has a shared floor baseline. `scripts/illustrated/build-art.cjs` records the source crops; `prepare-art.cjs` removes border-connected paper, drops detached neighboring fragments, and normalizes the silhouette. Inspect on a dark background after rebuilding. Sharp is an authoring dependency only.

## Motion, not generated display frames

The renderer runs a textured skin at a target 30 display frames per second. It interpolates breathing, head attention, pet lean, tail response, gait, chewing and grooming shake. Each dog's normalized landmarks align the face and paws to its illustration. Expressions use reviewed source drawings; no synthetic eyelid disks are painted over the eyes.

Standing, sitting, lying and sleeping use separately authored canine anatomy; sleep has painted closed eyes and a head resting on the paws. Pose changes use eased landmark registration and one fully opaque drawing per frame, avoiding double faces or translucent limbs. Large vertical moves settle through standing, sitting, lying and sleep. Step durations are latched (420ms, 260ms for affection) so a new request cannot change an in-flight step’s speed. This is a stylized registered handoff, not a claim of seamless full skeletal animation. Paw uses an authored seated drawing with a bent raised foreleg. Feeding uses an authored muzzle-at-the-bowl pose with gentle chewing. Authored happy, closed-eye affection poses replace the synthetic eyelid effect rejected by the owner. Expo’s sleep drawing includes his signature green bolster. The five-round catch game shows the target ball, direction choice, hop and result, then applies its reward once. Direct pointer strokes and keyboard petting reach the same domain callback.

These are rigged illustrations with authored key poses, not thirty separately hand-drawn images each second and not rotatable 3D dogs. The MVP gait and pose changes are stylized; a later animation pass can add more anatomical in-between drawings without changing the domain model.

## Performance and verification

Only the active dog's seven textures load. Old textures, pixel masks, geometry, material, renderer, pointer listeners, resize observer and frame callback are disposed on dog change. Rendering pauses in hidden tabs. Reduced motion renders at 6 fps, suppressing looping shader time, gait and hops. Canvas data attributes expose observed fps, rendered frame count, current pose and draw counts for the browser checks.

Run:

```sh
npm run test:domain
npx tsc --noEmit
DOG_URL=http://127.0.0.1:3189 node scripts/test-tamagotchi.cjs
DOG_URL=http://127.0.0.1:3189 node scripts/test-illustrated.cjs
DOG_URL=http://127.0.0.1:3189 node scripts/illustrated/review-motion.cjs
```

The browser scripts need Playwright available through the authoring environment. `review-motion.cjs` uses a development-only fixture, captures actual poses/action pairs for all five dogs and records video. The fixture holds each controlled action prop for inspection; the full app checks exercise the normal two-second care lifecycle. Each captured action has matching metadata before and after the screenshot. The final visibility-pause check supplies a simulated `document.hidden` value in headless Chrome; native background-tab behavior was not certified by that check. It is not a production route. FPS measurements on this Mac do not establish physical-phone performance; physical device testing remains separate.

## Owner-directed game revision

The owner explicitly rejected the black console theme and synthetic eyelid appearance. [Personality palettes](personality-palettes.md) records consultation of the Palette project and source combinations. Care controls, navigation tabs, meter names and care-log labels now lead with symbols, retaining accessible names and an expandable touch legend. Informational advice, names and medical/training qualifications remain readable. Imported/fallback stages and Commons use light backgrounds too.

`test-game-design.cjs` checks five distinct light schemes, real rendered contrast pairs, frame rate, control legend, sick/mess/medicine/cleaning states and layout. `scripts/illustrated/test-transitions.cjs` records actual frame progress and video while rapidly changing requests, and verifies that an active step retains its duration and does not restart.
