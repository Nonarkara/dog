# Reliability and feel release

Baseline: deployed `35ff75c`. The separate bedtime and room-economy edits in
the project checkout are outside this release. Start work from the deployed
commit to avoid mixing those edits into an unrelated build.

## Release checks

From a clean checkout, run `npm ci`, `npm run build`,
`npx playwright install chromium`, and
`DOG_BUNDLED_CHROMIUM=1 npm run test:release-smoke`.
Linux CI installs the browser's system dependencies too. The smoke runner
owns its two local servers and refuses to use an occupied port. Override the
ports with `DOG_SMOKE_PREVIEW_PORT` and `DOG_SMOKE_DEV_PORT` if needed.

The production preview checks delayed entry and Record loading, an unavailable
optional pose, and all five dogs fitting at the park entrance. The dev
server checks the actual cloud client with controlled account responses.
Its fixtures force a write between inspecting the local save and acquiring
the restore lock. That newer local progress must survive. A second check
counts zero cloud requests for an unchanged, acknowledged revision. These
checks use test data and do not establish production write volume.

Before deploying, run the full spatial gate and relevant browser tests,
then verify live version and asset bytes. No database migration is required.
The rollback target is the previous verified deployment, `35ff75c`.

## Care layout comparison

Use `/?mode=play&care=compact` for the prototype and `/?mode=play` for
the current layout. Both keep the same column grid: dog, current need, then
controls. The preview groups secondary controls under **Care tools**. The
existing on-stage current action and touch-to-pet path remain available.
Opening the tools focuses the first available action. Escape closes them
and restores focus.

Independent desktop, tablet and phone emulation confirmed the pet and feed
flows and keyboard focus. The closed preview reduces visible choices. The
expanded preview adds a short row, and the existing enlarged-text collisions
in the Care header and stage captions still need work. Keep the prototype
optional until first-time players can complete the full care and training
walkthrough without help.

## Evidence still needed

- A physical phone run for motion, first-touch latency, and reminder delivery.
- Real signed-in device-to-device restore and account/privacy workflow using
  dedicated test accounts. Email recovery is still gated.
- Measured production write and park traffic before stating capacity.
- Separate review of bedtime scheduling and paid rooms.

## Load probe

A cache-disabled Chrome comparison on the same Mac at 390×844 recorded
842 kB at the first visible dog on the baseline and 700 kB on the candidate.
The candidate showed Pet button feedback in 53 ms in that run. This is one
controlled sample, not a device latency guarantee. Neither build fetched
Expo's optional 3D files in the sampled home or park journeys. Park transfer
at the first visible dogs varied with in-flight atlas loads, so the run does
not establish a park speedup.

## Bedtime and room release

Deploy from a clean checkout of the current `origin/main` after the
**Companion checks** workflow has succeeded for that SHA. `npm run deploy`
now enforces this, reinstalls locked dependencies, and builds before it
uploads. Check the live asset bytes and record the Worker version after
deploying. Keep a rollback version that understands saved bedtimes and rooms.

The release smoke suite exercises the actual bedtime and wake-time
controls with both edits queued behind the browser write lock. It checks
room cancellation, purchase, returning to an owned room, insufficient
funds, and persistence. The remaining account portability and reminder
checks require dedicated signed-in devices. The wake sound is an in-app
setting, separate from push delivery.
