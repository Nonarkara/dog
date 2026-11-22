# Release reconciliation — 22 November 2026

The working repository is `/Users/nonarkara/Projects/dog`. The removed
`dog-visual-release` worktree is not the project directory.

## Pending work

Reviewed all five edits left on main at `0babcfe`. The three browser tests
now explicitly start with the record folded, because their actions open it.
They retain the real save, loading and record assertions.

The pending Coach fix hid duplicate title text when four log-mode controls
were present. It still overflowed the 329px tablet column and enlarged text.
The mode group now wraps internally while Help remains beside it. At
390/1024/1440px the header measures 27/48/27px, and 59px with enlarged text.
No care, training or park actions were removed. The illustrated dog, handwriting
and per-dog colours remain unchanged.

## Integration check

No open GitHub PRs. PRs 2–6 are merged. The old MiniMax rescue snapshot's
motion and calls were reconciled in `09c0d8d`; its unsafe reminder-repeat
snapshot must not replace the later reminder implementation. The spatial
snapshot predates the current explicit three-route gate. The ink/fur branch
remains the intentionally excluded experiment specified in STYLE.md.

## Verification

- TypeScript clean, 401/401 domain checks, production build successful.
- Pending-save guards pass, including duplicate actions, queued dog selection,
  malformed migration, damaged canonical data and quota failure.
- Delayed App/Record loading passes. Record provenance/export/print and owner
  edits survive reload at four viewports.
- New `scripts/test-coach-header.cjs` measures all mode buttons and Help,
  hit-tests their centres, exercises Help, doubles header text, and proves the
  original nowrap header fails the same width budget.
- Independent agent reviewed rendered 390/1024/1440px screenshots and enlarged
  text. No blocker in the changed header. Physical phone verification remains open.

The first local sweep hit a title-read timeout at 278px while other browser
checks ran. Release verification uses a frozen production build and a separate
sweep. Browser evidence is under `/tmp/dog-coach-header/` for this session.

Final sweep passed with 183 fresh measurements across three routes and 61
widths. Added the Coach container's actual viewport neighbours
1297/1298/1299 to `scripts/breakpoints.mjs`; the first complete sweep correctly
refused the unswept new cliff. No gate budget was relaxed. Email-auth, care,
park-room and push suites also pass, including SQLite schedules and service
worker notification routing. Actual email delivery and physical-phone push
remain outside these automated checks.
