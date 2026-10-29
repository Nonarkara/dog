# Dog-Tamagotchi benchmark — current evidence

Objective: a 2026 version of an interactive, fun Tamagotchi featuring the owner's dogs and real training methods. This ledger preserves that scope; a passing layout or unit suite alone does not establish completion.

30 October: chooser, interrupted-rest recovery, humane calm practice and cross-tab progress protection are implemented. The overall goal remains active.

| Requirement | Current evidence | Remaining work |
|---|---|---|
| Recognizable, cute illustrated Expo, Mali, Oreo, Paolo and Hachiku | Approved artwork and palettes; `design/illustrated-animation.md`, `design/personality-palettes.md`; five-dog browser suite | Retain likeness and approved eyes during new motion work. |
| Responsive movement and direct interaction | Pet, feed, walk, groom, tricks, bows, boops and zoomies; `design/play-and-personality.md`; rendered interaction suites | Recheck complete play/care/training sequence together after foundational fixes. |
| Fun games with meaningful outcomes | Five-round Catch and three-round Find the Treat, deterministic input, bounded rewards, cancellation on dog change | End-to-end replay across tired/sick/awake states, including training transitions. |
| A persistent day of its own | Toilet, cleanup, boredom, sickness, wandering, natural sleep/waking; `design/daily-life.md`; `design/concurrent-progress.md` replaces cached saves with atomic fresh-state actions | Complete the whole-flow audit with care, games and Coach together. |
| Recoverable care consequences | Repeated-wake domain and browser regressions; quiet rest permits sleep and energy recovery; live proof in `design/verification/2026-10-30-sleep-recovery/` | Preserve recovery while repairing concurrent saves. |
| Real reward-based training | Coach measures marker delay, eight behaviors, cue associations, shaping, practice versus real-session logs; `design/calm-practice.md` replaces punitive care with quiet observation/reward; live proof in `design/verification/2026-10-30-calm/` | Audit schedule/feedback wording against primary guidance and run the complete Coach flow with the new care loop. |
| Dog visible throughout operation | Dedicated message/game dock; chooser occupies Care; fixed compact Care; five viewport geometry suites | Preserve this while revising guidance and training controls. |
| Local progress and individual records survive | Atomic v3 save, serialized cross-tab writers, separate dog selection, strict legacy migration, old-version isolation and failed-write/queued-action regressions; owner metadata and custom/imported avatars retained | Final deployed verification of both new save suites. Enrollment still fills unsupplied clinical defaults (microchip, weight, clinic and preset birth date); remove those before the honesty audit can pass. |
| Delivered working product | Main branch, Cloudflare deployment, live browser suites | Commit, push, deploy and verify each implementation; completion requires a final whole-flow audit. |

Known open issues above are release work for the benchmark, not evidence that it is already achieved. Virtual need values, recovery speeds, training probability and medicine outcomes are game rules; they do not diagnose or establish a real dog's health or learned skill.
