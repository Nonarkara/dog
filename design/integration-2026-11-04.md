# 4 November integration plan and reconciliation

Scope: reconcile PR#1 and outstanding branches, preserve authored 2D and all earned care/auth/training behavior, repair demonstrated care and motion gaps, deploy and verify.

## Baseline and preserved work

- Baseline main dab0ee1: park cel depth and cue wordbook additions retained.
- Both worktrees clean before starting; no active stash. No branch deleted.
- PR#1 d7d6b04 is based on old b814df7. Port reviewed changes rather than replace newer account safety, CaptureGame, customization, photos or quiet view.
- Local experiment/3d-ink-fur is explicitly parked by owner preference; preserve branch and images without merging.
- Eight unreachable historical stash objects inspected by independent reviewer; features superseded by present practice/log and park watch/chase/ambient. No GC or deletion.

## Targeted changes

- App/CarePanel: one-tap Feed; separate labeled Pantry access; visible six-meter readout during occasional pantry tasks. Preserve actual park walking and care command access. Avoid PR's overlay over the dog.
- App/pet: truthful absence recap from original saved timestamp; safe hygiene floor which cannot heal existing dirt; explicit actual outing completion/reward.
- PracticeDeck: shared small wordbook disclosure outside advanced-only branch; preserve all training and real-log controls.
- App/CSS: desktop split for ordinary short laptop windows with measured height; preserve phone hero and compact care. No global typography rewrite.
- IllustratedDog/IllustratedPark: demonstrated missing directional in-betweens and independent park blink; no extra assets, renderer replacements or draw calls.
- Domain: hunger call matches visible hunger advice; daily wish pays promised coins; bounded new mess production; park outings fulfill the promised wish and care record only once.
- Cloud/worker: causal base revision to reject divergent same-counter saves; explicit expired/reconnect states rather than silent skipped uploads.

## Verification

- Domain, typecheck, build; actual SQLite/managed-signature auth tests.
- Browser first meal, pantry/meter visibility, return recap, real park outing and repeat prevention; wordbook teach/retain path.
- Rendered motion and retained-canvas continuity, park gait, phone/tablet/laptop/desktop fit; narrow park control affordances.
- Independent regression review, PR disposition record, commit/push/deploy and fresh live browser proof.

## Reviewed PR disposition

PR #1 is based on b814df7. Ported: direct meals, explicit Pantry, meter feedback
beside the readout, absence recap, safe hygiene floor/mess cap, ordinary-laptop
layout. Current CaptureGame supersedes the old first-Sit Mark gating; custom
loading, naming and delta machinery were already present or superseded.
Rejected: sheets covering the dog, home-only Walk, blanket >=768px/16px restyle,
a hygiene floor that magically cleaned existing dirt, and unsolicited whines.
The final integration closes the stale PR with links to the reviewed replacement.

## Final design brief and evidence

Named grid: column. Reader: someone caring for a companion while working.
Entry: the dog. Exit: compact need/response readout and its care actions.
Room around the body permits touch and authored poses; expanded records earn
scroll through actual information. No extra saturated accent or new art asset.
Dense controls retain the established workspace32/34px rule under the owner's
latest instruction; standalone tasks/dialogs use larger targets where possible.

Independent reviewer motion_nov4: phone/tablet/laptop/desktop visibility and
150% text pass. Short-phone Pantry hero335.3px meets the333.5px half-screen
budget. Restoring the duplicated Careheader, three-column meters and firsttip
shrinks it to274.3px and fails the samebudget. No hidden dog or lost controls.
Main idle and Come both use2drawcalls/18,480triangles; activity changes30→60fps.
ManualPet interruptsCome within150ms, hiddenframesfreeze, reducedmotion6fps.

Independent code reviewer pr_reconciliation: closed stale outingnote and
cross-dog reward-chip issues; verified account/seed gates, persisted causal
savebase, realSQLite conflicting writes and rejection of stale legacy clients.
No cloud dog is replaced in the background after an offline startup.

## Tamagotchi mechanism check

The official Bandai manuals describe recurring needs, a call forattention,
care/play, rest and growth shaped bycare:
https://tamagotchi-official.com/manual/toy/original/
https://tamagotchi-official.com/us/series/connection/howto/

Design inference: engagement benefits from a readable need→action→visible
relief→remembered relationship loop. This release makes the firstmeal direct,
returnrecaps intelligible, actualoutings fulfill the dailywish, and spokenword
progress discoverable. No claim of measuredretention or scientificallyvalidated
individualdog psychology. No new scarcity timer or penalty system.

## Scanner adjudication and remaining limits

Ran the local Non-Slop scanner over147files. It is not clean and is not used as
proof of pixels. Reviewed hits include: Sparkles denotes coat hygiene, not AI;
`bounce` is a dog personality/amplitude value, not UI easing; heavy reference
renders are development evidence, while motion atlases deliberately pack112poses
and load separately; markup-like strings inside unit tests are not rendered HTML.
Fourteen wording/review hits include validation-test prose and existing record
messages. The legacy ten-size CSS scale and multilingual consent markup remain
explicit follow-up debt; this release preserves the intentional handwriting and
palettes rather than silently redesigning them to satisfy source heuristics.
Rendered fit, contrast from the previous palette pass, explicit target rules and
independent review qualify the actual changes. This is a pilot, not a blanket
production/security/accessibility certification.

Clerk remains disabled until actual email delivery/recovery verification. No
phone battery/cheap-device GPU benchmark or real-person retention study ran.
Cloud close delivery is still best effort; local backup and visible sync states
explain this boundary. No credentials, production owner data or old branches
were deleted or exposed.
