# Games beside the animal, not over it

The owner supplied two Catch screenshots: a large wrapping HUD covers Mali's head, and an action note also covers the paws in the older build. Stage feedback has already moved below the canvas, but game HUDs still use absolute overlays. This is the same composition failure in another state.

Fix plan: put both illustrated game interfaces in one compact dock below the stage frame, using a React portal so the existing game state/timers remain owned by the dog. Keep the dog canvas and message separation; keep direction, score, rounds, choices and close controls. Catch becomes a single compact control row; Find the Treat groups its instruction with three smaller but usable cup controls. Preserve Care's complete fixed readout and existing controls. No game/reward/timing rewrite.

Prove the actual game UI and action messages have zero canvas intersection with full head/paws, both before and during choices. Check all four standard viewports plus the narrow dashboard boundary; verify full Care content still fits when game dock and note coexist. Keep original game/cancellation/keyboard tests. Capture old overlay failure before editing and close independent pixel review before deployment.

Companion choice uses a temporary “Choose a dog” view in the existing Care region. All seven companions and Enroll remain in compact rows; the current Care readout returns on close/selection. The previous active tab is restored, no menu/backdrop floats over the animal, and keyboard Escape/arrows work without firing care, cup or training shortcuts. The current game remains owned by its dog until actual selection changes identity and cleans it up.

Narrow dashboard jump movement is clamped to the camera's available silhouette margin, including Mali's broader profile. Vertical hop room is bounded too. Review includes left and right jump frames, not only control-box rectangles.

While the chooser is open, the game dock uses native `hidden` to yield its space and keyboard shortcuts. Its portal/state remain mounted, so closing the chooser resumes the same game; selecting another dog performs the existing keyed cleanup. This avoids stacking game controls with companion choice or squeezing the short chooser into another scrolling list.
