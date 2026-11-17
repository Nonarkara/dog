/**
 * SPRITECAST SPECIFICATION & ENGINE
 *
 * Implements the Sunghwan0112/spritecast character specification for 2.5D
 * isometric canine avatars, 8-direction walks, idle cycles, actions, and
 * frame-by-frame 3D cast shadows.
 *
 * Reference: https://github.com/Sunghwan0112/spritecast
 */

import { DogProfile } from '../types/dog';

export type Facing =
  | 'south'
  | 'south-east'
  | 'east'
  | 'north-east'
  | 'north'
  | 'north-west'
  | 'west'
  | 'south-west';

export const ALL_FACINGS: Facing[] = [
  'south',
  'south-east',
  'east',
  'north-east',
  'north',
  'north-west',
  'west',
  'south-west',
];

export const FACING_ANGLES: Record<Facing, number> = {
  south: 0,
  'south-east': 45,
  east: 90,
  'north-east': 135,
  north: 180,
  'north-west': 225,
  west: 270,
  'south-west': 315,
};

export const FACING_SHORT: Record<Facing, string> = {
  south: 'S',
  'south-east': 'SE',
  east: 'E',
  'north-east': 'NE',
  north: 'N',
  'north-west': 'NW',
  west: 'W',
  'south-west': 'SW',
};

export interface ShadowFrame {
  offset: [number, number]; // [x, y] in pixels from sprite origin
  radiusX: number;
  radiusY: number;
  rotationDeg: number;
  opacity: number;
}

export interface SpriteCastCharacterSpec {
  name: string;
  breed: string;
  kind: 'animal';
  frame: [number, number]; // [width, height] in px
  anchor: [number, number]; // [anchorX, anchorY] ground contact point fraction (0..1)
  fps: number;
  facings: Facing[];
  walk: Record<Facing, string>;
  idle: Record<Facing, string>;
  actions?: Record<string, Record<Facing, string>>;
  shadows: {
    walk: Record<Facing, ShadowFrame[]>;
    idle: Record<Facing, ShadowFrame[]>;
  };
  metadata: {
    generator: string;
    version: string;
    camera: string;
    light: string;
    quirks: string[];
  };
}

/**
 * Calculates the nearest facing given an angle in degrees (0 = South, 90 = East, etc.)
 */
export function angleToFacing(deg: number): Facing {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'south';
  if (normalized >= 22.5 && normalized < 67.5) return 'south-east';
  if (normalized >= 67.5 && normalized < 112.5) return 'east';
  if (normalized >= 112.5 && normalized < 157.5) return 'north-east';
  if (normalized >= 157.5 && normalized < 202.5) return 'north';
  if (normalized >= 202.5 && normalized < 247.5) return 'north-west';
  if (normalized >= 247.5 && normalized < 292.5) return 'west';
  return 'south-west';
}

/**
 * Calculates vector direction from source to target and returns closest 8-facing
 */
export function directionToFacing(dx: number, dz: number): Facing {
  if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) return 'south';
  // Math.atan2(dx, dz): 0 when dz>0 (south), pi/2 when dx>0 (east)
  const rad = Math.atan2(dx, dz);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return angleToFacing(deg);
}

/**
 * Generates the standardized SpriteCast character.json specification for any enrolled dog profile.
 */
