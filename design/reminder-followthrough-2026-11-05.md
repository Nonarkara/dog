# Finish the companion's calls

Baseline `99231e4`. The first recovery release deliberately deferred MiniMax's
unfinished repeat-push migration. This release replaces that deferral with a
reviewed implementation; do not reapply `0006_push_repeat.sql` from the rescue
branch. The additive migration here is `0006_push_windows.sql`.

The job is to leave a companion, receive a gentle invitation and return to the
same dog. The existing column grid remains: dog → compact care → next action.
The compact Care console keeps an on/off action; its existing details dialog
holds the optional follow-up and timing explanation. Pantry hides this unrelated
instrument so the dog retains half the short phone screen. No artwork, poses,
training, records, palettes or handwriting are replaced.

## Behavior and promises

- One call per absence remains the default. Owners may choose one follow-up in
  care details. The first prediction is at least two hours away; a follow-up is
  no sooner than ninety minutes after the first accepted delivery. There is no
  third call. A missed first window may promote the still-valid follow-up once.
- The device computes local 07:00–22:00 windows, rounding to the fifteen-minute
  cron before checking the boundary. Calendar operations handle daylight-saving
  changes. Only timestamps, a monotonic ordering counter and the subscription
  address go to the server; no location, timezone, dog name or needs.
- Server expiry and TTL bound retries/queued delivery. This is a scheduled
  invitation, not an exact alarm. Browser delivery may lag. Every received push
  remains visible; late or foreground cards are silent. Silently dropping a
  received push is not a portable solution: [WebKit requires visible notices](https://webkit.org/blog/12945/meet-web-push/).
- The note is a friendly invitation, not a claim about the dog's current health
  after hours away. A notification stores its original Play/Own return mode and
  opens or focuses a matching tab. It does not hijack the other mode or route an
  owned companion back through the generic landing page.
- Permission alone is not setup success: a failed server registration rolls back
  a newly created browser subscription. Turn off stays accessible after success,
  errors and dog switches. Browser unsubscription stops delivery even if remote
  cleanup is unavailable; failed unsubscription is reported honestly.

## Ordering, privacy and bounds

The small local IndexedDB store `tdc-reminder-state` allocates revisions atomically
across tabs and clock changes. A hidden-page intent reserves its counter before
asking the service worker whether another window is visible. Newer returns get
higher revisions; stale requests are rejected, never automatically replayed.
Endpoint discovery also rechecks the current visibility before acting.

The server compares the entire schedule before consuming a provider response.
Disabling removes the raw endpoint and leaves a SHA-256 digest/revision fence for
up to thirty days, capped at 5,000 entries. Registration tests that fence inside
its INSERT, not only with an earlier SELECT. This prevents an in-flight old POST
restoring a disabled address. A newer explicit re-enable still wins. Clearing a
call removes local personal text, closes displayed cards and clears the badge;
the last scheduled mode remains available for a late generic notice.

Sender batches use 32 rows, reserving query headroom for park cleanup and account
retries in the same cron. Actual SQLite capacity tests drain forty rows as32+8,
with at most35/11 sender queries. This is a bounded job, not a user-capacity claim.
See the [D1 invocation limit](https://developers.cloudflare.com/d1/platform/limits/)
and [Workers subrequest limits](https://developers.cloudflare.com/workers/platform/limits/).

Existing legacy rows retain their original one-shot Bangkok policy and expire
at that day's boundary. Legacy requests cannot overwrite a versioned schedule.
The additive schema must be applied before deploying the new worker; it is
compatible with the old worker during that short rollout.

## Evidence

`npm run test:push` runs three isolated processes: actual SQLite worker/API tests,
local-time policy tests and the actual service-worker script in a notification
fixture. No notification leaves these tests. Cases include exact/reordered
requests, delete/register interleavings, expiry, one/two calls, TTL, transient
failures, revocation retention/cap, forty due rows, five timezones, DST, visible
fallbacks, corrupted caches, URL allowlisting and correct Own/Play return tabs.

`scripts/test-push-client.cjs` uses real browser service workers and IndexedDB,
with permission/subscription/network fixtures. It covers HTTP503 setup failure,
compact Turn off, the default/optional choice, visible-window checks, twenty-four
unique revisions across two tabs, a held old visibility reply after a newer
return, refusal to unsubscribe, and successful offline cleanup. DOG_UI_ONLY=1
runs its public-site UI subset without source imports. No real OS permission
prompt, email or push is triggered.

Falsifiers ran against isolated/in-memory sources: baseline enable reported true
on HTTP503; removing the atomic revocation INSERT guard restored a deleted raw
address despite an API409. Both fail the corresponding current invariants.

Independent review approved backend ordering and 390/1024/1440 compact/detail
pixels at normal and150% text. The subscribed320px Pantry hero measured356.7px,
above its333.5px minimum, without horizontal overflow. Existing domain, care,
auth, cloud-conflict, integrated care/park/word-book, retained-canvas and enlarged
console gates also pass. This does not certify OS delivery on physical iPhones,
phone battery performance or Clerk email activation; those remain separate.
