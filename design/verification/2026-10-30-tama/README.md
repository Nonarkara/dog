# Tama-Dog-Chi UI and ownership verification ·30October2026

Fresh isolated Chrome contexts, fixed noon for reproducibility. Files `entry-phone.png`, `play-phone.png` and `play-desktop.png` were independently captured and their PNG dimensions checked (390×844,390×667,1440×900). `owned-puppy.png` is the public adoption flow's actual390×844render. These screenshots show default states before any first-use guide opens.

Reproduce behavior with `scripts/test-play-space.cjs`, `scripts/test-first-play-tips.cjs` and `scripts/test-workspace-ready.cjs`. The first two use isolated contexts and accept DOG_URL/DOG_EVIDENCE. Existing training/concurrency tests run with DOG_URL ending`/?mode=play`. Domain checks:`npm run test:domain`.

Temporary detailed reports/videos live at `/tmp/tama-dog-chi`, `/tmp/tama-training`, `/tmp/tama-concurrent`, `/tmp/tama-first-play`, `/tmp/dog-fallback-idle`, `/tmp/dog-fallback-acts` and `/tmp/dog-ui-review`. These are session evidence, not permanent user records. Source tests and this committed screenshot set are the durable reproduction path.

No remaining confirmed independent-review finding after care clipping and incomplete-backup fixes. Browser-only ownership is deliberate; sound while open is implemented, a reliable OS/lock-screen alarm is not.
