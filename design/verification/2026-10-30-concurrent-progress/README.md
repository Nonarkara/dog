# Live progress protection

Implementation `8ae460a`; Cloudflare version `908fa0e8-9c26-42d2-84c1-6f56bb310c87`. Production HTML at `https://dog.nonarkara.org/` references the expected `index-tbHe8I8U.js`. Both new suites passed against that live build in isolated synthetic browser contexts. No owner browser data was altered by the tests.

## Before and after

The old build saved trust 64 after Pet. Closing that active tab and allowing a stale second tab to tick replaced it with 59.999537. The new build preserves 63.999537 after the same elapsed time. The fractional difference is ordinary time decay. Storage update events are deliberately withheld from the stale tab, so the fix depends on fresh-state mutation, not notification timing. Baseline and live reports are saved here.

`scripts/test-concurrent-progress.cjs` passed live: repeated simultaneous care in two tabs, different dogs without selection crossover, care plus a real training log, rehearsal separation, care plus vaccine recording, first-load legacy migration retaining owner notes and real reps, isolation from an old namespace writer, and forced quota failure preserving canonical bytes. The shared-tab report is synthetic test data, not a real training session or clinical record.

`scripts/test-pending-saves.cjs` passed live with deliberately held writer transactions: one Practice trial is counted once, dose submission creates one record, enrollment creates one UUID profile, and queued Expo/Mali care remains with the original IDs through selection changes. It also refuses malformed legacy and damaged canonical saves without replacing them, and reports a forced quota failure without changing saved bytes. Space cannot reset a pending Practice result.

## Review and regression coverage

Independent review reproduced four P2 issues in the first async implementation: duplicate trial, duplicate dose, duplicate enrollment ID and malformed legacy data dropping valid progress. Saving guards, UUIDs and strict normalization fixed all four; independent held-lock and corruption probes rechecked them. The reviewer preserved its executable script, now retained and extended as `scripts/test-pending-saves.cjs`. No confirmed review finding remains open in this change.

TypeScript, production build and 153 domain checks passed. Relevant existing local suites passed: four-viewport/five-avatar Catch/migration/isolation, daily life, tricks/Find the Treat, four-viewport calm/help, interrupted-rest recovery, 24-state Care fit and four-viewport feedback geometry. These tests now use the actual canonical envelope directly. Added waits observe the saved result rather than treating a dispatched async click as an already committed write.

Test harness corrections were recorded rather than counted as successful runs: the stale-tab negative control closes its active page so that page's timer cannot mask the stale writer; the real/rehearsal walkthrough uses Next rep; the dose form supplies its required due date. All final declared live cases passed after those corrections.

Existing user IAB tabs were inventoried, but binding them for reload returned `browser.user is unavailable`, including the documented alternative handle API. No user-tab refresh is claimed. Reloading older open tabs is required to use the new format; writes from an old build cannot overwrite the migrated canonical save. Browser storage must be available and have room for migration; old keys are retained for recovery. This is same-browser persistence, not cross-device synchronization.

See `design/concurrent-progress.md` for the storage contract and `docs/benchmark-status.md` for remaining benchmark work.
