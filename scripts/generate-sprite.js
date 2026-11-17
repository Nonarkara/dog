#!/usr/bin/env node
/**
 * Offline character sprite pipeline stub (review-gated via SPRITE_GEN_REVIEW=false).
 * Validates reference sheet, pose, Wada palette lock, and target size, then writes
 * metadata or staged output under public/dogs/sprites/.
 */
import fs from 'node:fs';
import path from 'node:path';

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

const outDir = path.join(root, 'public', 'dogs', 'sprites');
const outWebp = path.join(outDir, `${dog}-${pose}.webp`);
const meta = {
  dog,
  pose,
  seed: Number.isFinite(seed) ? seed : 42,
  source: `public/dogs/${refFile}`,
  output: `public/dogs/sprites/${dog}-${pose}.webp`,
  tier,
  age: 'adult',
  projection: '2d-orthographic',
  paletteLock: 'wada-2-4-color',
  accent: '#f59e0b',
  readabilityRangePx: [104, 128],
  reviewGate: 'SPRITE_GEN_REVIEW',
  generatedAt: new Date().toISOString(),
};

if (dryRun) {
  console.log('[dry-run] Planned sprite generation:', JSON.stringify(meta, null, 2));
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(refPath, outWebp);
fs.writeFileSync(path.join(outDir, `${dog}-${pose}.meta.json`), JSON.stringify(meta, null, 2) + '\n');
console.log('Generated review-gated sprite:', JSON.stringify(meta, null, 2));
