#!/usr/bin/env node
/**
 * Consistency check for the character sprite pipeline:
 * 1. All 5 canonical dogs x 9 orthographic poses exist in public/dogs/.
 * 2. Both review gates (PLAY_MOMENT_CARDS and SPRITE_GEN_REVIEW) remain false.
 * 3. scripts/generate-sprite.js dry-run succeeds and emits the honest envelope.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dogs = ['expo', 'mali', 'oreo', 'paolo', 'hachiku'];
const poses = ['stand', 'sit', 'down', 'bow', 'paw', 'pet', 'feed', 'sleep', 'sick'];

let count = 0;
for (const dog of dogs) {
  for (const pose of poses) {
    const file = pose === 'stand' ? `${dog}.webp` : `${dog}-${pose}.webp`;
    const full = path.join(root, 'public', 'dogs', file);
    assert(fs.existsSync(full), `Missing orthographic reference sheet: ${full}`);
    count++;
  }
}

const fluxSrc = fs.readFileSync(path.join(root, 'src', 'utils', 'fluxDogPlay.ts'), 'utf8');
assert(/export const PLAY_MOMENT_CARDS\s*=\s*false/.test(fluxSrc), 'PLAY_MOMENT_CARDS must remain false until reviewed');
assert(/export const SPRITE_GEN_REVIEW\s*=\s*false/.test(fluxSrc), 'SPRITE_GEN_REVIEW must remain false until reviewed');

const out = execFileSync('node', ['scripts/generate-sprite.js', '--dog=expo', '--pose=sit', '--seed=42', '--dry-run'], { encoding: 'utf8' });
const jsonStart = out.indexOf('{');
assert(jsonStart >= 0, 'Dry-run must emit JSON metadata');
const meta = JSON.parse(out.slice(jsonStart));
assert.equal(meta.dog, 'expo');
assert.equal(meta.pose, 'sit');
assert.equal(meta.seed, 42);
assert.equal(meta.projection, '2d-orthographic');
assert.equal(meta.accent, '#f59e0b');
assert.equal(meta.reviewGate, 'SPRITE_GEN_REVIEW');
assert.deepEqual(meta.readabilityRangePx, [104, 128]);

console.log(`PASS sprite pipeline: ${count}/${dogs.length * poses.length} orthographic sheets present, review gates locked, dry-run contract valid.`);
