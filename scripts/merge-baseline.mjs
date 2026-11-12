#!/usr/bin/env node
/**
 * MERGE RECEIPTS.
 *
 * The spatial gate writes one baseline per run. One run that sweeps three
 * routes and forty-eight widths is a hundred and forty-four cells in a row
 * on a machine that is running somebody else's servers and test suites, and
 * a cell measured while the machine is starved records NOTHING — an empty
 * chrome and no first action — which the receipt would then claim as a
 * measurement.
 *
 * An empty cell is worse than a missing cell: a missing one says "not
 * measured", an empty one says "measured, and there was nothing there".
 * So the routes are measured one at a time, each on its own receipt, and
 * the receipts are merged here. The merge REFUSES to write a receipt with
 * an empty cell in it.
 *
 *     node scripts/merge-baseline.mjs out.json a.json b.json c.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [out, ...inputs] = process.argv.slice(2);
if (!out || !inputs.length) {
  console.error('usage: merge-baseline.mjs OUT.json IN.json [IN.json ...]');
  process.exit(2);
}

const receipts = inputs.map((f) => JSON.parse(readFileSync(f, 'utf8')));

const merged = {
  version: receipts[0].version ?? 2,
  tool: receipts[0].tool ?? 'spatial-law',
  widths: receipts[0].widths ?? [],
  measuredWidths: receipts[0].measuredWidths ?? [],
  limits: receipts[0].limits ?? {},
  reasons: {},
  exempt: receipts[0].exempt ?? [],
  provenance: {},
  routes: {},
};

for (const receipt of receipts) {
  for (const [route, widths] of Object.entries(receipt.routes ?? {})) {
    merged.routes[route] = { ...(merged.routes[route] ?? {}), ...widths };
  }
  Object.assign(merged.reasons, receipt.reasons ?? {});
  merged.measuredWidths = [
    ...new Set([...(merged.measuredWidths ?? []), ...(receipt.measuredWidths ?? [])]),
  ].sort((a, b) => a - b);
}

/* A cell that measured nothing is not a measurement, and it is not written
   into the receipt. Count them, and refuse to write a receipt that has
   any. */
const empty = [];
for (const [route, widths] of Object.entries(merged.routes)) {
  for (const [width, cell] of Object.entries(widths)) {
    const action = cell.firstAction ?? {};
    if (action.y === null || action.y === undefined) empty.push(`${route} @${width}px`);
  }
}

const cells = Object.values(merged.routes).reduce((n, w) => n + Object.keys(w).length, 0);
merged.provenance = {
  measuredAt: new Date().toISOString(),
  measurements: cells,
  routes: Object.keys(merged.routes).length,
  widths: merged.measuredWidths.length,
  measuredTogether: false,
  carriedOver: inputs.map((f) => f.split('/').pop()),
};

if (empty.length) {
  console.error(`REFUSING TO WRITE — ${empty.length} cell(s) measured nothing:`);
  for (const e of empty) console.error(`  · ${e}`);
  console.error('Re-measure those routes on their own and merge again.');
  process.exit(1);
}

writeFileSync(out, JSON.stringify(merged, null, 2) + '\n');
console.log(`merged ${cells} cells across ${Object.keys(merged.routes).length} routes -> ${out}`);
