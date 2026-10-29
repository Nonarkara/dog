# Care fits its panel

Owner screenshot: Paolo's Care panel required scrolling to reach the short LAST records and sleep/weight/health line. Task: read the six needs and their next action together, with all recent care visible. Design reference remains the one-screen Tamagotchi care loop; existing approved dog/personality palettes remain.

The first expansion was inside each meter: icon and reading occupied two stacked rows, repeated in a two-column matrix. The four short care timestamps then occupied two more rows. This pushed the complete care record out of the panel.

The fix keeps the 17 px readings and every field. Icon and reading share a row, six meters use three columns (six columns in a wide Care region), and all four LAST timestamps share one row. Narrow dashboard Care panels below 280 px use two timestamp rows so icons stay intact. The advice, readiness, discipline, temperament, Today/streak/Total, sleep, weight and health remain. Summary text wraps naturally; no ellipsis is used to make the advice fit. Care alone has `overflow:clip`; actual content-fit and no-scroll tests gate it so clipping cannot hide a failure. Long Coach/Record/Commons surfaces retain their existing behavior.

Measured before/after: phone flat state overflow 11→0 px; phone sick state 66→0 px; 1440×900 sick state 10→0 px. Header, animal-stage and command-bar dimensions are unchanged. Screenshots and all dimensions: [verification](verification/2026-10-30-care-fit/).

TypeScript and production build pass. `scripts/test-care-fit.cjs` checks 24 combinations: flat/sick/long-name-call/sleeping at 390×844, 1024×768, 1440×900, 1280×720 and the 1024×820 / 1440×820 dashboard boundaries. Gates: no page overflow; no Care scroll container; content scrollHeight <= clientHeight; complete bottom-record bounds within panel; attempted programmatic scroll stays at zero; six meters and all four care timestamps retained. An isolated old vertical-stack fixture fails the same fit budget. These screenshots verify Care composition, not settled animal animation.

Independent source/pixel review and live deployment closure are recorded in the verification receipt.
