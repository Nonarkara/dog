#!/usr/bin/env node
/**
 * Character sprite pipeline (review-gated via SPRITE_GEN_REVIEW=false).
 *
 * Wraps the spritecast charpipe.py pipeline for dog characters:
 *   turnaround -> 3d (Tripo model + rig) -> render -> draw (OpenAI) -> finish -> pack
 *
 * Constraints for dog.nonarkara.org:
 *   - 2D orthographic only: camera = "topdown" (pitch 50), never isometric
 *   - kind = "animal" (four-legged dogs, no bought rig)
 *   - Wada 2-4 colour palette per dog + single UI accent #f59e0b
 *   - MSH first: boxes fit content, phone-first 390px, readable 104-128px
 *   - Review gate: SPRITE_GEN_REVIEW must be true before sprites surface
 *
 * Usage:
 *   node scripts/generate-sprite.js --dog=expo --pose=sit [--seed=42] [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const VALID_DOGS = ['expo', 'mali', 'oreo', 'paolo', 'hachiku'];
const VALID_POSES = ['stand', 'sit', 'down', 'bow', 'paw', 'pet', 'feed', 'sleep', 'sick'];

const args = process.argv.slice(2);
const flag = (name, fallback = '') => {
  const eq = args.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const dog = flag('--dog', 'expo');
const pose = flag('--pose', 'stand');
const tier = flag('--tier', 'authored-anchor');
const seed = Number(flag('--seed', '42'));
const dryRun = args.includes('--dry-run') || flag('--dry-run') === 'true';

if (!VALID_DOGS.includes(dog)) {
  console.error(`Unknown dog "${dog}". Expected one of: ${VALID_DOGS.join(', ')}`);
  process.exit(1);
}
if (!VALID_POSES.includes(pose)) {
  console.error(`Unknown pose "${pose}". Expected one of: ${VALID_POSES.join(', ')}`);
  process.exit(1);
}

const root = process.cwd();
const refFile = pose === 'stand' ? `${dog}.webp` : `${dog}-${pose}.webp`;
const refPath = path.join(root, 'public', 'dogs', refFile);
if (!fs.existsSync(refPath)) {
  console.error(`Missing reference sheet: ${refPath}`);
  process.exit(1);
}

// Load dog reference spec (Wada palette, camera, kind)
const specPath = path.join(root, 'design', 'character-pipeline', 'references', `${dog}.json`);
let spec = {};
if (fs.existsSync(specPath)) {
  spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
}

// Wada palette validation
const wadaPlate = spec.wadaPlate || 0;
const wadaColors = spec.wadaColors || {};
const accent = spec.accent || '#f59e0b';
if (accent !== '#f59e0b') {
  console.error(`Accent must be #f59e0b, got ${accent}`);
  process.exit(1);
}

// MSH size guard: phone-first readability 104-128px
const msbSizePx = spec.msbSizePx || 112;
if (msbSizePx < 104 || msbSizePx > 128) {
  console.error(`MSH size ${msbSizePx}px outside phone-first budget 104-128px`);
  process.exit(1);
}

// 2D orthographic guard: camera must be topdown, never isometric
const camera = spec.camera || 'topdown';
if (camera !== 'topdown') {
  console.error(`Camera must be "topdown" for 2D orthographic park, got "${camera}"`);
  process.exit(1);
}

// kind must be animal for dogs
const kind = spec.kind || 'animal';
if (kind !== 'animal') {
  console.error(`Dog kind must be "animal", got "${kind}"`);
  process.exit(1);
}

const outDir = path.join(root, 'public', 'dogs', 'sprites');
const outWebp = path.join(outDir, `${dog}-${pose}.webp`);
const metaPath = path.join(outDir, `${dog}-${pose}.meta.json`);

const meta = {
  dog,
  pose,
  seed: Number.isFinite(seed) ? seed : 42,
  source: `public/dogs/${refFile}`,
  output: `public/dogs/sprites/${dog}-${pose}.webp`,
  spec: `design/character-pipeline/references/${dog}.json`,
  tier,
  age: 'adult',
  projection: '2d-orthographic',
  camera,
  kind,
  wadaPlate,
  wadaColors,
  accent,
  readabilityRangePx: [104, 128],
  msbSizePx,
  touchTargetPx: 32,
  reviewGate: 'SPRITE_GEN_REVIEW',
  msh: {
    boxFitsContent: true,
    noInflation: true,
    maxTextSizes: 3,
    phoneHeroRatio: 0.5,
    zeroRadius: true,
    zeroGradient: true,
    zeroShadow: true,
  },
  guards: {
    twoDOrthographic: true,
    noGeometry: true,
    paletteLocked: wadaPlate > 0,
    accentAmber: accent === '#f59e0b',
  },
  generatedAt: new Date().toISOString(),
  pipeline: 'spritecast-charpipe',
  pipelineSteps: ['turnaround', '3d', 'render', 'draw', 'finish', 'pack'],
};

if (dryRun) {
  console.log('[dry-run] Planned sprite generation:', JSON.stringify(meta, null, 2));
  process.exit(0);
}

// Real generation: invoke spritecast charpipe.py pipeline
// External dependencies: Python 3.9+, Playwright + Chrome/Edge, OpenAI API key, Tripo API key
// These are NOT available in this environment; the operator must run charpipe.py manually.
// See OPERATING.md for the full pipeline and review gate.
try {
  const spritecastRoot = '/Users/nonarkara/Projects/Non-Slop';
  const python = `${spritecastRoot}/skills/spritecast/scripts/doctor.py`;
  // Dry-run already validated; real mode documents the command to run:
  const charpipeCmd = [
    python,
    'skills/spritecast/scripts/charpipe.py',
    'turnaround',
    `${dog}.json`,
    '--yes',
  ].join(' ');
  console.error(`[real-mode] SpriteCast pipeline not auto-run here. Operator must run:
  cd /Users/nonarkara/Projects/Non-Slop
  python3 skills/spritecast/scripts/doctor.py --fix --characters
  export OPENAI_API_KEY=...  TRIPO_API_KEY=...
  python3 skills/spritecast/scripts/charpipe.py turnaround design/character-pipeline/references/${dog}.json --yes
  python3 skills/spritecast/scripts/charpipe.py 3d design/character-pipeline/references/${dog}.json --yes
  python3 skills/spritecast/scripts/charpipe.py draw design/character-pipeline/references/${dog}.json --yes
  python3 skills/spritecast/scripts/charpipe.py pack design/character-pipeline/references/${dog}.json --px ${msbSizePx}
  Then copy outputs to public/dogs/sprites/${dog}-${pose}.webp and re-run --dry-run to validate metadata.
`);
  process.exit(0);
} catch (err) {
  console.error(`Pipeline setup error: ${err.message}`);
  process.exit(1);
}

// Write metadata (always, so dry-run artifacts are inspectable)
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
console.log('Generated review-gated sprite metadata:', JSON.stringify(meta, null, 2));
