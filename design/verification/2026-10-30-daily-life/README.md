# Daily-life release

Rules and provenance: [daily life](../../daily-life.md).

Local verified checks:

- TypeScript and production build; **128/128 domain tests**.
- Daily-life browser suite: unattended wander without reward, boredom/play, walk prevents accident, live pee event, visible/tappable cleanup, persistence, sickness/recovery, quiet cleaning, natural nap/waking, independent dogs, reduced motion, accident cancels pending treat game. Zero runtime errors.
- Existing catch/core suite: four viewports, five avatars, deterministic victory, game-close cleanup, per-dog state and coat/migration persistence. Its identity test now seeds an actually hungry dog; it no longer relies on incidental fractional decay during an overfeeding action.
- Existing toy suite and palette/contrast/state suite passed; keyboard suite passed editable cue text, cup/menu Space, Escape and restored care shortcuts. Interaction tests pin daytime; night timing has explicit domain tests.
- Fresh four-viewport geometry/pixel suite passed; 29.9–30.1 fps in Mac Chrome, two dog draw calls / 18,480 triangles. Not physical-phone certification.

All figures are measured in the JSON files beside this receipt. Header remains 45 px; healthy footer is 105 px on phone and 55 px at the three wider sizes. Stage remains 372×248 at 390×844, 1006×307.19 at 1024×768, 586.66×782 at 1440×900 and 1262×288 at 1280×720. The existing emergency medicine control wraps the phone footer to 155 px; every control remains visible, and stage geometry is preserved. Contextual needs occupy the existing stage, without a new header/footer. Care retains its own scrollable long record; the page itself stays within the viewport.

Regression falsifiers: the isolated old domain creates zero droppings after 180 minute ticks, rejected by the new accumulator test. The isolated 500 px header fixture fails the compact chrome budget. A bottom automatic call note formerly covered a new puddle; the daily browser suite now hit-tests its center so that overlap fails. Automatic calls remain visible in Care, the stage need and document title; action notes remain.

Independent review closed all findings: elapsed-time erasure by frequent care, offline mess/hygiene progression, within-absence sleep/waking, sub-10-second settling, settled-state game reward guards, sick/training priority, consistent Care advice, game cancellation before toilet poses, cheerful sickness art and puddle obstruction. Reviewer inspected five sick dogs, four viewports and the borderless puddle; no remaining blocker. Still images do not certify natural gait.

Deployment and live verification follow below.

## Live closeout

Implementation `a7772a6`, greeting preservation `224c7b6`, both pushed to main. Final Cloudflare version: `1703bf11-02ec-4d26-acab-9ee6c94eaec2`, https://dog.nonarkara.org/.

The complete daily-life suite passed on the public site, including automatic nap/wake, live accident cancellation of a pending game, visible puddle cleanup, quiet cleaning, reduced motion and per-dog persistence, with zero browser errors. The existing toy suite also passed live: high-five exactly once, boop, third-pet surprise, Find the Treat rewards/costs/cancellation and all five play bows. A separate live check confirmed Hachiku spontaneously offers a paw after idle time; the earlier household greetings remain alongside daily routines.

Live HTML, entry JS/CSS, illustrated-renderer chunk and all five unwell WebPs matched local production SHA-256 hashes. Live captures: `/tmp/dog-daily-live` and `/tmp/dog-daily-live-toys`. The independent reviewer also cleared the final greeting guards. No physical-phone or fully natural gait certification is claimed.
