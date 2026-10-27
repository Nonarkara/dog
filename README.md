# Canine // Dog OS & The Bark Park Metaverse

Live production system: [dog.nonarkara.org](https://dog.nonarkara.org)

## Overview

Canine OS is a local-first canine passport, 3D interactive Tamagotchi, and communal dog metaverse built for dog parents. 

It fulfills two core objectives:

1. **Dog Record & 3D Tamagotchi**: A permanent digital health passport and living avatar for your dogs. You feed the system medical history, vaccinations, parasite control schedules, quirks, and multi-angle photos. The photogrammetry pipeline matches keypoints to generate or rig a 3D avatar that breathes, wags, reacts to touch, eats treats, chases balls, and tracks biometrics (hunger, happiness, energy, hygiene).
2. **The Canine Commons (The Dog Metaverse)**: A 3D virtual park where your dog enters their ancestral or chosen tribe, roams freely, barks in real-time comms, and sniffs/greets dogs from other households and breeds to inspect verified health passports and badges.

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

---

## Architecture & Technical Stack

- **Frontend**: React 19 + TypeScript + Vite.
- **3D Graphics Engine**: Three.js WebGL with custom articulated canine procedural geometry, physics, raycasting, dynamic lighting, and particle systems.
- **Audio Synthesis**: Zero-latency procedural Web Audio synthesizer for woofs, barks, eating crunches, ball bounces, and happy yips without MP3 latency.
- **Design System**: Dieter Rams × Vignelli planar grid — Amber `#f59e0b` single accent, zero border-radius, zero gradients, zero shadows, Josefin Sans display + Source Sans 3 body + JetBrains Mono.
- **Photogrammetry & 3D Pipeline**:
  - Multi-view photo intake (Front, Side, Close-up).
  - Open-source reconstruction backends: TripoSR (fast mesh feedforward), InstantMesh (sparse multi-view LRM), 3D Gaussian Splatting / Nerfstudio.
  - Built-in drag-and-drop `.glb` / `.gltf` 3D model importer.
- **Deployment**: Cloudflare Workers with Static Assets binding deployed to custom domain `dog.nonarkara.org`.
- **Storage**: Local-first IndexedDB / LocalStorage with JSON export/import.

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
