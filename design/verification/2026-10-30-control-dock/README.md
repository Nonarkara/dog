# One clear animal stage

[Design record](../../game-control-dock.md). Owner screenshots showed Catch covering Mali's head and a companion flyout covering Paolo. Existing action feedback had already been separated; this release removes the other UI overlays.

- Both illustrated games render into a real dock below the stage via React portals. Legacy Catch uses the same dock. Dog-owned round state, timers, rewards and cleanup remain.
- Catch direction/round/score/result remain, with compact direction buttons and full accessible labels. Find uses 44×48 cup controls, a close button, round/score and its existing instruction.
- Choosing a dog temporarily uses the Care region. All seven dogs plus Enroll remain visible; close/selection restores the previous tab. Escape/arrows and header focus work. The game dock yields while choosing, remains mounted, and resumes the same phase/round on close.
- Camera margin clamps protect Mali's face during left/right Catch jumps on a narrow dashboard. A rectangle-only game UI test had missed this; independent pixel review required both jump directions before clearance.

Verified locally: TypeScript/build; 20 game geometry cases and five chooser cases at 390×844, 1024×768, 1440×900, 1280×720 and 1024×820; combined chooser/game test on phone+desktop; existing toy/reward/cancellation suite, core Catch/identity/migration suite and keyboard suite. No page/Care overflow in game cases. Old runtime reproduces game and selector/canvas intersections; new intersections zero. Reports beside this receipt contain actual rectangles.

Independent source/pixel review cleared phone game/result/cup controls, all eight choices, both 1024×820 jump directions, portal ownership/cleanup, keyboard priority and preserving game state while hidden. No remaining blocker. Captures do not certify natural gait or physical-phone performance.

Live deployment closeout follows below.

A separate Bangal legacy 3D check also passed: Catch uses the external dock, a direction choice works and closing removes the HUD. The final native-hidden mode passed the combined chooser/game test without resetting its guess phase or round.

A first live chooser check also caught a 0.484375px raw canvas overhang during the animated feedback resize (integer renderer clientHeight versus fractional flex height). The stage already clipped it visually; the canvas CSS is now clamped to its container as well. The strict zero-intersection threshold was kept. Five chooser cases passed again on the clamped build before publication.
