# Expo — A Digital Tamagotchi for Expo, Mali & Bangal

Live production system: [dog.nonarkara.org](https://dog.nonarkara.org)

## Overview

Expo is a local-first digital Tamagotchi built around real dogs — starting with Expo (a Thai Bangkaew Dog), with Mali and Bangal alongside. It is the kind of digital pet I would have built for myself if I'd had programming skills back when I queued at Loft in Siam Center for one of three Tamagotchis a day at 390 baht.

It fulfills four core objectives:

1. **Pet & React**: Pet, feed, play, walk, groom — and now **talk** to your dog. Each interaction moves trust, arousal, and personality on the dog's inner state. The 3D avatar reacts with tail speed, ear position, head tilt, and body language that matches its mood.
2. **Talk & Learn (Classical Conditioning)**: Say a word ("dinner", "come", "good boy") and Expo responds based on whether that word has been paired with food, petting, or play. Say it, then act within 30 seconds, and Expo learns the association — just like Pavlov.
3. **Train & Coach (Operant Conditioning)**: The Train deck teaches you how to train your dog. Record a rep (performed? marked? marker delay? real or rehearsal?) and watch the behaviour's strength move up or down. A timing coach flags markers late than 500ms. A readiness coach tells you when to move from continuous rewards to every-third to unpredictable schedules. Extinction bursts are named so you don't mistake them for stubbornness.
4. **Meet Other Dogs**: The Canine Commons park lets your dog roam with neighbors. Import a friend's exported dog JSON and their dog appears in the park as a visitor — amber beacon, sniffs, greet, chase.

---

## Featured Canine: Expo (เอ็กซ์โป)

- **Breed**: Thai Bangkaew Dog (*ไทยบางแก้ว*)
- **Date of Birth**: 17 November 2021 (5 years old / turning 5 in ~20 days)
- **Canine Biological Age**: ~36.5 dog years (Prime Adult Guardian)
- **Weight**: 24.8 kg
- **Coat & Markings**: Sable Agouti & White. Dark wolf-sable mask around eyes, white blaze running down muzzle, signature Bangkaew lion mane/chest ruff (*แผงคอสิงโต*), feathered plume tail.
- **Microchip ID**: `TH-985141002849102`
- **Tribe**: Phitsanulok Bangkaew Order
- **Signature Quirk**: Refuses to sleep without resting his chin on a bolster cushion (*Bolster Connoisseur*).

Also in the household: **Mali** (Thai Mix, food-motivated, golden tan & white) and **Bangal** (Thai Ridgeback, bold guardian, red & black). Each dog carries their own trust, arousal, personality, and training progress — they never share a state.

---

## Architecture & Technical Stack

- **Frontend**: React 19 + TypeScript + Vite.
- **3D Graphics Engine**: Three.js WebGL with custom articulated canine procedural geometry, physics, raycasting, dynamic lighting, and particle systems.
- **Audio Synthesis**: Zero-latency procedural Web Audio synthesizer for woofs, barks, eating crunches, ball bounces, and happy yips without MP3 latency.
- **Design System**: Dieter Rams × Vignelli planar grid — Amber `#f59e0b` single accent, zero border-radius, zero gradients, zero shadows, Josefin Sans display + Source Sans 3 body + JetBrains Mono.
- **Psychology Model**: Operant conditioning (marker timing, continuous/fixed/variable ratio schedules, diminishing returns, shaping, readiness-to-advance coach) and classical conditioning (cue-outcome pairing with expiry) — 36/36 self-tests pass.
- **Photogrammetry & 3D Pipeline**:
  - Multi-view photo intake (Front, Side, Close-up).
  - Open-source reconstruction backends: TripoSR (fast mesh feedforward), InstantMesh (sparse multi-view LRM), 3D Gaussian Splatting / Nerfstudio.
  - Built-in drag-and-drop `.glb` / `.gltf` 3D model importer.
- **Deployment**: Cloudflare Workers with Static Assets binding deployed to custom domain `dog.nonarkara.org`.
- **Storage**: Local-first LocalStorage with per-dog state and JSON export/import.

---

## Running Locally

```bash
bun install
bun run dev
```

Build and deploy to Cloudflare:

```bash
bun run build
npx wrangler deploy
```
