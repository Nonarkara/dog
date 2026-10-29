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

## Live closeout

Implementation `8494e19`, final canvas clamp `aae6246`, both pushed to main. Final Cloudflare version `8382dded-c7c8-4c16-bbd9-461377338b1f` at https://dog.nonarkara.org/.

The public-site suites passed all 20 game cases and five chooser cases with strict zero intersections after the clamp. The combined chooser/game suite passed live, preserving guess phase/round and suppressing background keys. Measurements are in `game-live.json` and `chooser-live.json`; full live captures are in `/tmp/dog-dock-live-clamped` and `/tmp/dog-chooser-live-clamped`. Live HTML, entry JavaScript and CSS SHA-256 hashes match the local production build.

The user's selected existing in-app browser tab (id5) was still running the older interface. It was reloaded to the final build, then the chooser was opened and verified through its current accessibility tree and actual screenshot, without selecting a different dog or pressing care actions. `live-user-tab.png` shows Paolo fully visible and all seven dogs plus Enroll in the separate Care-area chooser. No duplicate browser tab was created.
