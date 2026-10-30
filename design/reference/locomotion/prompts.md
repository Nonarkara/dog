# Motion artwork prompt briefs

Built-in imagegen, reference-image generation, transparent_background=true. These are normalized production briefs for the final source set; source PNGs are preserved beside this file. Identity references were the approved `public/dogs/{name}.webp` drawings. The latter two briefs also used the reviewed source motion sheet as a pose reference; the dog reference owns identity.

Common constraints: same cute sparse hand-painted anime cel linework, consistent face/markings/proportions across tiles, entire dog including paws/ears/tail, transparent gutters, no words/borders/scenery/props/shadows. Actual alpha was retained even when invisible RGB showed a dark backdrop in a preview.

- Expo: Thai Bangkaew, dark sable saddle/mask, tan cheeks, thin white blaze, white ruff and curled white plume.
- Mali: Expo's sister, distinctly shorter/plumper, broad barrel body, short sturdy legs, matching sable/white breed markings.
- Oreo: pied French bulldog, black face/narrow white blaze, mismatched white/dark bat ears, white stocky body/black saddle, stub tail.
- Paolo: fawn chubby pug, folded black ears, heavy dark jowls/mask, forehead folds, little offset pink tongue and small curled tail.
- Hachiku: cream Akita/Hachiko likeness, black eyes/nose, one upright ear and one softly folded ear, thick cream plume.

`{name}.png`: exact4columns×3rows, first two rows eight sequential left-facing side-view trot keys with alternating diagonal support and bent elbows/hocks; third row front-left three-quarter, direct front, direct rear, rear-left three-quarter. Fixed torso center/scale. The drawings established walk/turn sources; repeated limb support was not treated as a complete physically correct gait.

`{name}-run.png`: exact2columns×2rows, four distinct left-facing whole-body gallop keys: (1) both forelegs reaching left/both hindlegs extending right in suspension, (2) forepaws landing/braced and hindlegs folded, (3) all four paws gathered beneath arched torso in suspension, (4) hindlegs pushing down/back with forelegs curled to chest. Same dog/torso scale. The Expo follow-up removed background while preserving these four poses.

`{name}-depth.png`: exact4columns×2rows, four front-view trot phases toward the viewer, then four rear-view phases away. Foreleg support exchanges left/right, the other leg visibly bends/lifts; rear hocks likewise exchange support with a raised pad and diagonal forepaws peeking ahead. Fixed head/torso scale and floor; no upright human posture or repeated standing dogs. Authoring completes a reflected lower-leg exchange where the generated sheet repeated support, retaining the unreflected face/ear asymmetry/upper coat.

The PNGs are source artwork. Locally run RIFE4.6 supplies the in-between frames; alpha staging, registration, crop metadata, head proportional correction and packing are reproducible in `scripts/illustrated/`. No source sheet, binary or model is fetched by the running game.
