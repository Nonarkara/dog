#!/usr/bin/env node
/**
 * THE WIDTHS THE LAYOUT ACTUALLY CHANGES AT.
 *
 * The shared spatial instrument reads the project's stylesheet to find the
 * breakpoints, and then measures at every one of them. It looks for the
 * stylesheet in `dist/_next/static/css`, which is where a Next.js build
 * keeps it — and this is a Vite build, so the instrument cannot find the
 * file and falls back to a fixed list of widths. A layout checked only at
 * the widths somebody listed is checked at the widths where nothing
 * changes.
 *
 * The instrument stays byte-identical to its package; the rule it cannot
 * apply to this project lives here. This script reads the same CSS the
 * instrument would have read, and prints the widths to sweep.
 *
 *     node scripts/breakpoints.mjs            # the widths, comma separated
 *     node scripts/breakpoints.mjs --with-css # plus where the CSS lives
 */
import { readdirSync, readFileSync } from 'node:fs';

const DIST = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'dist';

function stylesheet() {
  const dir = `${DIST}/assets`;
  const files = readdirSync(dir).filter((f) => f.endsWith('.css'));
  if (!files.length) {
    throw new Error(`No stylesheet in ${dir}. Build first: npm run build`);
  }
  return { path: `${dir}/${files[0]}`, text: readFileSync(`${dir}/${files[0]}`, 'utf8') };
}

const { path, text } = stylesheet();
const widths = new Set();

for (const m of text.matchAll(/@(media|container)([^{]*)\{/g)) {
  const body = m[2];
  for (const w of body.matchAll(/\((?:min|max)-width:\s*([\d.]+)(px|rem|em)\)/g)) {
    const n = parseFloat(w[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    const px = w[2] === 'px' ? n : n * 16;
    const bp = Math.round(px);
    // A cliff is a cliff: the width just below it, the width itself, and
    // the width just above it.
    for (const x of [bp - 1, bp, bp + 1]) if (x > 0) widths.add(x);
  }
}

const list = [...widths].sort((a, b) => a - b);
if (process.argv.includes('--with-css')) console.error(`stylesheet: ${path}`);
console.log(list.join(','));
