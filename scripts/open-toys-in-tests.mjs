#!/usr/bin/env node
/**
 * OPEN THE TOYS BEFORE USING A TOY.
 *
 * The dog's tricks live behind a disclosure. A test that reaches for
 * "Find the treat" without opening the toys is asking for a button that is
 * deliberately not there yet, and the test fails on a product that is
 * behaving exactly as designed.
 *
 * This script inserts the call as a WHOLE STATEMENT on its own line before
 * the toy interaction, checks that the file still parses, and refuses to
 * touch a file it cannot parse. The earlier attempt at this was done with a
 * regex, and it dropped the call inside an `if` condition and left the suite
 * with a syntax error — which is the failure this script is built to make
 * impossible.
 *
 *     node scripts/open-toys-in-tests.mjs            # report what it would do
 *     node scripts/open-toys-in-tests.mjs --apply     # do it
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const DIR = 'scripts';

// The toy controls that live behind the disclosure.
const TOY_NAMES = [
  'Happy wiggle', 'Zoomies', 'Play bow', 'Come closer',
  'Turn around', 'Find the treat', 'High five',
];

// A toy interaction: a click on a control named one of the toys, or a loop
// over them by label.
const TOY_PATTERN = new RegExp(
  `getByRole\\('button',\\s*\\{name:\\s*(?:'(${TOY_NAMES.join('|')})'|label)`,
);

const files = readdirSync(DIR).filter((f) => f.startsWith('test-') && f.endsWith('.cjs'));

let changed = 0;
for (const file of files) {
  const path = `${DIR}/${file}`;
  let source = readFileSync(path, 'utf8');
  if (source.includes('open-toys.cjs')) continue;

  const lines = source.split('\n');
  const pageVar = /\b(p|page)\.getByRole\(/.test(source) ? (/\bp\.getByRole\(/.test(source) ? 'p' : 'page') : null;
  if (!pageVar) continue;

  const target = lines.findIndex((line) => TOY_PATTERN.test(line));
  if (target < 0) continue;

  // The call must go on a statement boundary. A file whose statements run
  // across several lines — the compact ones — has no such boundary here, and
  // a line inserted into the middle of a statement is a syntax error. Those
  // files are reported and left alone.
  let boundary = target - 1;
  while (boundary >= 0 && lines[boundary].trim() === '') boundary -= 1;
  const previous = boundary >= 0 ? lines[boundary].trim() : '';
  const startsStatement = /[;{}]$/.test(previous);
  if (!startsStatement) {
    console.log(`SKIP ${file}: no statement boundary before line ${target + 1}`);
    continue;
  }

  // The call goes on its own line, before the statement that needs it.
  const insert = `await openToys(${pageVar});`;
  if (lines[target].includes(insert)) continue;
  const patched = [
    ...lines.slice(0, target),
    insert,
    ...lines.slice(target),
  ].join('\n');

  // The import goes at the top, after any 'use strict'.
  const withImport = `const{openToys}=require('./fixtures/open-toys.cjs');\n${patched}`;

  // It must parse. A test net that does not parse is a test net that is
  // not a test net.
  //
  // The check is done on a TEMP FILE, not on stdin: `node --check <path>`
  // reads the file and ignores what arrives on stdin, so checking that way
  // validates the ORIGINAL file and passes anything. That is how a broken
  // patch slipped through once.
  const temp = `${path}.patched.cjs`;
  try {
    writeFileSync(temp, withImport);
    execFileSync(process.execPath, ['--check', temp], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    console.error(`SKIP ${file}: the patched file does not parse — ${String(error.stderr || error.message).split('\n')[0]}`);
    continue;
  } finally {
    try { unlinkSync(temp); } catch {}
  }

  changed += 1;
  console.log(`${APPLY ? 'patched' : 'would patch'} ${file} (line ${target + 1})`);
  if (APPLY) writeFileSync(path, withImport);
}

console.log(changed ? `${changed} file(s) ${APPLY ? 'patched' : 'to patch'}` : 'nothing to patch');