export function generateSpriteCastSpec(dog: DogProfile): SpriteCastCharacterSpec {
  const frameW = 140;
  const frameH = 140;
  const anchorX = 0.5;
  const anchorY = 0.82;

  // Base shadow calculations for isometric 30° projection with upper-right light
  const generateShadowsForAction = (frameCount: number) => {
    const res: Record<Facing, ShadowFrame[]> = {} as any;
    for (const f of ALL_FACINGS) {
      const frames: ShadowFrame[] = [];
      for (let i = 0; i < frameCount; i++) {
        // Slight oscillation during quadruped walk cycle
        const strideOffset = Math.sin((i / frameCount) * Math.PI * 2) * 2;
        let ox = -6;
        let oy = 42;

        if (f === 'east' || f === 'north-east') {
          ox = -10;
        } else if (f === 'west' || f === 'south-west') {
          ox = -2;
        }

        res[f] = frames;
        frames.push({
          offset: [ox + strideOffset, oy],
          radiusX: 28 + (f.includes('east') || f.includes('west') ? 6 : 0),
          radiusY: 13,
          rotationDeg: f.includes('east') ? -12 : f.includes('west') ? 12 : -5,
          opacity: 0.35,
        });
      }
    }
    return res;
  };

  const walkMap: Record<Facing, string> = {} as any;
  const idleMap: Record<Facing, string> = {} as any;
  for (const f of ALL_FACINGS) {
    walkMap[f] = `sprites/${dog.id}/walk-${f}.png`;
    idleMap[f] = `sprites/${dog.id}/idle-${f}.png`;
  }

  return {
    name: dog.id,
    breed: dog.breed,
    kind: 'animal',
    frame: [frameW, frameH],
    anchor: [anchorX, anchorY],
    fps: 8,
    facings: ALL_FACINGS,
    walk: walkMap,
    idle: idleMap,
    actions: {
      bolsterRest: {
        south: `sprites/${dog.id}/rest-bolster-south.png`,
        'south-east': `sprites/${dog.id}/rest-bolster-south-east.png`,
        east: `sprites/${dog.id}/rest-bolster-east.png`,
        'north-east': `sprites/${dog.id}/rest-bolster-north-east.png`,
        north: `sprites/${dog.id}/rest-bolster-north.png`,
        'north-west': `sprites/${dog.id}/rest-bolster-north-west.png`,
        west: `sprites/${dog.id}/rest-bolster-west.png`,
        'south-west': `sprites/${dog.id}/rest-bolster-south-west.png`,
      },
    },
    shadows: {
      walk: generateShadowsForAction(6),
      idle: generateShadowsForAction(4),
    },
    metadata: {
      generator: 'SpriteCast v1.2 / Canine OS',
      version: '1.0.0',
      camera: 'iso-2:1 (30 deg pitch, 45 deg yaw)',
      light: 'right',
      quirks: dog.quirks,
    },
  };
}

/**
 * Draws a frame of the dog directly onto an HTML5 Canvas or returns SVG paths.
 * Renders Expo's authentic Thai Bangkaew traits: wolf-sable mask, lion ruff,
 * white muzzle blaze, pricked ears, and plume tail in the requested facing and motion phase.
 */
