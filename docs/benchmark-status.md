# Dog-Tamagotchi benchmark — current evidence

Objective: a 2026 version of an interactive, fun Tamagotchi featuring the owner's dogs and real training methods. This ledger preserves that scope; a passing layout or unit suite alone does not establish completion.

30 October continuation: the previous turn added live five-viewport chooser evidence. This turn repairs interrupted-rest recovery. The overall goal remains active.

| Requirement | Current evidence | Remaining work |
|---|---|---|
| Recognizable, cute illustrated Expo, Mali, Oreo, Paolo and Hachiku | Approved artwork and palettes; `design/illustrated-animation.md`, `design/personality-palettes.md`; five-dog browser suite | Retain likeness and approved eyes during new motion work. |
| Responsive movement and direct interaction | Pet, feed, walk, groom, tricks, bows, boops and zoomies; `design/play-and-personality.md`; rendered interaction suites | Recheck complete play/care/training sequence together after foundational fixes. |
| Fun games with meaningful outcomes | Five-round Catch and three-round Find the Treat, deterministic input, bounded rewards, cancellation on dog change | End-to-end replay across tired/sick/awake states, including training transitions. |
| A persistent day of its own | Toilet, cleanup, boredom, sickness, wandering, natural sleep/waking; `design/daily-life.md` | Multi-tab progress is unsafe: App saves cached snapshots; passive timers can overwrite another tab's newer care. Needs serialized fresh-state mutations plus synchronization, with a two-tab regression. |
| Recoverable care consequences | Repeated-wake domain and browser regressions; quiet rest permits sleep and energy recovery; live proof in `design/verification/2026-10-30-sleep-recovery/` | Preserve recovery while repairing concurrent saves. |
| Real reward-based training | Coach measures marker delay, eight behaviors, cue associations, shaping, practice versus real-session logs | Legacy care still rewards `scold` and recommends scolding at low discipline. Replace punitive guidance/action with humane management and reward-based alternatives; keep controls and saves compatible. Audit schedule/feedback wording against primary guidance. |
| Dog visible throughout operation | Dedicated message/game dock; chooser occupies Care; fixed compact Care; five viewport geometry suites | Preserve this while revising guidance and training controls. |
| Local progress and individual records survive | Migration and separate dog-state tests; owner metadata and custom/imported avatars retained | Resolve concurrent tabs without replacing newer records or inventing successful saves. |
| Delivered working product | Main branch, Cloudflare deployment, live browser suites | Commit, push, deploy and verify each implementation; completion requires a final whole-flow audit. |

Known open issues above are release work for the benchmark, not evidence that it is already achieved. Virtual need values, recovery speeds, training probability and medicine outcomes are game rules; they do not diagnose or establish a real dog's health or learned skill.
