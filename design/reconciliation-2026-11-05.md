# November 5 integration review

Baseline: `35cbf0a` (PR #3). GLM's `dab0ee1` report predates the one-tap Feed and
rigid-face releases. It is historical evidence, not today's implementation spec.
PR #1 is closed after selective integration; #2 and #3 are merged. The unrelated
`experiment/3d-ink-fur` branch remains parked.

MiniMax's eleven unfinished files were preserved in pushed rescue commit
`8474158` on `codex/minimax-nov5-rescue`, using a separate Git index. The original
primary worktree was not staged or reset during review. The release selectively
integrates and corrects that work; the rescue branch is not a release candidate.

## Motion and interface

Reader: a returning player who wants to notice and answer their dog. Column grid:
dog first, compact care guidance and action at the scene exit. The scene keeps its
space for touch and authored poses; the instrument panels fit their contents.
Handwriting, individual palettes, records, training and the park remain intact.

The unfinished gait mirrored turn drawings that already contained a turn and
reset roughly 90% of its position in one frame when walking stopped. Its floor
bounds also depended on the previous frame's variable fit. Corrected motion uses
one artwork envelope, distance-linked strides, a slower home pace, unmirrored
turn drawings, and stops where touched. A narrow home offers sniffing when there
is no safe room for an ambient stride. Explicit toys remain available. The prior
rigid-face shaders and 260/420 ms pose transitions are preserved.

MiniMax's scratch-vector reuse and active/quiet frame scheduling are retained.
This reduces allocation; it is not evidence of a measured GC improvement on a
cheap phone. Active motion targets 60 fps, quiet states 30, sleep 12 and reduced
motion 6; hidden pages do not render.

Calls use a steady, compact actionable cue behind the dog. A restored call or
switching dogs stays silent. A new foreground call may use two notes only if a
prior deliberate interaction has already unlocked audio. No unsolicited
vibration or pulsing chrome. Optional Coach/Record prefetch failure is contained;
data-saving and hidden contexts skip it.

Enlarged text exposed a clipped training caption and crowded care readings at
1024 px. Captions now wrap; meter column thresholds use the container's text
size. Independent review passed at 390/1024/1440, normal and 150% text, with an
original-CSS falsifier failing on the clipped caption. Hardware testing remains
separate from browser emulation.

## Reminders and persistence

Do not deploy MiniMax's repeated-push migration in this release. The second call
could land after 22:00 despite the quiet-hours promise, and an uninstalled column
broke subscription changes. Keep one push per absence. The corrected one-shot
sender conditionally consumes only the schedule it fetched: an old provider
response cannot clear a newer absence or delete a re-enabled subscription.
Actual SQLite tests reproduce the old race and pass the corrected sender.
Already dispatched pushes cannot be recalled.

Clerk remains prepared and disabled pending owner activation. Google/LINE and
existing companion save/conflict protections are preserved; this session does
not claim real email delivery, password recovery, physical iPhone performance or
an authenticated park round trip.

## Verification and final contact pass

The high-five control was still positioned in the original screen coordinates
after the dog moved or mirrored. It now projects the same signed scale and
translation as the drawing. Actual GPU/DOM falsifier: 271.98 px versus the expected
636.82 px before the fix; independent corrected test differed by 0.0032 px and
completed the response on tap. The moon's accessible name now describes its real
bedtime-options action; Tuck in and wake settings remain available, with the
first-play guide preserved.

Passed locally on the final product source:

- TypeScript, production build and Wrangler dry run; 294/294 domain checks;
  care/call/audio, authentication and actual SQLite push suites.
- Actual GPU face rigidity and gait checks: 1,431 draw samples, 406 stride checks,
  1.231-second median stride, 59.2 fps on this Mac. This is a development-machine
  measurement, not a universal device claim. Phone Zoomies includes movement and
  multiple running poses at 320/390 px.
- `test-integration-nov4.cjs`: one-tap meal, Pantry with six meters and half-screen
  hero, modal shortcuts, word pairing/persistence, actual outing rewards once,
  return recap and five viewports.
- `test-cloud-reliability.cjs`, `test-park-locomotion.cjs`,
  `test-visual-capture.cjs`, `test-action-continuity.cjs`, `test-call-beep.cjs`,
  `test-enlarged-console.cjs`, `test-high-five-contact.cjs`.
- Updated legacy `test-illustrated.cjs`: current 30/60 frame budgets, projected
  torso touch, actual Clean action and bedtime-options/Tuck flow, sleep,
  simulated hidden-page pause and reduced-motion budget. The old script's fixed
  screen click, immediate-sleep assumption and always-30-fps ceiling were stale.
- `npm audit --omit=dev`: zero known production dependency vulnerabilities at
  audit time. This does not certify every application/security boundary.

Independent reviewers inspected the motion/contact code and 320/390/1024/1440
pixels, plus 390/1024/1440 at 150% text. Original turn, contact and caption defects
have executable red evidence without rewriting the integration source to an old
version. Browser commands use the shared Playwright runtime via NODE_PATH and
DOG_URL pointing to an isolated dev server; the browser tests do not use real
account credentials or trigger production email.