export function renderDogSpriteFrame(
  ctx: CanvasRenderingContext2D,
  dog: DogProfile,
  facing: Facing,
  phase: number, // 0.0 to 1.0 (animation progress)
  action: 'idle' | 'walk' | 'feed' | 'play' | 'rest',
  centerX: number = 70,
  centerY: number = 70,
  scale: number = 1.0
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);

  const baseSable = dog.avatarConfig.baseColor || '#2b2623';
  const whiteFur = dog.avatarConfig.secondaryColor || '#f4ede6';
  const maskColor = dog.avatarConfig.maskColor || '#1c1815';

  // 1. Draw 3D Isometric Contact Shadow under feet
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  let shadowW = 32;
  let shadowH = 14;
  let shadowX = -4;
  let shadowY = 44;

  if (facing === 'east' || facing === 'west') {
    shadowW = 38;
  }
  if (action === 'walk') {
    shadowX += Math.sin(phase * Math.PI * 2) * 2;
  }
  ctx.ellipse(shadowX, shadowY, shadowW, shadowH, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Special Action: Resting on Bolster Cushion (Expo's Signature Quirk)
  if (action === 'rest') {
    // Draw grey bolster pillow
    ctx.fillStyle = '#64748b'; // bolster grey
    ctx.beginPath();
    ctx.roundRect(-30, 20, 60, 24, 10);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Resting dog body curled behind bolster
    ctx.fillStyle = baseSable;
    ctx.beginPath();
    ctx.ellipse(0, 16, 28, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // White Lion Ruff
    ctx.fillStyle = whiteFur;
    ctx.beginPath();
    ctx.ellipse(-2, 10, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head resting chin comfortably on the bolster
    ctx.fillStyle = maskColor;
    ctx.beginPath();
    ctx.ellipse(-2, 4, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // White blaze
    ctx.fillStyle = whiteFur;
    ctx.fillRect(-4, -4, 4, 14);

    // Sleeping eye line
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, 4);
    ctx.lineTo(-4, 5);
    ctx.moveTo(1, 5);
    ctx.lineTo(6, 4);
    ctx.stroke();

    // Cute pink nose
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.ellipse(-2, 11, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  // GAIT & BREATHING CALCULATION
  const breathBob = Math.sin(phase * Math.PI * 2) * 1.5;
  const walkBob = action === 'walk' ? Math.abs(Math.sin(phase * Math.PI * 2)) * 3 : 0;
  const legCycle = action === 'walk' ? Math.sin(phase * Math.PI * 2) : 0;

  // Quadruped Leg offsets
  const flLeg = legCycle * 8; // front-left
  const frLeg = -legCycle * 8; // front-right
  const blLeg = -legCycle * 7; // back-left
  const brLeg = legCycle * 7; // back-right

  const isFront = facing.includes('south');
  const isBack = facing.includes('north');
  const isRight = facing.includes('east');
  const isLeft = facing.includes('west');

  // 2. Draw Back Legs (rendered behind body)
  ctx.fillStyle = whiteFur;
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 1;

  if (isFront || isRight || isLeft) {
    // Back Left Paw
    ctx.fillRect(-16 + (isLeft ? blLeg : 0), 25 + (isLeft ? -Math.abs(blLeg) * 0.4 : 0), 7, 18);
    // Back Right Paw
    ctx.fillRect(9 + (isRight ? brLeg : 0), 25 + (isRight ? -Math.abs(brLeg) * 0.4 : 0), 7, 18);
  }

  // 3. Tail (Plumed Bangkaew tail curls over back)
  ctx.save();
  const tailWag = Math.sin(phase * (action === 'play' ? 16 : 8)) * 0.25;
  ctx.translate(isFront ? -4 : 0, isBack ? 2 : -2);
  ctx.rotate(tailWag);
  ctx.fillStyle = whiteFur;
  ctx.beginPath();
  ctx.ellipse(-14, -6 - breathBob, 8, 14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = baseSable;
  ctx.beginPath();
  ctx.ellipse(-16, -10 - breathBob, 5, 8, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Main Body & Dark Saddle
  ctx.save();
  ctx.translate(0, -walkBob);
  ctx.fillStyle = baseSable;
  ctx.beginPath();
  let bodyW = 22;
  let bodyH = 17;
  let bodyX = 0;
  let bodyY = 10;

  if (isRight || isLeft) {
    bodyW = 28;
    bodyX = isRight ? -4 : 4;
  }
  ctx.ellipse(bodyX, bodyY, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly white undercoat
  ctx.fillStyle = whiteFur;
  ctx.beginPath();
  ctx.ellipse(bodyX, bodyY + 6, bodyW * 0.7, bodyH * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5. Front Legs
  ctx.fillStyle = whiteFur;
  if (!isBack) {
    // Front Left Paw
    ctx.fillRect(-12 + flLeg, 24 + (flLeg < 0 ? -Math.abs(flLeg) * 0.3 : 0), 8, 20);
    // Front Right Paw
    ctx.fillRect(4 + frLeg, 24 + (frLeg < 0 ? -Math.abs(frLeg) * 0.3 : 0), 8, 20);
  } else {
    ctx.fillRect(-12, 24, 8, 20);
    ctx.fillRect(4, 24, 8, 20);
  }

  // 6. Signature Bangkaew White Lion Mane Ruff (แผงคอสิงโต)
  ctx.save();
  ctx.translate(0, -walkBob);
  ctx.fillStyle = whiteFur;
  ctx.beginPath();
  let ruffX = 0;
  let ruffY = -2;
  if (isRight) ruffX = 6;
  if (isLeft) ruffX = -6;
  if (isBack) ruffY = 2;

  ctx.ellipse(ruffX, ruffY, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feathered ruff accents
  ctx.beginPath();
  ctx.moveTo(ruffX - 18, ruffY);
  ctx.lineTo(ruffX - 24, ruffY + 8);
  ctx.lineTo(ruffX - 12, ruffY + 12);
  ctx.lineTo(ruffX, ruffY + 18);
  ctx.lineTo(ruffX + 12, ruffY + 12);
  ctx.lineTo(ruffX + 24, ruffY + 8);
  ctx.lineTo(ruffX + 18, ruffY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 7. Head & Facial Features
  ctx.save();
  ctx.translate(0, -walkBob);

  let headX = 0;
  let headY = -14;
  if (isRight) headX = 6;
  if (isLeft) headX = -6;

  // Head base
  ctx.fillStyle = maskColor;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 15, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Triangular Pricked Ears
  ctx.fillStyle = maskColor;
  // Left Ear
  ctx.beginPath();
  ctx.moveTo(headX - 13, headY - 6);
  ctx.lineTo(headX - 11, headY - 25);
  ctx.lineTo(headX - 2, headY - 11);
  ctx.closePath();
  ctx.fill();
  // Inner white ear hair
  ctx.fillStyle = whiteFur;
  ctx.beginPath();
  ctx.moveTo(headX - 11, headY - 8);
  ctx.lineTo(headX - 10, headY - 21);
  ctx.lineTo(headX - 4, headY - 12);
  ctx.closePath();
  ctx.fill();

  // Right Ear
  ctx.fillStyle = maskColor;
  ctx.beginPath();
  ctx.moveTo(headX + 13, headY - 6);
  ctx.lineTo(headX + 11, headY - 25);
  ctx.lineTo(headX + 2, headY - 11);
  ctx.closePath();
  ctx.fill();
  // Inner white ear hair
  ctx.fillStyle = whiteFur;
  ctx.beginPath();
  ctx.moveTo(headX + 11, headY - 8);
  ctx.lineTo(headX + 10, headY - 21);
  ctx.lineTo(headX + 4, headY - 12);
  ctx.closePath();
  ctx.fill();

  // Face details (only visible if facing front or sides)
  if (!isBack) {
    // White muzzle blaze down nose
    ctx.fillStyle = whiteFur;
    ctx.beginPath();
    ctx.ellipse(headX, headY + 1, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Muzzle protrusion
    ctx.beginPath();
    ctx.ellipse(headX, headY + 5, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.ellipse(headX, headY + 3, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (warm amber watchful gaze)
    ctx.fillStyle = '#f59e0b'; // amber
    const eyeOffsetX = isRight ? 4 : isLeft ? -4 : 0;

    // Left eye
    if (!isRight || facing === 'south-east') {
      ctx.beginPath();
      ctx.ellipse(headX - 6 + eyeOffsetX, headY - 2, 2.5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c1815';
      ctx.beginPath();
      ctx.arc(headX - 6 + eyeOffsetX, headY - 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Right eye
    if (!isLeft || facing === 'south-west') {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(headX + 6 + eyeOffsetX, headY - 2, 2.5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c1815';
      ctx.beginPath();
      ctx.arc(headX + 6 + eyeOffsetX, headY - 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tongue-tip peek when relaxed/happy
    if (action === 'feed' || action === 'play' || Math.sin(phase * 4) > 0.4) {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.roundRect(headX - 2.5, headY + 7, 5, 4.5, 2);
      ctx.fill();
    }
  }

  // Feeding action: bone in mouth
  if (action === 'feed') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(headX - 12, headY + 3, 24, 4, 2);
    ctx.fill();
    ctx.stroke();
    // Bone knobs
    ctx.beginPath();
    ctx.arc(headX - 12, headY + 2, 3, 0, Math.PI * 2);
    ctx.arc(headX - 12, headY + 8, 3, 0, Math.PI * 2);
    ctx.arc(headX + 12, headY + 2, 3, 0, Math.PI * 2);
    ctx.arc(headX + 12, headY + 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Playing action: tennis ball bouncing
  if (action === 'play') {
    const ballX = headX + (isRight ? 18 : -18);
    const ballY = headY + Math.abs(Math.sin(phase * Math.PI * 4)) * -16 + 10;
    ctx.fillStyle = '#a3e635'; // neon tennis yellow
    ctx.beginPath();
    ctx.arc(ballX, ballY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ballX, ballY, 4, 0.4, 2.5);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}
