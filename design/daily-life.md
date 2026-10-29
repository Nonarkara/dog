# A dog with a day of its own

Owner request: reverse engineer the Tamagotchi care loop into visible canine behaviour. Reference: [Bandai Original manual](https://www.bandai.com/amfile/file/download/file/3642/product/1309530/), especially sleep/light, droppings/cleanup, play, medicine and attention. This is a behaviour-level reconstruction from published instructions, not recovered proprietary code. Toilet breaks, sniffing and canine body language are this game's adaptation.

Invariant: one persisted pet state owns needs and elapsed time; animation expresses it and cannot create duplicate care rewards or mess. Existing training, records, Commons, palettes, toys and imported models remain.

Implementation plan:
1. Accumulate bladder, digestion, boredom and prolonged low fullness across small ticks and reloads. Preserve old saves with defaults. Walk relieves bladder; clean removes puddles and droppings; company/play reduce boredom. Fix the existing waste timer that never matured during minute updates.
2. Give sleep a natural waking condition. Use existing authored rest poses for sick/tired dogs and a brief seated toilet event. Express sickness with low posture and a restrained shiver, without painting anything over the approved eyes.
3. Add bounded wandering/sniffing/rest/stretch sequences when no care, training or game owns the dog. Show a compact contextual need/action beside the dog, within the existing stage. No additional header/footer height; preserve the stage and all controls.
4. Test small-tick/offline progression, care outcomes, independent dog state, animation priorities and cleanup. Capture phone/tablet/desktop/working viewport, run independent review, then commit/push/deploy and verify live.

Game pacing is authored, not veterinary physiology: bladder fills in about 35 awake minutes, digestion produces waste about every 90 fed awake minutes, boredom fills over about 30 minutes without engagement. Offline catch-up is capped at 72 hours; stage mess is bounded. Sleep slows toilet accumulation. No death, paid resource, notification or real-animal diagnosis is introduced.


## Timing and visual implementation

Live ticks and offline catch-up use the same bounded 10-second body steps (maximum 72 hours). This lets sleep/waking, new mess and its hygiene consequences change rates within an absence. Care/cue/observation mutations first settle elapsed body time; repeated petting cannot freeze the bladder. Behaviour-strength decay runs once after body stepping. A local Mac benchmark of the capped 72-hour body pass took about 54 ms for a fresh state; it is not a phone performance claim.

A restored nap wakes after at least an hour with energy at least 65, outside 22:00–06:00. The authored night schedule and energy rates remain game rules. Cleaning can happen quietly without waking the dog. Other care can wake it through the existing interruption model.

Automatic attention stays in the Care sentence, document title and contextual stage action. It no longer creates a second bottom note that hides the puddle it asks you to clean. User-action notes remain. Sleeping/sick states override play; new live toilet events cancel games before posing so no hidden completion timer survives.

Five new unwell drawings have low heads, closed mouths and heavy eyes. Existing happy-eye artwork remains untouched. Source: `design/reference/household-sick.png`, generated as a reference-preserving expression variant with the built-in image tool; crop manifest: `scripts/illustrated/build-art.cjs`. The five WebPs add 172,960 bytes across the household. Nine drawings load only for the selected illustrated dog. No video, new runtime library or subscription is used.

## Test design

`src/domain/selftest.ts` checks 128 invariants, including small-tick digestion, bladder/boredom, quiet cleaning, old-save defaults, independent dog state, repeated care versus idle time, and offline versus live hygiene and night sleep/waking. The previous model was run in an isolated temporary bundle: 180 minute ticks produced no droppings; the new waste regression rejects that behaviour.

`scripts/test-daily-life.cjs` exercises autonomous wandering without care rewards, boredom/play, preventing accidents with a walk, a live toilet event with an actually hit-testable puddle, cleanup/reload, sickness/recovery, automatic nap/waking, quiet cleaning and per-dog isolation. Reduced motion suppresses travel. Interaction suites pin daytime so night scheduling is tested deliberately rather than causing time-of-day flakes.

Final screenshots, geometry measurements, review closure and deployment evidence are recorded in the daily-life release receipt.
