# Handwritten play space

Design read: a handwritten dog diary opens onto a park, with the animal as the subject and tools close to the hand. Reference: the three-button Tamagotchi's separation of pet display and care controls.

The first unnecessary expansion is the permanently visible park roster/chat consuming the world; move Commons to a dedicated screen, make the scene dominant (at least 60% of phone viewport), and disclose roster/chat on request. Retain visitor import, clear, local simulated chat, walking and every neighbour. Zoom controls, wheel and pinch change the actual camera. Tap/stroke dogs for visible affection; canonical care applies only to the owner's dog.

Home: illustrated hero takes half the phone viewport. Stage callouts sit behind the transparent dog canvas; foreground toys remain usable. Persistent feedback stays below the animal. Use supplied Non Architecture Regular for Latin, true uppercase labels and natural mixed-case prose; Thai stays on its existing fallback. No synthesized bold. Compact care tools use a disclosed speech field, preserving all actions and shortcuts.

Preserve per-dog Palette colors, all medical qualifications, training, saves and renderer behavior. Verify at 390×844, 1024×768 and 1440×900: world/hero dimensions, direct petting, zoom bounds, return navigation, disclosures and no body/chrome clipping. Review real screenshots independently before deploy.

## Tama-Dog-Chi care loop (owner extension)

The owner subsequently requested removal of Bangal/Kofi, renaming, an obvious broom, individual touch preferences, an engagement-funded pantry, learned fetch, social park walking and a tucked-in bedtime/wake habit. Retired starter records remain in the saved envelope but are excluded from the playable household; reset defaults contain only the requested five. User-created dogs remain.

Pantry: 18 starter paw coins and three portions per dog, +3 coins per active minute measured by the existing foreground attention clock. Buying exchanges six coins for three meals atomically. An empty pantry gives a hungry dog an emergency bowl. Regular meals do not erase learning; a full belly refuses excess portions and small training rewards remain distinct. Training/saves remain owned by their original modules.

Fetch uses actual persisted virtual fetch lesson progress, never self-reported real-world practice, to unlock the catch game. Before that the dog watches a proper seamed tennis ball and links directly to Fetch practice. Touch points are checked against the transparent image mask, converted to anatomical regions, and reveal each dog's authored preference. Neutral touch remains gentle; preferred touch gives an extra point of virtual trust. These preferences are game personalities, not claims about the photographed animals.

Twenty everyday expressions: watch, look around, sniff, wander, sit, stretch, yawn, ear twitch, head tilt, wag, shake, scratch, paw for attention, nose nudge, play bow, trot, rest, sigh, sleep, toilet. Eligibility follows mood/energy/needs, single acts have bounded durations and eased deformation, and reduced motion suppresses autonomous gestures. Sleep and sickness outrank play; waking queues a stretch/yawn after care is finished.

Body-language references: Dogs Trust https://www.dogstrust.org.uk/dog-advice/understanding-your-dog/body-language ; AKC https://www.akc.org/expert-advice/training/how-to-read-dog-body-language/ ; Cornell https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-information/what-are-zoomies . These support contextual interpretation, not an objective popularity ranking or clinical classifier.

Bedtime: per-dog wake-minute preference, opt-in barking only on actual sleep→wake while visible, explicit sound test when enabled. The web app cannot promise a reliable phone lock-screen alarm. In-app wording states this limit. No push subscription, background recording or notification permission is added.

## Play / Own entry and growth (owner extension)

No-scroll entry has two purposeful choices, Play and Own a dog, with the existing approved dog artwork as its dominant element. Play keeps the existing sandbox save. Own opens a separate versioned local save and a one-time five-dog adoption chooser. Both use existing localStorage atomic-envelope writes guarded by IndexedDB's cross-tab mutex. Cookies are inappropriate for pet records because they are small and sent on HTTP requests. Browser profiles/devices are separate owners; there is no server identity or cross-device synchronization. Existing sandbox exports remain unchanged. A Modes link always returns to entry.

An adopted dog starts with a new virtual record (no copied medical history), its own random identity token and personality state, and an explicit game lifecycle. Growth takes seven care days, each earned by at least a minute of active attention, rather than rewarding an unattended timer or punishing someone for being away. Puppy/youngster/adult change the coherent illustrated rig's size and head proportions. Care days and all personality changes persist in the owned envelope. The interface explains the authored growth pace.

Training tips cite primary welfare/veterinary sources in a compact disclosure. Normal appetite can make food rewarding; never withhold meals to force compliance. A very hungry, sick or exhausted dog should receive care before practice. Small rewards come from the daily allowance; regular meals do not erase memory or make a dog morally 'bad'. AVSAB 2021/2025 humane-training statement, AAHA behavior-management guidance, Dogs Trust positive reinforcement, and VCA food/treat training provide the sources. The game model's scores are labelled as game estimates.

## First-round guide (owner extension)

Each main action type shows a short contextual tip the first time it is used: pet/direct touch, clean, feed, pantry purchase, play/fetch, walking, bedtime, wake sound, talk, quiet practice, coach, record, care, park, switching dogs, tricks, sniff games, marker/reward and camera zoom. It does not block the action or pretend the action saved. Seen tips are separate per-mode browser preferences, read fresh on every use, so another tab's completed guide is respected. The guide sits in the stage's existing below-canvas feedback area, alongside the actual action result; save failures take priority. In the park it has its own row, preserving more than half the phone for the world. No tooltip floats over the dog.

## Verification and acceptance

Care console measured 130.9px at390×844 and390×667,100.6px at1440×900 (original user screenshot's tall information box replaced by content-sized instruments). Desktop hero708px of1440px wide; phone hero takes remaining useful space after compact controls, at least half in the default home view. Every meter, health qualification, last-care time and together total remains reachable in History & details. The old320px Care fixture fails the new190px budget; a25dvh park fixture fails the world-size budget.

Independent review reproduced and closed two defects: clipped care details on short screens/Talk, and incomplete backup replacing a good owned pet. Public restore now rejects missing pet/growth/personality while leaving the original canonical string byte-identical. Complete recovery after clearing storage preserves identity, growth and trust. Seeded six-day youngster advanced via the actual foreground activity timer to seven-day Adult,scale1.000.

TypeScript,197domain checks, eight rendered training actions at four viewports/reduced motion, concurrent same/different-dog writers, pantry/serve/reload, first fetch confusion→Fetch coach, direct touch, zoom/petting/chat, owned/save isolation and backup recovery passed. Fallback custom-coat path independently cycled natural idles, deferred waking stretch/yawn, cancelled on care and respected reduced motion; all six idle acts captured with actual renderer metadata/video.

Spatial baseline routes intentionally changed: `/` is now the requested entry; `/?mode=play` is the complete live system; `/?mode=own` is the initial adoption chooser in a fresh browser. All41previous widths retained, with329/330/331 added for the new narrow chooser boundary. Importantly, the lazy entry App fallback now sets data-study-ready=false; a delayed-App/delayed-Record test proves the audit waits for real rendered content. Earlier provisional pre-marker receipts were discarded. The accepted receipt contains132fresh measurements across3routes/44widths, no unexplained layout findings. History/roster/chat expanded states are separately exercised in real browser tests rather than claimed by the initial-route receipt.
