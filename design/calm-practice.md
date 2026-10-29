# Quiet time, observation, reward

The benchmark requires a dog game that supports real training methods. The previous care loop contradicted its Coach: it offered Scold, rewarded a firm “No” with 25 discipline points, and called low-scoring dogs undisciplined. A full meal also reduced discipline. Those mechanics are replaced, while the existing control space, records, dog art, games and training data remain.

## Method and sources

[AVSAB's current position](https://avsab.org/resources/position-statements/) recommends reward-based dog training and rejects physical or psychological punishment. [Dogs Trust's settle guidance](https://www.dogstrust.org.uk/dog-advice/training/basics/settle-training) starts in a quiet setting, rewards relaxed behavior, increases duration gradually and reduces distractions when the dog cannot settle. The game adapts observation followed by a small reward. It does not establish that a real dog has learned to settle.

Quiet time lowers virtual excitement and restlessness without awarding trust or training progress. Once excitement is at most 55, the illustrated dog rests on its existing down artwork. The timer displays a three-second observation wait. Reward calm then gives a small game bonus: trust +2 and calm +5. A 60-second cooldown limits repeated rewards. Three seconds, thresholds and point values are authored game pacing, not a prescribed real-dog training duration or assessment. Food, toilet needs, fatigue, illness, sleep and cleanup take priority. Practice never wakes a sleeping dog.

Other care, a spoken cue, sleep, a new physical need or a training pose cancels the calm observation. Quiet time closes active games and holds the illustrated dog out of spontaneous travel/tricks. Reward uses the existing feeding drawing and eating sound, then releases the dog back to normal activity. Existing procedural companions retain their down-pose path and cancel Catch safely; imported rigs use their available clips. No punishment buzzer is played.

The cue input remains available beside the calm control, including old saves with an activity call. Leaf means quiet time, a timer and visible seconds mean observe, and a biscuit means reward; all have accessible names and a label legend. Header/footer dimensions remain 150px combined on phone and 100px in the other tested viewports. Feedback stays below the dog canvas. Palette, eye artwork and illustration assets are unchanged.

An expanded-help check found that the old footer legend clipped 27px of Care on phone, 23px at 1024×768 and 52px at 1280×720. Help now temporarily uses the existing information region, like the dog chooser. All 24 symbol labels form a compact three-column reference; its close button and Escape return to the previous region and restore help-button focus. Navigation and dog choice leave help cleanly. No footer expansion or dog overlay is needed. Restoring the old footer legend in an isolated fixture fails the same 150px combined-chrome budget.

## Compatibility and honesty

The stored `discipline` key is retained to preserve existing progress; the UI labels it Calm and identifies it as a virtual practice score. It never diagnoses a real dog's temperament. Old `scold` callers safely invoke quiet time and cannot earn a punishment bonus. The legacy `tantrum` call ID now represents high excitement, never a low score or moral judgment. A sniff walk or quiet time offers a way forward. Full meals no longer reduce calm score. Existing virtual fullness/weight mechanics remain game rules.

Calm practice does not modify `behaviours`, real-session timestamps or observation histories. Real training is still recorded separately in Coach. The separate concurrent-tab state defect remains open in the benchmark ledger.

## Verification

153 domain checks pass; the previous pet engine fails eight of these checks. Browser suite `scripts/test-calm.cjs` exercises keyboard access, waiting, down/feed artwork, bounded rewards, real-record separation, reload persistence, interrupted practice and geometry at 390×844, 1024×768, 1440×900 and 1280×720. Domain tests cover sleeping/sick/hungry/tired/dirty/toilet states, excitement, cooldown and old-command compatibility.

Independent review ran the domain suite and extra real-history, interrupted-needs and rapid-settle probes. It found an inaccessible visible countdown: seconds were only in the accessible name. This was corrected with visible seconds beside the timer and rechecked in all four final screenshots. The seven-rule pixel review found no outstanding issue in this change. Live verification is recorded with the release evidence after deployment.
