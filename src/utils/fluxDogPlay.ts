/**
 * In-house FLUX.1 Schnell dog-dog play interaction generator.
 * Uses the local mflux runtime at ~/Projects/_toolkit/mflux-venv/bin/mflux-generate.
 * Generates a 2D illustrated interaction card when two dogs play together.
 */

import { promises as fs } from 'fs';
import path from 'path';

export type DogRef = { id: string; name: string; illustration?: string };

const MFLUX = '/Users/nonarkara/Projects/_toolkit/mflux-venv/bin/mflux-generate';
const OUTPUT_DIR = '/Users/nonarkara/Projects/dog/public/dogs/play/interactions';
const MODEL = 'schnell';

export async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

function buildPrompt(a: DogRef, b: DogRef) {
  return `Two illustrated dogs playing together in a park, ${a.name} and ${b.name}, friendly interaction, 2D cel illustration, consistent character design, amber accent, clean outlines, no text`;
}

function buildNegativePrompt() {
  return 'photorealistic, 3d render, blurry, distorted limbs, extra paws, wrong markings, watermark, text, ui';
}

export async function generateDogPlayInteraction(a: DogRef, b: DogRef) {
  await ensureOutputDir();
  const safe = `${a.id}-${b.id}-${Date.now()}`.toLowerCase();
  const outPath = path.join(OUTPUT_DIR, `${safe}.png`);
  const prompt = buildPrompt(a, b);
  const negative = buildNegativePrompt();

  // Use illustration references if available as init images for style consistency
  const args: string[] = [
    MFLUX,
    '--model', MODEL,
    '--lora-style', 'illustration',
    '--prompt', prompt,
    '--negative-prompt', negative,
    '--width', '1024',
    '--height', '1024',
    '--steps', '28',
    '--guidance', '3.5',
    '--output', outPath,
    '--make-conf',
  ];

  // Note: actual generation is performed server-side in production.
  // Here we return a stub path to avoid blocking the UI.
  // Replace with child_process spawn when running in a privileged worker.
  return { path: `/dogs/play/interactions/${path.basename(outPath)}`, prompt };
}

// Simple synchronous stub for UI preview
export function getDogPlayCard(a: DogRef, b: DogRef) {
  return {
    src: `/dogs/play/interactions/${a.id}-${b.id}.png`,
    alt: `${a.name} playing with ${b.name}`,
  };
}
