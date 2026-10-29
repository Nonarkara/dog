# Flux artwork and 30 fps Dog-Tamagotchi animation

The owner accepts a Ghibli-inspired illustrated dog and wants all behavior animated at 30 frames per second. The goal is recognizable, appealing dogs with coherent movement. FLUX.1 Schnell weights are present locally. The existing live 3D stage remains until a replacement prototype is visually accepted.

## Separate artwork from animation

Flux supplies images, not a canine skeleton or a temporally coherent set of motion frames. Generate and review a character master first, then author a small number of consistent poses/layers. Play them through a rig or sprite animation system at a target 30 fps (33.3ms per rendered frame). Thirty fps does not imply generating thirty independent images for every second. Interpolation must preserve limbs/markings; cross-fading unrelated dog pictures is not acceptable animation.

Start with Paolo, using the owner's photos and the approved cute standing studio reference. Keep his cream body, dark broad muzzle, forehead folds, folded ears, heavy body and small visible tongue. Match style once; do not let anatomy change between actions.

## Complete action coverage

| Action/state | Required movement |
|---|---|
| Idle | breathing, periodic blink, small ear/head adjustment |
| Pet | lean toward the hand, softened eyes, tail response |
| Feed | approach bowl, lower head, chew, return to idle |
| Walk | coherent four-leg gait, body weight transfer, tail follow-through |
| Play | bow, left/right catch, landing, happy recovery |
| Groom | settle under brush, brief shake, relaxed recovery |
| Sit/down/paw | anatomically coherent transitions and stable held pose |
| Sleep/wake | settle, breathing with closed eyes, wake/stretch |
| Listen | ears orient, head tilt, attention toward cue |
| Needs/sickness | subdued idle and clear game-state cues |
| Cleanup/recovery | track the action and return to the correct persistent state |

A first proof should cover idle, pet and walk before producing every action for all five dogs. Tail, eyes and pose must react to the actual domain state and pointer input. Existing care/training/history, catch game and per-dog IDs remain intact.

## Local generation experiment

- Model: existing black-forest-labs/FLUX.1-schnell cache, verified weight files present.
- Runtime: isolated MFLUX environment under ~/.local/share/dog-3d/mflux-env; no subscription or hosted inference.
- Try image-to-image using the standing Paolo reference, a fixed seed and a restrained hand-drawn animation style prompt.
- Compare output to the photos/master before preparing more poses. Same seed alone does not guarantee identity consistency.
- If Schnell cannot preserve identity while changing poses, use it for design only; evaluate reference-conditioned editing or authored rig animation separately rather than presenting inconsistent frames as a finished loop.

## Review and measurement before replacing live art

- No changed face, lost markings, floating feet, fused legs or visible cutout seams.
- Inspect each loop in motion, its transitions, and still frames; a beautiful single frame cannot clear the animation.
- Measure actual render rate and frame-time spikes at 390×844, 1024×768, 1440×900 and 1280×720. State the tested device and distinguish a 30 fps target from a measured sustained rate.
- Reduced-motion mode shows static poses/brief feedback. Hidden tabs pause rendering.
- Keep image atlas bytes and decoding time visible in the report. Do not inflate downloads with a separately generated image for every display frame.
- Do not remove the existing canvas, game, records, training or park to make a prototype look complete.

## Current status

The photorealistic standing Paolo reference is saved at design/reference/paolo/standing-studio-reference.png. It was generated with the built-in image tool, not Flux; the local Flux experiment must be labeled separately. No illustrated animation is claimed complete by this plan.

## Verified local Flux experiment

The existing runtime was found at ~/Projects/_toolkit/mflux-venv/bin/mflux-generate by following the shared-memory lesson to the life project’s generation script. The separate experimental environment under ~/.local/share/dog-3d was not needed.

The first image-to-image test reused the cached Schnell weights and portrait-illustration LoRA entirely offline. Seed 7306, 1024×608, eight configured steps, reference influence 0.65, LoRA scale 0.85. Three denoising iterations ran in 33.57 seconds; the command reported 31.28 GB peak MLX memory. These are image generation figures, not animation frame rates. The output preserved a recognizable pug but remained too photographic for a hand-drawn master. It is a candidate, not accepted animation art.

A second candidate lowers reference influence to 0.35 and raises the illustration LoRA to 1.2. Neither still image establishes temporal consistency or 30 fps playback. Those require a separate motion prototype and measurement.

## Cel-art experiment and independent review

Removing photographic image conditioning produced flux-cel-v1.png, a genuine 2D style candidate. Four denoising iterations took about 124.6 seconds under the observed machine load; reported peak MLX memory was 30.80 GB. It is a style experiment, not an animation or final Paolo likeness. Independent review found the drawing direction promising but requested a broader/lower head, heavier jowls, smaller folded ears, shorter legs, separated front paws and the offset tongue.

For any eventual atlas, remove the background only after art review; keep identical canvas size, foot baseline, scale and pivots across poses. Export alpha correctly and inspect against both light and dark stages. Do not ship a white rectangle or let the dog change size between frames.

The current research question is whether to use illustrated 2D animation or actual rotatable 3D dogs for the MVP. Flux can produce source art for either; the renderer/rigging work is different. No live source code was changed during the local generation experiment.

## Owner decision and implementation

Resolved: the owner selected illustrated 2D animation for the MVP. The implementation and artwork provenance are recorded in [illustrated-animation.md](illustrated-animation.md). Local Flux supplied a style study; final photo-informed illustrations and authored poses were refined with the built-in reference-image editor. Runtime movement uses an image mesh and a 30 fps display scheduler, rather than independently generated display frames.
