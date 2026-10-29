# Dog-Tamagotchi audit · 29 October 2026

The MVP task is to notice what the dog needs, act without leaving the animal, and see an immediate bodily response. The dog remains the dominant element; care and command controls stay together. Design reference: Bandai's original Tamagotchi one-screen care loop, with simplified animated canine silhouettes. Studio Ghibli's official Howl and Mononoke galleries informed the decision to suggest volume with silhouette, solid color and sparse marks. No film artwork is shipped.

## Evidence and changes

No Gemini report file was available with this request. The supplied three photos, repository source, build history and rendered previous build were audited directly. Attached material is evidence, not an instruction source.

- Previous avatar: 7 or 11 fur shells plus the surface on each body part, with random strand textures and separate shaders. Rendered Expo at 390×844: **384,264 triangles / 146 draw calls**. Revised: **24,332 / 31**, approximately **94% fewer triangles and 79% fewer draw calls**. These are scene rendering counts, not claimed network or load-time percentages. Three.js remains the largest downloaded dependency. No new image textures or models are required.
- Solid toon surfaces replace fur shells. Sparse animated cheek/chest strokes suggest the Bangkaew ruff. Expo keeps the dark saddle, white chest/blaze, tan cheeks, amber eyes, pricked ears and curled plume. Larger eyes and a lower, broader head improve expression.
- Mali is corrected to a female Bangkaew, Expo's sister, with a broad, low silhouette. Her stored history survives. Oreo has a short muzzle, pied coat, rounded bat ears and bob tail; Paolo has a dark short muzzle, folded ears, wrinkles and curled tail; Chai is a russet/cream Shiba. Bangal and Kofi remain available. The request's Shibuya reference was interpreted as a Shiba companion; Hachikō was an Akita.
- Dog switching previously loaded state in one effect and saved old state under the new identity in another. Switching now batches identity and state. Action/game timers are canceled on switching; the avatar is keyed by identity.
- Migration previously dropped coat pattern/point colors before deciding how to repair them. It now preserves avatar configuration and adds missing starter companions without replacing existing records or imported models.
- Catch previously used a hidden random outcome. Each round now states the ball direction before the player chooses. Correct choices score; missed choices visibly jump away from the ball. Restart/close/unmount invalidate pending rounds. Completion runs outside React state updaters, avoiding duplicate side effects in Strict Mode.
- Sick dogs do not launch catch. An attention call for activity offers play or a sniff walk. Existing decay, sleep, cleanup, training, Commons, record editing and model import remain.
- Virtual companions have no invented birthdays, weights, chip IDs or clinical records. Unknown fields say “Not recorded”; Care distinguishes recorded weight from virtual companions. Existing clinical records were preserved, not verified.
- Render rate capped around 30fps, DPR at 1.5, hidden-tab rendering skipped. Reduced-motion mode slows rendering and removes idle breathing/wagging/petting bounce; functional actions remain visible. Temporary ball/particle GPU resources are disposed.

## Verification

`npx tsc --noEmit`; `npm run test:domain` (100/100); `npm run build`.

Rendered suite: `scripts/test-tamagotchi.cjs`, with Playwright supplied through NODE_PATH when using the bundled runtime. It checks page fit, first-screen controls, triangle/call budgets, all five companions, guaranteed five-correct-choice victory, close cleanup, separate per-dog fullness, refresh persistence and runtime errors. Screenshots and measured JSON: `/tmp/dog-tamagotchi-evidence/`.

| Viewport | Page | Header + care controls | Stage | Controls bottom |
|---|---|---|---|---|
|390×844|390×844|138px|372×248px|844px|
|1024×768|1024×768|98px|1006×307px|768px|
|1440×900|1440×900|98px|587×784px|900px|
|1280×720|1280×720|98px|1262×288px|720px|

The pre-change 390px capture also fit 390×844 with a 372×248 stage; this change preserves the operating frame. Budget: no document overflow; controls within viewport; stage ≥240px high; combined chrome ≤150px; avatar <35,000 triangles and <45 calls. A fixture-only 500px header must violate the same chrome budget. The original rendered fur avatar violates both performance budgets. This is not a claim that every possible Record/Coach expansion has been re-audited.

Independent agent review inspected phone/tablet/desktop and the five dog captures, ran types/domain checks, and identified ball-direction, restart-timer, weight-label, breed-ear and unknown-record-field defects. All were corrected. The final source uses unknown-field guards in RecordPanel. Seven-rule visual pass: existing compact frame and typography retained; no new decorative panels, equal card grid, slogan, font, gradient or UI accent. Catch HUD wraps on phones with 32px targets. Animal pigmentation is character content.

## References

- [Bandai original Tamagotchi manual](https://tamagotchi-official.com/manual/toy/original/Original_webmanual.pdf): visible care/attention indicators, feeding, play, cleanup, sleep and illness. This is a software simulation; its state does not diagnose a real dog.
- [Studio Ghibli: Howl's Moving Castle](https://www.ghibli.jp/works/howl/) and [Princess Mononoke](https://www.ghibli.jp/works/mononoke/): official visual references.
- [Tokyo's official Hachikō guide](https://www.gotokyo.org/en/spot/86/): Akita identity of the Shibuya dog.

Likeness remains a procedural interpretation of the photos. Mali/Oreo/Paolo/Chai have no supplied individual photo references; their geometry follows the requested description. Render-time reduction is measured; real-device cold-load time and battery consumption are unmeasured.

## Live closeout

The complete rendered suite passed against `https://dog.nonarkara.org` after deployment (Cloudflare version `41b9446f-1d5d-43c5-9664-25da5c533311`), with zero runtime errors. Live screenshots and actual measurements are in `/tmp/dog-tamagotchi-live/`. The viewport table above matches that live run. The original avatar was also run through the same regression suite at an isolated local baseline URL and rejected with `Triangle budget: 384264`.

Code commit: `1597c44`. Independent review explicitly closed the final RecordPanel unknown-field finding. All reviewed findings are resolved. The first live automation attempt was unverified because its tab did not produce a rendered frame; explicitly foregrounding the test tab allowed the complete live suite to run and pass.

## Paolo photo reference update

The owner subsequently supplied two Paolo photos (`Paolo Mandes de Rocha.jpg` and `Paolo Mandes de Rocha(1).jpg`). These supersede the earlier lack of an individual Paolo reference. His procedural likeness now has a pale cream forehead/body, low dark eye mask without a white blaze, wider flat jowls, a larger head, black folded ears, heavy brow crease strokes and a small offset tongue. These details use simple geometry and line strokes: **23,700 rendered triangles / 29 draw calls** at 390×844. Other breeds keep their existing geometry branches. Existing Paolo starter records receive the palette update only when all three stored colors match the prior default; custom colors and owner notes are preserved.

Photo-match capture: `/tmp/dog-audit/paolo-photo-match.png`. The regression suite now also seeds the previous Paolo palette and verifies the corrected cream palette survives reload while retaining an owner-written note. Page geometry budgets are unchanged. The two reference photographs are used as likeness evidence, not loaded as fur textures.
