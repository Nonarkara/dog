# A complete dog day and a real practice break

Local `scripts/test-whole-day.cjs` passed with no browser errors. Its only time control is Playwright's Date clock followed by normal reload: it never patches needs or replaces the pet's state. The recorded checkpoints cover full-belly feedback, affection, all five Catch rounds, three Find the Treat rounds, rendered practice/marker/reward, a real-session manual rep, rehearsal isolation, cue storage, an observation, ending practice and reloading, answering a toilet call, an accident and cleanup, sustained sleep and natural waking, a two-day lapse, virtual sickness gates, care recovery, dog isolation and final reload.

`local.json` contains the actual persistent state at every checkpoint. A depleted dog kept sleeping after an hour; the test checked energy recovery and then allowed sufficient rest before natural waking. It did not assume an arbitrary one-hour wake deadline. Medicine and recovery are authored game mechanics, not real treatment guidance.

164 domain checks, TypeScript and build passed. The new session helpers sum trials across behaviors, reset session clocks/counts/streak/misses on Take a break, and retain skill/stage and real logs. The action occupies the existing trial control row. No new stage overlay or Care scroll was added.

Independent review found and reproduced a queued break + behavior switch leaving isSaving stuck. It was fixed by releasing the pending UI state before the stale-epoch return. `test-pending-saves.cjs` now contains that exact reproduction; the independent rerun passed all eight checks. Forced write failure preserved canonical bytes and allowed retry; switching dogs during a pending break kept the write with the original dog.

Real-log form and history now scroll together under the fixed mode header. Real wheel input reaches Last attempts at390×844,1024×900,1440×900,1280×720. Independent review injected the original overflow behavior in the browser and reproduced clipped history at all four sizes (66/44/44/163px beyond the scrollport). Valid capture files accompany this receipt. The user-approved art, palettes, compact Care and animal floor remain.

Obsidian get_context and log_decision were attempted but their transport was closed; this repository receipt retains the evidence. Starter clinical-record provenance remains unverified and is the next benchmark audit, without silently overwriting owner edits.

Live release closeout follows below.
