# Tama-Dog-Chi

Live production system: [dog.nonarkara.org](https://dog.nonarkara.org)

> **Where this came from.** Expo is the end of a thirty-year line: desktop
> pets in 1992, *Dogz* in 1995, the Tamagotchi egg in 1996, Nintendogs in
> 2005, and now. The full research — the design, the mechanics worth keeping,
> and the ones the genre got wrong — is in
> **[The History of the Digital Pet](docs/history-of-digital-pets.md)**.

## Overview

The no-scroll entry offers **Play** (the existing household sandbox) and **Own a dog** (a separate browser save). Adopt one of the five as a puppy; a minute of active attention on each of seven different days grows it into an adult. Care changes its own personality. Complete owned-dog backups include adoption identity, growth and training, and can be restored from entry. No account or cookies are needed; a browser profile is one owner.

The dog owns half the desktop width and at least half the phone's working view. Care is a compact six-reading console; history lives in a complete details view. Commons is a dedicated world with zoom buttons, wheel/pinch zoom, direct petting, walking and gentle social encounters. Roster and local simulated chat open on request.

First-use tips explain each main action below the dog and remember what you have already seen. The broom cleans; the pantry starts with food and paw coins, earns coins from active attention, and provides an emergency bowl when a hungry dog runs out. Fetch needs virtual practice before the catch game unlocks. Each dog has its own favorite touch region and wake habit. Wake barking is opt-in while the app is open, not a reliable lock-screen alarm. Sourced humane-training tips distinguish normal appetite from deliberately withholding food. See [implementation decisions and verification](design/handwritten-play-space.md).

Tama-Dog-Chi is a local-first digital pet built around Expo and Mali (Thai Bangkaews), Oreo, Paolo and Hachiku. Bangal and Kofi are retired from the playable household; their existing saved records are retained. It is the kind of digital pet I would have built for myself if I'd had programming skills back when I queued at Loft in Siam Center for one of three Tamagotchis a day at 390 baht.

It fulfills four core objectives:

1. **Pet & React**: Pet, feed, play, walk, groom — and now **talk** to your dog. Each interaction moves trust, arousal, and personality on the dog's inner state. The illustrated dog reacts with head tilts, tail movement, breathing, care motions, and authored sitting/resting/sleeping poses.
2. **Talk & Learn (Classical Conditioning)**: Say a word ("dinner", "come", "good boy") and Expo responds based on whether that word has been paired with food, petting, or play. The simulation pairs a word with care within an authored30-second window; this is a game model, not a measured learning deadline for a real dog.
3. **Train & Coach (reward-based training)**: Practise eight actions with the animated dog: cue, watch the movement finish, mark, then reward. Timing starts from the rendered completion frame. Sit, stay and wait rewards keep the dog in position. The separate real-session log records your observations; its percentages and schedule experiments are game estimates, not measured real-dog abilities. New skills use rewards for each successful response. The 500ms scoring target is a game rule, not a biological learning deadline.
4. **Meet Other Dogs**: The Canine Commons park lets your dog roam with neighbors. Import a friend's exported dog JSON and their dog appears in the park as a visitor — amber beacon, sniffs, greet, chase.

The stage also has high fives, play bows, happy wiggles, little zoomies and nose boops. Tap the bone to play Find the Treat under three cups. Each dog's pace and greeting differ; [play behavior and verification](design/play-and-personality.md) records the details.

The leaf offers quiet time. Watch the dog rest, then use the biscuit to reward calm. Needs come first; a short visible observation timer and reward cooldown keep this from becoming a tapping contest. This is virtual practice, separate from real training logs. [Method, sources and verification](design/calm-practice.md).

---

Dogs also have a day of their own: wandering and sniffing, boredom, toilet breaks and cleanable puddles, natural sleep/waking, and visibly unwell poses. Walks, company, play and cleanup resolve the matching need. [Daily-life rules and verification](design/daily-life.md).

## The Cockpit — one screen, no scrolling

**The page stays fixed.** Care fits without scrolling; longer real-session logs and record archives scroll inside their own region.

A Tamagotchi had one screen and no scroll: the animal, the indicators and the buttons were all there, and anything that came up came up as a bar. A page that scrolls down forever is a page whose contents were never decided — the reader is shown a slice and told to come back for the rest.

So the app is a fixed frame with three parts and nothing else:

| Part | What it is |
| --- | --- |
| **Header** | One band. What this is, which dog, which facts. |
| **Workspace** | The regions. On a wide screen **all five are on screen at once** — that is what a dashboard is. On a narrow screen the animal is on top and one region is below it, chosen from a strip. |
| **Command bar** | The five things you can do to a dog, and the one thing you can say. They never leave the bottom of the frame. Keys `1`–`5`. |

The five regions:

- **Stage** — the live illustrated dog (or an imported/legacy3D model), and the note bar under it that says what the dog just did.
- **Care** — six numbers, all derived from one state, and one sentence saying what to do next.
- **Coach** — the training deck: all eight behaviours, measured marker timing, the cue word the dog answers to, and the observation log.
- **Commons** — the 3D park, the neighbours, and the chat.
- **Record** — identity, the vaccination passport, parasites, medical history, and photographs.

Anything transient that "pops up" is a **bar**: a single row anchored to the bottom of its region, over the content and never over the controls. There are no modals and no full-screen dialogs.

The spatial gate enforces this: `scripts/spatial/spatial-check.mjs` now fails the build if the page scrolls **down** by even one pixel, and flags any region that hides its own content below the fold.

---

## Featured Canine: Expo (เอ็กซ์โป)

The coat follows the reference photos. Dates, weight, chip ID and the persona below are retained starter examples, not independently verified health facts. Runtime labels, JSON and print carry their source qualifications.

- **Breed**: Thai Bangkaew Dog (*ไทยบางแก้ว*)
- **Date of Birth**: 17 November 2021 (starter example)
- **Starter game age estimate**: ~36.5 dog years
- **Weight**: 24.8 kg
- **Coat & Markings**: Sable Agouti & White. Dark wolf-sable mask around eyes, white blaze running down muzzle, signature Bangkaew lion mane/chest ruff (*แผงคอสิงโต*), feathered plume tail.
- **Microchip ID**: `TH-985141002849102`
- **Tribe**: Phitsanulok Bangkaew Order
- **Signature Quirk**: Refuses to sleep without resting his chin on a bolster cushion (*Bolster Connoisseur*).

Also in the household: **Mali** (Expo’s sister, a shorter, broader female Bangkaew), **Oreo** (French Bulldog), **Paolo** (Pug), and **Hachiku** (Hachikō-inspired Akita Inu). Existing companions Bangal and Kofi remain available. Each dog carries their own trust, arousal, personality, and training progress — they never share a state.

---

## Architecture & Technical Stack

- **Frontend**: React 19 + TypeScript + Vite.
- **Dog stage**: Five photo-informed illustrated companions, alpha WebP art, an articulated Three.js image mesh, and a 30 fps scheduler. Each has authored standing, sitting, lying, lifted-paw, feeding, affection and sleeping artwork, with registered opaque transitions and staged settling. Hidden tabs pause; reduced-motion mode lowers the render rate and removes looping movement. Customized coats and newly enrolled dogs retain the procedural 3D renderer; imported models retain their existing path. See [the animation implementation](design/illustrated-animation.md).
- **Audio Synthesis**: Zero-latency procedural Web Audio synthesizer for woofs, barks, eating crunches, ball bounces, and happy yips without MP3 latency.
- **Game design**: Five light personality palettes consulted from Palette’s Wada source combinations; icon-led care, navigation and meters, with a touch-accessible label legend. Owner-supplied Non Architecture handwriting: uppercase labels and mixed-case reading, with a Thai fallback. The dog remains the visual focus; no decorative gradients or card effects. See [palette provenance](design/personality-palettes.md).
- **Psychology Model**: Operant conditioning (marker timing, continuous/fixed/variable ratio schedules, diminishing returns, shaping, readiness-to-advance coach) and classical conditioning (cue-outcome pairing with expiry) — self-tested in `src/domain/selftest.ts`.
- **One model, one number**: needs decay is owned by the domain (`decay()`), applied on load and on a timer. Happiness is *computed* from the other five numbers, never stored twice. The record mirrors the model; it does not keep a second opinion.
- **Storage**: Separate atomic, versioned LocalStorage saves hold Play and Own records and progress. A brief IndexedDB mutex serializes writers across tabs; actions always read the latest saved dog. Older saves migrate once and remain available for recovery. Old running tabs cannot overwrite the new format and should be reloaded before play continues there. [Concurrency method and verification](design/concurrent-progress.md).
- **Photogrammetry & 3D Pipeline**: The app runs **no** reconstruction. The Pipeline and Tools regions are an honest reference: the open-source workflow an operator runs on a machine, stage by stage. Built-in drag-and-drop `.glb` / `.gltf` model importer attaches a custom model to the record.
- **Deployment**: Cloudflare Workers with Static Assets binding deployed to custom domain `dog.nonarkara.org`.

---

## Running Locally

```bash
bun install
bun run dev
```

Build, verify and deploy:

```bash
bun run build
npm run test:domain
node scripts/spatial/spatial-check.mjs   # the spatial gate
npx wrangler deploy
```

The 29 October Dog-Tamagotchi likeness, interaction and rendering audit is in [docs/tamagotchi-audit.md](docs/tamagotchi-audit.md).
