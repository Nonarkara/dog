/**
 * ILLUSTRATED PARK MOMENTS.
 *
 * Two dogs play in the park; the panel shows a small picture of the moment.
 * The pictures were made off-line with the in-house Flux runtime and shipped
 * as static files, because neither the browser nor a Cloudflare Worker can run
 * Flux. Nothing is generated at request time, and nothing pretends to be.
 *
 * To regenerate (mflux 0.24.0, FLUX.1 Schnell, 768x512, 8 steps):
 *
 *   mflux-generate --model schnell --steps 8 --height 512 --width 768 \
 *     --seed 4101 --prompt "<the CHASE prompt below>" \
 *     --output .audit/flux/chase.png
 *   cwebp -q 84 .audit/flux/chase.png -o public/dogs/play/interactions/chase.webp
 *
 * The pictures are park scenes, not portraits: a pair's own coat markings are
 * not reproduced, so the caption names the pair and the image stays a scene.
 */

export type DogPlayKind = 'chase' | 'tumble';

export interface DogPlayMoment {
  kind: DogPlayKind;
  src: string;
  alt: string;
  caption: string;
}

const CARDS: Record<DogPlayKind, { src: string; alt: string; verb: string }> = {
  chase: {
    src: '/dogs/play/interactions/chase.webp',
    alt: 'Illustration of two dogs playing chase across a green park.',
    verb: 'played chase',
  },
  tumble: {
    src: '/dogs/play/interactions/tumble.webp',
    alt: 'Illustration of two dogs tumbling together on the grass.',
    verb: 'tumbled in the grass',
  },
};

/** The prompts behind the shipped files. Kept so the art can be remade. */
export const DOG_PLAY_PROMPTS: Record<DogPlayKind, string> = {
  chase:
    'Two illustrated dogs playing chase in a green park, a brown-and-white dog running ahead and a tan dog chasing behind, ears flying, tails up, joyful, side view, full bodies visible, flat 2D vector illustration, thick clean dark-brown outlines, flat colour fills, warm cream and moss green palette, one amber accent, children’s picture-book style, no text, no signature, no watermark, no border',
  tumble:
    'Two illustrated dogs tumbling playfully on green grass in a park, one brown-and-white and one tan, mouths open in play, paws loose, tails up, side view, full bodies visible, flat 2D vector illustration, thick clean dark-brown outlines, flat colour fills, warm cream and moss green palette, one amber accent, children’s picture-book style, no text, no signature, no watermark, no border',
};

/**
 * Build the strip for a moment that actually happened. The caller supplies the
 * two names and the kind; the picture is one of the shipped scenes.
 */
export function dogPlayMoment(kind: DogPlayKind, a: string, b: string): DogPlayMoment {
  const card = CARDS[kind];
  return {
    kind,
    src: card.src,
    alt: card.alt,
    caption: `${a} and ${b} ${card.verb}.`,
  };
}
