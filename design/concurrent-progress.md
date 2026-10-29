# Progress across tabs

Goal: care, games, practice, real training and owner records survive simultaneous tabs and dog switching. Preserve existing content, clinical records, artwork, controls and old-save migration. A background timer must never replace a newer action with a cached dog.

Plan:
1. Reproduce lost progress in two shared-storage pages. A new regression must reject the old runtime.
2. Introduce one versioned atomic save envelope for profiles and pet states. Migrate legacy keys once, preserving them as recovery evidence. Old running builds cannot overwrite the new canonical key. Serialize all new writers with a single IndexedDB readwrite transaction used as a mutex; each synchronous reducer reads the latest envelope inside that transaction. Failure to acquire/write must be visible, with no success claim or unsafe fallback.
3. Convert care, time, games, Coach, Practice and Record to functional mutations against that latest state. Cross-tab events refresh views without writing snapshots back; active dog selection stays local to each tab. Pending operations retain their original dog identity.
4. Verify simultaneous same/different-dog care, passive ticks, real/practice training, owner-record changes, dog switching, legacy migration, old-version writes and failed storage. Run relevant existing suites using the canonical save format, without masking migration failures.
5. Independent source/runtime review; commit, push, deploy and repeat the shared-tab regression live. Stop and repair any data-loss or false-success finding.

Sources: [IndexedDB transaction scheduling](https://www.w3.org/TR/IndexedDB/) serializes overlapping readwrite scopes. The database stores no dog data; it holds the brief mutex while one atomic LocalStorage envelope is read and written. The reducer contains no asynchronous work. The persisted envelope, not a React render or another tab's cached snapshot, is authoritative. No cross-device synchronization is implied.

## Implementation

`canine_os_save_v3` contains profiles, pet states and a revision. One synchronous `setItem` commits the entire envelope. Every action reads it under the same `writer` readwrite scope; pure normalizers reuse that single parse, including owner photos. The IndexedDB transaction is a mutex, not the progress database. Completion confirms the LocalStorage write, so an IndexedDB abort after that write cannot turn a committed action into a retryable failure. A queued lock times out without executing its reducer late.

React holds views only. Storage events refresh those views without saving them back. Completing a mutation re-reads the latest view rather than rendering an earlier returned snapshot. Dog IDs are captured when an action starts; selecting another dog cannot retarget a queued action. Real/practice logs, observations, cues, schedules, games, vaccine additions, photos and model references use fresh-state reducers. Profile need mirrors and care timestamps update in the same atomic save. Overlapping attention intervals for one dog are counted once.

Old keys are read only until the first successful migration. They are left intact as recovery evidence; subsequent old-version writes are isolated from the new save, and a visible message asks that older tab to reload. These snapshots are not merged automatically because doing so could reintroduce stale-state overwrites. Migration requires enough browser storage for the new envelope; denied storage or insufficient capacity fails visibly without deleting old records. It does not promise unlimited photo storage or cross-device syncing.

Malformed canonical/legacy data is refused before writing instead of silently replacing valid dogs with defaults. Save failures use the existing feedback row below the animal. Owner forms retain their fields for retry. Care buttons animate after commit; forms confirm a saved record only after successful persistence. Direct touch can still give immediate visual feedback, but a failed save never awards persisted points.

## Regression evidence

The previous build reproduced trust 64 after Pet falling back to approximately 60 after an older passive tab tick, with the active tab closed. `scripts/test-concurrent-progress.cjs` retains that negative mode and now verifies stale-event delivery, repeated simultaneous care, independent dog selection, care plus real/rehearsal logging, care plus vaccine recording, legacy migration, old-version isolation and failed-write byte preservation.

Independent review found and reproduced four async edge cases: duplicate Practice trials, duplicate vaccine doses, duplicate enrollment IDs, and a malformed legacy entry causing the loader to discard valid progress. Saving guards, UUID identities and strict normalization fix them. `scripts/test-pending-saves.cjs` preserves the held-mutex repros, queued care across dog selection, malformed/canonical-damage refusal and quota-failure checks. All findings were independently rechecked after repair.

Existing browser fixtures now read/write the canonical envelope directly. Legacy migration remains an explicit first-load test; no storage API interception disguises the new format. Asynchronous assertions wait for the actual saved outcome rather than assuming a click has already committed. The complete domain suite remains 153 checks; broader final Coach/method and benchmark audits remain separate work.
