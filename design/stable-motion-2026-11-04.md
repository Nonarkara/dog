# Stable faces and calmer motion

User report: movements rush; faces stretch and spring back. Baseline41bcb5b.
Preserve the authored illustrations, column layout, palettes and all care/training
behavior. Change only pose deformation, movement timing and matching hit masks.

## Reproduced causes

- Global eight-anchor pose registration changed Paolo's eye spacing to0.9065x
  during stand→feed and1.0814x during stand→bow; independent numeric review also
  found Oreo's local head height compressed to0.8712x.
- The motion shader inflated running heads40%, then removed that inflation on
  returning to idle. Run mode also added a sudden30% mesh-scale multiplier.
- Signed horizontal-scale easing could narrow a dog to2.68% width during a
  reversal without an authored pivot. Oreo's old zoom orbit took roughly1second.
- The extra wide blink band displaced fur below both eyes using one eye's height.

## Repair

Faces now receive one rigid eye-center translation through pose changes; body
registration is bounded and fades through the neck. Gait interpolation affects
only the lower body. Authored head size persists through every gait; the CPU
pointer inverse matches the rendering. Eye-only blinking remains, without the
wide cheek displacement. Reversal progress chooses turn views and never scales
the dog through zero width. Default park travel is walking pace; zoom orbit,
approach cadence and turn actions are calmer. Touch feedback timing is preserved.

## Verification

`test-face-rigidity.cjs` compiles the real old and new vertex shaders into WebGL2
transform feedback.25 dog/pose comparisons reproduce >7% old distortion, while
new eye separation remains1.0 within GPU float tolerance. A separate gait probe
checks that leg interpolation leaves the face unchanged. Old source stays in
memory; no temporary edits of shared production files are used for a red test.

`test-motion-tempo.cjs` records actual model matrices with optional motion art
unavailable:211 rendered samples keep aspect1.0, with two reversals in3.5seconds.
The park regression asserts walking frames, directional views, distance-linked
strides, proper stopping and a lower default-speed cap. Real five-lesson capture,
persistence, care interruption, quiet mode and cleanup remain exercised.

Independent motion reviewer inspected actual pet/feed transition and running
frames. Before/after strips show coherent faces without the elongated transitional
head/neck. These checks bound this deformation bug; they do not claim a full3D
skeleton or identical face drawings across independently authored poses.
