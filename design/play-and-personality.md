# More play, same household

The owner asked for more moves and more fun after approving the illustrated dogs and light personality palettes. This adds a small toy rail beside the dog; the care bar, training, records and existing catch game remain.

- **High five:** ask for a paw, then tap the hand target. It uses the ordinary pet action once, including its existing care effects. Repeated target clicks cannot award twice.
- **Play bow:** a new authored canine pose for all five dogs, with low forelegs, raised hindquarters and a wagging tail.
- **Happy wiggle:** smiling artwork, local body sway and a faster tail. Every third pet brings a little extra wiggle.
- **Zoomies:** a short run with stepping legs, direction changes and small hops. The ground contact follows the dog.
- **Boop:** touching the head gives a head tilt and a small heart reaction.
- **Quiet greetings:** healthy, awake, comfortably fed dogs sometimes greet the player during idle time. Expo watches/tilts; Mali wiggles; Oreo bows; Paolo gives a slower tilt; Hachiku offers a paw. These are authored game personalities, not claims about the real animals. Idle greetings make no sound and do not run in reduced-motion mode.

The game keeps Expo's gentle tempo, Mali's broader wiggle, Oreo's springiness, Paolo's smaller/slower bounce and Hachiku's calm greeting. Approved eyes, coat markings and light palettes remain.

## Find the Treat

The bone icon opens a three-cup memory game. A treat is revealed for 1.1 seconds, then the player picks a cup. Three rounds; finding at least two wins. Click/tap, use 1–3, or focus a cup and press Space/Enter. Escape closes. Game keys do not trigger care shortcuts or the wide-screen training deck; care shortcuts return after closing.

Finishing awards +3 trust for a win or +1 for participating, costs 4 energy, and raises arousal slightly. It counts as time together: `lastCareAt` and the profile's `lastPlayed` update; a lonely call clears. Other needs remain. The exported record mirrors the resulting care state. This does not use catch's exercise/weight reward. Closing during the final result or changing dogs cancels pending rewards. Sick/asleep dogs cannot start or finish the game; exhausted dogs cannot start toys.

## Runtime and accessibility

Only five small play-bow WebPs were added (223,052 bytes total across the household). Each selected dog now loads eight drawings. No generated video or additional runtime library is downloaded. Dog rendering remains two draw calls; texture upload is primed during loading to avoid deferring it to a new pose.

Toy symbols have accessible names, desktop tooltips, visible reaction captions and entries in the existing touch legend. The game instruction has a paper carrier so it never sits unreadably over dark fur. Cups follow the dog's ground level at phone and wide sizes. Reduced motion keeps pose feedback while suppressing looping wiggles, hops and heart movement.

## Verification

- TypeScript/build and 100 domain checks pass.
- `scripts/test-dog-fun.cjs`: real trick controls, high-five double-tap protection, boop, third-pet surprise, all five bow poses, game win/cost/attention/profile mirror, cancel before completion, dog-switch cancellation, sick guard and toy legend.
- `scripts/illustrated/test-toy-keyboard.cjs`: cup activation by Space, no unrelated training cue, editable cue typing, native menu activation, Escape close and restored care shortcut.
- Existing catch/state/persistence regression suite passes after scoping its Play selector to the care bar (Play Bow is a separate control).
- Five palette/contrast/state checks pass. Fresh-context viewport checks measure 30 fps at 390×844, 1024×768, 1440×900 and 1280×720, with full painted frames and visible care controls. These are Mac/Chrome measurements, not physical-phone certification.

Live verification follows deployment in the release receipt.
