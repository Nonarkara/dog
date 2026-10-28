/**
 * THE ENGINE'S OWN PROOF.
 *
 * A model that cannot be shown to fail is a model nobody can trust. These
 * checks are the same discipline as the spatial falsifier: each one plants a
 * defect, and the engine has to notice it.
 *
 *   node --experimental-strip-types src/domain/selftest.ts
 */

import { createPetState, decay, interact, observe, performChance, readiness, getBehaviour } from './pet';
import { applyRep, readinessToAdvance, scheduleEffect, timingQuality, timingVerdict } from './training';
import type { Behaviour, PetState } from './types';

let failures = 0;
let checks = 0;

function ok(label: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function near(a: number, b: number, tolerance = 1e-6): boolean {
  return Math.abs(a - b) <= tolerance;
}

console.log('\nTHE TIMING OF THE MARKER');
ok('a marker on time is worth the most', timingQuality(100) === 1);
ok('a marker half a second late still teaches, weakly', timingQuality(500) > 0 && timingQuality(500) < 1);
ok('a marker a second late teaches nothing', timingQuality(1000) === 0);
ok('no marker at all teaches nothing', timingQuality(undefined) === 0);
ok('the verdict names the problem', timingVerdict(800).includes('late'));

console.log('\nTHE SCHEDULE DECIDES WHO GETS PAID');
ok('every rep is paid for on a continuous schedule', scheduleEffect('continuous', 0).reinforced);
ok('only every third rep is paid for on a fixed ratio of three', !scheduleEffect('fixedRatio', 0).reinforced);
ok('the third rep of a fixed ratio is paid for', scheduleEffect('fixedRatio', 2).reinforced);
ok('an unpredictable schedule sometimes pays', scheduleEffect('variableRatio', 0, 0.1).reinforced);
ok('an unpredictable schedule sometimes does not', !scheduleEffect('variableRatio', 0, 0.9).reinforced);

console.log('\nONE REP, APPLIED');
const blank: Behaviour = {
  name: 'sit',
  strength: 0,
  reps: 0,
  rehearsals: 0,
  markerDelayMs: 0,
  schedule: 'continuous',
  cues: [],
  history: [],
};

const good = applyRep(blank, { behaviour: 'sit', real: true, performed: true, marked: true, delayMs: 100 });
ok('a real, well-timed, rewarded rep raises the strength', good.behaviour.strength > 0);
ok('a real rewarded rep counts as a rep', good.behaviour.reps === 1);
ok('the strength never passes one', good.behaviour.strength <= 1);

const late = applyRep(blank, { behaviour: 'sit', real: true, performed: true, marked: true, delayMs: 900 });
ok('a late marker raises it less than an on-time one', late.behaviour.strength < good.behaviour.strength);

const rehearsal = applyRep(blank, { behaviour: 'sit', real: false, performed: true, marked: true, delayMs: 100 });
ok('a rehearsal does NOT raise the strength', rehearsal.behaviour.strength === 0, `got ${rehearsal.behaviour.strength}`);
ok('a rehearsal does NOT count as a rep', rehearsal.behaviour.reps === 0);
ok('a rehearsal is still recorded as a rehearsal', rehearsal.behaviour.rehearsals === 1);

// Erosion is only visible on a behaviour that has something to erode, so
// these start from a trained one.
const trainedBase: Behaviour = { ...blank, strength: 0.5 };
const unmarked = applyRep(trainedBase, { behaviour: 'sit', real: true, performed: true, marked: false });
ok('a performed but unmarked rep erodes it', unmarked.behaviour.strength < 0.5, `got ${unmarked.behaviour.strength}`);
ok('a performed but unmarked rep is not a rep', unmarked.behaviour.reps === 0);

const failed = applyRep(trainedBase, { behaviour: 'sit', real: true, performed: false, marked: false });
ok('a failure erodes it more than an unmarked success', failed.behaviour.strength < unmarked.behaviour.strength);
ok('nothing erodes below zero', applyRep({ ...blank, strength: 0.01 }, { behaviour: 'sit', real: true, performed: false, marked: false }).behaviour.strength === 0);

console.log('\nDIMINISHING RETURNS');
let s: Behaviour = { ...blank };
for (let i = 0; i < 40; i += 1) {
  s = applyRep(s, { behaviour: 'sit', real: true, performed: true, marked: true, delayMs: 100 }).behaviour;
}
ok('the strength converges below one', s.strength < 1, `got ${s.strength}`);
ok('the strength converged high', s.strength > 0.8, `got ${s.strength}`);

console.log('\nTHE BODY GATES THE LEARNING');
let state: PetState = createPetState();
const rested = readiness(state);
state = interact(state, 'play').state; // burns energy
state = interact(state, 'play').state;
const tired = readiness(state);
ok('a tired dog is less ready than a rested one', tired < rested, `${tired.toFixed(3)} vs ${rested.toFixed(3)}`);

const chanceRested = performChance(createPetState(), getBehaviour(createPetState(), 'sit'));
ok('a behaviour that does not exist yet has no chance', chanceRested === 0);

let trained = createPetState();
trained.behaviours.sit = { ...blank, strength: 0.8 };
const readyChance = performChance(trained, trained.behaviours.sit);
ok('a trained behaviour has a real chance of happening', readyChance > 0.2, `got ${readyChance}`);

console.log('\nEXTINCTION');
let ext: Behaviour = { ...blank, strength: 0.8, lastReinforcedAt: new Date(Date.now() - 86_400_000).toISOString() };
const decayed = decay(createPetState(), Date.now());
void decayed;
const burstState = { ...createPetState(), behaviours: { sit: ext } };
const afterOneDay = decay(burstState, Date.now() + 86_400_000);
ok('a behaviour nobody rewards fades', afterOneDay.behaviours.sit.strength < 0.8, `got ${afterOneDay.behaviours.sit.strength}`);
ok('a behaviour nobody rewards fades slowly at first', afterOneDay.behaviours.sit.strength > 0.7, `got ${afterOneDay.behaviours.sit.strength}`);

console.log('\nTHE CARE LOOP HAS CONSEQUENCES');
// `hunger` is fullness: 100 is a full belly, 30 an empty one.
const hungry = createPetState();
hungry.needs.hunger = 30;
const fed = interact(hungry, 'feed').state;
ok('feeding a hungry dog fills him', fed.needs.hunger > hungry.needs.hunger, `got ${fed.needs.hunger}`);
const full = createPetState();
full.needs.hunger = 90;
const fedWhenFull = interact(full, 'feed').state;
ok('feeding a full dog lowers the value of food as a reward', fedWhenFull.personality.foodDrive < full.personality.foodDrive);
const petted = interact(createPetState(), 'pet').state;
ok('petting without a request raises trust', petted.trust > 60);

console.log('\nTHE OBSERVATION LOG MOVES THE PERSONALITY');
const observed = observe(createPetState(), { tag: 'nervousWithStrangers', at: new Date().toISOString() });
ok('a dog seen as nervous becomes more sensitive', observed.personality.sensitivity > 0.2);
ok('a dog seen as nervous becomes less sociable', observed.personality.sociability < 0);

console.log('\nTHE STAGE OF THE CURRICULUM');
const beginner = readinessToAdvance({ ...blank, strength: 0.3 });
ok('an unreliable behaviour does not advance', !beginner.advance);
const reliable = readinessToAdvance({ ...blank, strength: 0.9 });
ok('a reliable behaviour moves off the continuous schedule', reliable.advance);
const midRatio = readinessToAdvance({ ...blank, strength: 0.9, schedule: 'fixedRatio', reps: 3 });
ok('a behaviour on every third rep stays there until there are a dozen', !midRatio.advance);

console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures > 0) {
  throw new Error(`${failures} of ${checks} checks FAILED.`);
}
