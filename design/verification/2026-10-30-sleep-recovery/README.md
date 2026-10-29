# Interrupted rest: live verification

Implementation `fca2125`; Cloudflare version `958605c5-cb55-4411-9ffe-74008fcff645` on `https://dog.nonarkara.org`. The live HTML references the expected `index-B6iQNUFV.js` build.

`scripts/test-sleep-recovery.cjs` passed against production with an isolated, synthetic browser save. Restlessness 0.72 and three interruptions initially block bed; two quiet game hours produce autonomous sleep and increased energy without care rewards. Sleep persists after reload. By three hours, uninterrupted rest has cleared the wake tally. Sleeping artwork is rendered, and the browser reports no runtime errors. The report and screenshot here come from that live run; no owner data was altered.

Before implementation, six new domain assertions failed. Afterward, all 138 checks passed. TypeScript, production build, full daily-life browser suite, and four-viewport/five-avatar Catch/migration suite passed locally. The first Catch-suite invocation used its default port 3100 and failed because no server was there; rerunning against the actual production preview on 4178 passed. Independent read-only review ran 45 frozen-input edge cases and exact 10-second live/offline comparisons, with no confirmed findings.

The global benchmark remains incomplete: see `docs/benchmark-status.md` for the punitive-care and concurrent-tab work still required. No clinical sleep timing or physical-phone performance claim is made.
