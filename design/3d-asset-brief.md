# Dog-Tamagotchi: replace primitive avatars with authored 3D assets

User direction, 29 October 2026: the current procedural dogs do not meet the requested visual quality. Stop treating more markings on primitive shapes as a solution. Target the quality of a polished Meshy image-to-3D character, using real canine anatomy and each dog's photographic identity.

## First asset: Oreo

Use the four supplied Oreo photos, especially IMG_7467.JPG for frontal identity and IMG_9634.JPG for body and muzzle. IMG_7306/7307 provide ear/profile references. Clothing, people, furniture and backgrounds are reference obstructions; do not reconstruct them as part of the dog.

- Adult French Bulldog, anatomically coherent four-legged body; compact muscular chest, short legs, natural shoulders/hips and individual paws.
- Large rounded bat ears. In the frontal portrait, viewer-left ear is predominantly pale; viewer-right ear is dark. Preserve the asymmetry.
- Dark face/eye patches, thin irregular white forehead blaze, pale broad muzzle, black nose, sparse muzzle freckles, white neck/body and small dark body spots.
- Warm dark eyes with natural sockets and eyelids. Friendly expression with restrained stylization; avoid inflated globe eyes, tiny detached muzzle, stacked spherical neck rings or toy cylinder legs.
- Short smooth coat conveyed by the mesh, color and restrained material roughness. No individual hair geometry or shell fur.
- Neutral standing pose with four paws separated, mouth closed or slightly open, tail visible, no accessories. Preserve dog anatomy rather than forcing a humanoid A/T pose.

Generation brief: “A polished, game-ready stylized 3D portrait of the exact adult French Bulldog in these reference photographs. Preserve his black facial patches, narrow white blaze, asymmetrically marked rounded bat ears, white body and freckled short muzzle. Natural canine anatomy, compact muscular chest, short sturdy legs, defined paws, continuous skin surface and subtle short-coat shading. Gentle expressive dark eyes and friendly alert expression. Neutral four-legged standing pose, all paws separated, no clothing, collar, leash, furniture or background objects. Restrained character-film stylization, anatomically believable proportions.”

This is an input brief, not a claim that a model has been generated. Source-image quality and hidden anatomy can require cleanup after generation.

## Verify likeness before animation

Inspect the actual textured mesh from front, both sides, back and a full turntable. Compare against the photographs: breed silhouette, head/muzzle proportions, ear shape/asymmetry and markings. Inspect underside, paws, mouth and tail for fused, missing or duplicated parts. A good single rendered image is not evidence that the mesh works from every angle.

The first reviewable result should be an actual GLB displayed in the app, not a 2D concept passed off as 3D. Keep the current deployed models until a replacement meets that bar.

## Rig and behavior

Use a quadruped skeleton with spine, neck/head, jaw, four articulated legs/paws, ears and tail. Weight painting must support deformation rather than moving disconnected lumps. Include eyelid and mouth/tongue controls or suitable morph targets.

Required MVP clips: idle/breathe, walk, sit, lie/sleep, eat, happy/pet, play bow and tail wag. Verify paws stay planted during idle and that joints/skin deform correctly. Crossfade actions and return to the correct persistent pose; sleep must not become idle at the end of an action. Continue to use the existing per-dog needs/trust/history state.

Meshy's web app documents Quadruped Dog rigging and a walking animation. That does not supply every Tamagotchi behavior automatically. Its public rigging API currently documents humanoids, so do not assume API and web-app capabilities are interchangeable. Additional clips, facial controls and weight cleanup may need Blender or another canine animation workflow.

## Mobile delivery targets

Initial targets, to be checked against the actual asset rather than treated as proof of quality:

- About 30–80k triangles per visible dog; start with one material atlas where practical.
- One 1K–2K base-color texture, with roughness/normal maps only when they make a visible difference.
- Aim for ≤5MB per delivered dog; load the selected dog on demand, not all five at startup.
- Use a self-contained GLB. If Draco/Meshopt or KTX2 compression is introduced, configure and test the corresponding decoder; the current loader does not configure these.
- Measure actual transferred bytes, first visible frame and interaction frame time on a phone. Triangle counts alone do not prove faster loading or pleasing anatomy.

## Current app integration gaps

`RiggedAvatar.tsx` loads GLB/glTF and selects animations by clip name. It is a useful starting point, not a completed replacement for the procedural stage.

Before activating a real asset:

- Repair camera framing for actual body bounds and viewport aspect ratios; current camera position is hardcoded.
- Restore visible fallback on load failure; the existing error message promises the drawn dog, but this component does not mount it.
- Give local uploads durable storage. RecordPanel currently persists a temporary blob URL, which cannot survive a browser restart. Prefer bundled/versioned asset URLs for these five shipped dogs.
- Provide touch hit testing and care/game feedback for the imported mesh; these currently live in DogAvatar3D and are absent from RiggedAvatar.
- Ensure clip timing/callbacks are stable, actions crossfade, missing clips are handled visibly, and animation does not reset on state writes.
- Verify GLB resource cleanup, context failure and repeated dog switching.
- Correct RecordPanel's stale text saying attached models are not rendered.

Do not claim model import alone completes the Dog-Tamagotchi experience.

## Remaining dogs

After the first asset meets the quality bar, apply the same pipeline:

- Paolo: owner-provided cream pug photos; broad dark jowls, black folded ears and heavy brow folds.
- Expo: supplied Bangkaew photos; dark sable mask/saddle, white blaze and lion ruff, plumed curled tail.
- Mali: shorter, broader female Bangkaew sister, as described by the owner. Individual markings need a separate reference if exact photographic identity is required.
- Hachiku: cream Akita inspired by historical Hachikō photographs, with a sturdy body and thick curled tail.

Keep stable profile IDs so replacing art does not erase care or training history.

## Access and references

No Meshy/Tripo/Fal/Replicate/Hugging Face generation credential was exposed in the process environment at inspection. No 3D-generation connector was found in available tool/plugin discovery. Browser access timed out; account/login availability was not established. No 3D asset was generated or purchased during this assessment.

- [Meshy web-app rigging](https://docs.meshy.ai/en/webapp/guides/3d-model/rigging)
- [Meshy public rigging API](https://docs.meshy.ai/en/api/rigging)
- [Meshy pricing and export terms](https://www.meshy.ai/pricing/)
