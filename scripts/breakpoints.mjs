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
 *     node scripts/breakpoints.mjs             # the widths, comma separated
 *     node scripts/breakpoints.mjs --with-css  # plus where the CSS lives
 */
import { readdirSync, readFileSync } from 'node:fs';

const DIST = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'dist';

const dir = `${DIST}/assets`;
const files = readdirSync(dir).filter((f) => f.endsWith('.css')).sort();
if (!files.length) {
  console.error(`No stylesheet in ${dir}. Build first: npm run build`);
  process.exit(1);
}
const paths = files.map(file => dir + '/' + file);
const text = paths.map(file => readFileSync(file, 'utf8')).join('\n');

const widths = new Set();
for (const m of text.matchAll(/@(media|container)([^{]*)\{/g)) {
  for (const w of m[2].matchAll(/\((?:min|max)-width:\s*([\d.]+)(px|rem|em)\)/g)) {
    const n = parseFloat(w[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    const px = w[2] === 'px' ? n : n * 16;
    const bp = Math.round(px);
    // A cliff is a cliff: the width just below it, the width itself, and
    // the width just above it.
    for (const x of [bp - 1, bp, bp + 1]) if (x > 0) widths.add(x);
  }
}

/* THE CONTAINER CLIFFS.
 *
 * A container query changes the layout when the CONTAINER reaches a width,
 * not when the viewport does. The care panel is ten pixels narrower than
 * the viewport on a phone (the workspace's padding), so a container cliff
 * at 279px is a viewport of 289px — and a sweep that visits only viewport
 * breakpoints steps straight over it. The instrument names these cliffs
 * when the sweep misses one, so the widths it asks for live here.
 */
const CONTAINER_CLIFF_VIEWPORTS = [289, 290, 350, 610];

if (process.argv.includes('--with-css')) console.error("stylesheets: " + paths.join(", "));
console.log(
  [...new Set([...widths, ...CONTAINER_CLIFF_VIEWPORTS])].sort((a, b) => a - b).join(','),
);
