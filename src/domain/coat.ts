/**
 * THE COAT, AS A RULE AND NOT AS A MESH.
 *
 * The first avatars drew the coat as separate pieces of geometry: a dark
 * lathe for the saddle, a sphere for the mask, a cone for the ruff. Every
 * boundary between colours was a boundary between objects, and the eye read
 * the objects. Here the coat is a function: give it a body part and a point
 * on that part, and it says what colour the fur is there. The avatar paints
 * every vertex with it, so colours blend across one continuous skin.
 *
 * It is data-driven so that any dog — not only Expo — can be painted from a
 * pattern name and four colours.
 */

export type CoatPattern = 'bangkaew' | 'saddle' | 'mask' | 'solid' | 'spotted';

export interface CoatColors {
  base: string;   // the main coat
  light: string;  // chest, muzzle, belly, paws, tail tip
  dark: string;   // saddle, mask, ears
  point: string;  // tan: cheeks, brows, the tipping on the saddle
}

export type CoatPart =
  | 'torso'
  | 'mane'
  | 'head'
  | 'muzzle'
  | 'cheek'
  | 'ear'
  | 'leg'
  | 'thigh'
  | 'tail';

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** A cheap, stable value noise in 3D: the same point always gets the same fur. */
function hash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  );
}

/**
 * The colour of the fur at point (x, y, z) on a part.
 *
 * Coordinates are the part's own, in avatar units: +x is the dog's left,
 * +y is up, +z is toward the nose. Two parts bend the rule: on a thigh
 * +x is OUTWARD (away from the body), and on the tail z runs 0..1 from the
 * root of the tail to its tip.
 */
export function coatColorAt(
  part: CoatPart,
  x: number,
  y: number,
  z: number,
  pattern: CoatPattern,
  colors: CoatColors
): RGB {
  const base = hexToRgb(colors.base);
  const light = hexToRgb(colors.light);
  const dark = hexToRgb(colors.dark);
  const point = hexToRgb(colors.point);
  const grain = noise3(x * 9, y * 9, z * 9);
  // Guard hairs: the dark is never flat, it is tipped with the point colour.
  const tipped = mix(dark, point, smooth(0.45, 0.95, grain) * 0.55);

  const hasSaddle = pattern === 'bangkaew' || pattern === 'saddle';
  const hasMask = pattern === 'bangkaew' || pattern === 'mask';
  const tanPoints = pattern === 'bangkaew';

  let c: RGB = base;

  switch (part) {
    case 'torso': {
      // Light underneath: chest and belly.
      c = mix(base, light, smooth(-0.05, -0.3, y));
      if (hasSaddle) {
        // The saddle covers the back from behind the mane to the rump and
        // runs down the flanks, with a ragged lower edge.
        const edge = -0.02 + (grain - 0.5) * 0.14 - Math.max(0, -z - 0.2) * 0.25;
        const s = smooth(edge - 0.06, edge + 0.06, y) * smooth(0.42, 0.22, z);
        c = mix(c, tipped, s);
        // A tan wash low on the haunch, where the saddle fades out.
        if (tanPoints) c = mix(c, point, smooth(-0.25, -0.55, z) * smooth(0.25, 0, Math.abs(y)) * 0.45 * (1 - s));
      }
      if (pattern === 'spotted') c = mix(c, dark, smooth(0.6, 0.66, noise3(x * 3, y * 3, z * 3)));
      return c;
    }
    case 'mane': {
      // The mane is light in front; on a saddled dog its back joins the saddle.
      c = mix(base, light, smooth(-0.05, 0.25, z) * 0.85 + 0.15);
      // Expo's saddle runs up the back of the neck to the head.
      if (hasSaddle) c = mix(c, tipped, smooth(0.12, -0.12, z) * smooth(-0.02, 0.22, y));
      return c;
    }
    case 'head': {
      if (!hasMask) {
        c = mix(base, light, smooth(0.0, -0.22, y) * smooth(0.12, 0.3, z));
        return c;
      }
      // Dark skull and eye patches, tipped with tan.
      c = tipped;
      // Tan on the cheeks and in two small brow spots.
      if (tanPoints) {
        c = mix(c, point, smooth(0.12, 0.26, Math.abs(x)) * smooth(0.12, -0.05, y) * 0.8);
        const brow = Math.hypot(Math.abs(x) - 0.11, y - 0.12, z - 0.27);
        c = mix(c, point, smooth(0.06, 0.03, brow) * 0.7);
      }
      // The blaze: a narrow white stripe up the forehead between the eyes.
      const blazeW = 0.03 + Math.max(0, 0.1 - y) * 0.12;
      c = mix(c, light, smooth(blazeW, blazeW * 0.5, Math.abs(x)) * smooth(0.1, 0.24, z) * smooth(0.32, 0.18, y));
      // White chin and lower face.
      c = mix(c, light, smooth(-0.1, -0.24, y) * smooth(0.0, 0.18, z));
      return c;
    }
    case 'muzzle':
      return hasMask && pattern === 'mask' ? mix(light, dark, smooth(-0.02, 0.06, y)) : light;
    case 'cheek':
      return tanPoints ? mix(point, light, smooth(0.0, -0.12, y)) : hasMask ? mix(dark, light, smooth(0.0, -0.12, y)) : mix(base, light, smooth(0.05, -0.12, y));
    case 'ear':
      return hasMask ? mix(dark, point, grain * 0.3) : mix(base, dark, 0.25);
    case 'leg':
      return pattern === 'solid' || pattern === 'mask' ? mix(base, light, smooth(-0.05, -0.3, y)) : light;
    case 'thigh': {
      c = pattern === 'solid' || pattern === 'mask' ? base : light;
      if (hasSaddle) c = mix(c, tanPoints ? mix(point, dark, grain * 0.5) : tipped, smooth(0.0, 0.16, y) * smooth(-0.02, 0.12, x) * 0.85);
      return c;
    }
    case 'tail': {
      // Light plume; on a saddled dog the top of the base is grey-dark.
      c = pattern === 'solid' ? mix(base, light, smooth(0.4, 1, z)) : light;
      if (hasSaddle) c = mix(c, mix(tipped, light, 0.35), smooth(0.0, 0.12, y) * smooth(0.6, 0.2, z));
      return c;
    }
  }
}

/** The coat a dog has, from its stored avatar config; older records had no pattern. */
export function coatOf(config: {
  baseColor: string;
  secondaryColor: string;
  maskColor: string;
  pointColor?: string;
  pattern?: CoatPattern;
}): { pattern: CoatPattern; colors: CoatColors } {
  return {
    pattern: config.pattern ?? 'solid',
    colors: {
      base: config.baseColor,
      light: config.secondaryColor,
      dark: config.maskColor,
      point: config.pointColor ?? config.baseColor,
    },
  };
}
