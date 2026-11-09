/**
 * In-house FLUX.1 Schnell dog-dog play interaction generator.
 * Uses the local mflux runtime at ~/Projects/_toolkit/mflux-venv/bin/mflux-generate.
 * Generates a 2D illustrated interaction card when two dogs play together.
 * NOTE: The client cannot run mflux. This module only prepares the request.
 * A worker/build step must run generation and return a real asset path.
 */

export type DogRef = { id: string; name: string; illustration?: string };

export async function ensureOutputDir() {
  // No-op on client. Server implementation will create directory.
  return;
}

function buildPrompt(a: DogRef, b: DogRef) {
  return `Two illustrated dogs playing together in a park, ${a.name} and ${b.name}, friendly interaction, 2D cel illustration, consistent character design, amber accent, clean outlines, no text`;
}

function buildNegativePrompt() {
  return 'photorealistic, 3d render, blurry, distorted limbs, extra paws, wrong markings, watermark, text, ui';
}

export async function prepareDogPlayInteraction(a: DogRef, b: DogRef) {
  await ensureOutputDir();
  const safe = `${a.id}-${b.id}-${Date.now()}`.toLowerCase();
  const prompt = buildPrompt(a, b);
  const negative = buildNegativePrompt();

  // The UI must never show a card until a real image exists. Server-side
  // generation will replace this stub with the produced asset path.
  return {
    status: 'not-generated' as const,
    filename: `${safe}.png`,
    prompt,
    negative,
  };
}

// Simple synchronous stub for UI preview
export function getDogPlayCard(a: DogRef, b: DogRef) {
  return {
    // Do not point at a file until generation has actually written it.
    src: null,
    alt: `${a.name} playing with ${b.name}`,
  };
}
