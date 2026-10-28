/**
 * THE ENGINE'S OWN PROOF.
 *
 * A model that cannot be shown to fail is a model nobody can trust. These
 * checks are the same discipline as the spatial falsifier: each one plants a
 * defect, and the engine has to notice it.
 *
 *   node --experimental-strip-types src/domain/selftest.ts
 */

import { createPetState, decay, decayBehaviour, interact, observe, performChance, readiness, getBehaviour, happiness, communicate } from './pet';
import { applyRep, readinessToAdvance, recordRep, scheduleEffect, setCue, timingQuality, timingVerdict, nextApproximation, primaryCue } from './training';
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
/* The app tells the owner the window is 500ms. Past that window the marker
   predicts nothing, so the engine has to pay nothing either. A curve that
   still paid at 800ms while the panel said "far too late" was teaching the
   owner the wrong thing twice over. */
ok('a marker past the window teaches NOTHING', timingQuality(600) === 0);
ok('a marker just inside the window teaches a little', timingQuality(500) > 0);
ok(
  'the quality never rises as the marker gets later',
  timingQuality(100) >= timingQuality(300) && timingQuality(300) > timingQuality(500)
);

console.log('\nTHE SCHEDULE DECIDES WHO GETS PAID');
ok('every rep is paid for on a continuous schedule', scheduleEffect('continuous', 0).reinforced);
ok('only every third rep is paid for on a fixed ratio of three', !scheduleEffect('fixedRatio', 0).reinforced);
ok('the third rep of a fixed ratio is paid for', scheduleEffect('fixedRatio', 2).reinforced);
ok('an unpredictable schedule sometimes pays', scheduleEffect('variableRatio', 0, 0.1).reinforced);
ok('an unpredictable schedule sometimes does not', !scheduleEffect('variableRatio', 0, 0.9).reinforced);
/* An INTERVAL is a length of TIME. Implementing it as "every third rep" is a
   ratio wearing an interval's name, and it teaches the owner the wrong thing
   about the schedule they are on. */
ok('a fixed interval pays only once the interval has passed', !scheduleEffect('fixedInterval', 9, 0.1, 29_000).reinforced);
ok('a fixed interval pays after thirty seconds', scheduleEffect('fixedInterval', 9, 0.1, 30_000).reinforced);
ok('a variable interval gets likelier the longer you wait', !scheduleEffect('variableInterval', 0, 0.99, 0).reinforced);

console.log('\nONE REP, APPLIED');
const blank: Behaviour = {
  name: 'sit',
  strength: 0,
  reps: 0,
  performedReps: 0,
  repsSinceReinforcement: 0,
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

console.log('\nTHE COUNTER DOES NOT FREEZE WHEN THE HISTORY FILLS');
/* The counter used to be counted out of a forty-entry window. Once the window
   filled, every third rep stopped being paid — silently, and forever. */
let counted: Behaviour = { ...blank, schedule: 'fixedRatio' };
for (let i = 0; i < 45; i += 1) {
  counted = applyRep(counted, {
    behaviour: 'sit',
    real: true,
    performed: true,
    marked: true,
    delayMs: 100,
  }).behaviour;
}
ok(
  'the fixed ratio still pays after the history window fills',
  counted.repsSinceReinforcement < 3,
  `repsSince ${counted.repsSinceReinforcement}`
);
ok('a fixed ratio pays about a third of the reps', counted.reps > 10 && counted.reps < 20, `paid ${counted.reps}`);

console.log('\nTHE EXTINCTION CLOCK');
let ext2: Behaviour = {
  ...blank,
  strength: 0.8,
  lastReinforcedAt: new Date(Date.now() - 86_400_000).toISOString(),
};
const decayedOnce = decayBehaviour(ext2, Date.now());
ok('the strength stays a probability', decayedOnce.strength <= 1 && decayedOnce.strength >= 0, `got ${decayedOnce.strength}`);
ok(
  'decaying twice in the same moment gives the same number',
  decayBehaviour(decayedOnce, Date.now()).strength === decayedOnce.strength
);
let manyDecays = ext2;
for (let i = 0; i < 500; i += 1) manyDecays = decayBehaviour(manyDecays, Date.now());
ok('five hundred decays do not inflate the strength', manyDecays.strength <= 1, `got ${manyDecays.strength}`);
ok('five hundred decays do not erase it either', manyDecays.strength > 0.5, `got ${manyDecays.strength}`);

console.log('\nA REHEARSAL IS NOT A REAL REP');
const rehearsalState = createPetState();
const rehearsed = recordRep(rehearsalState, {
  behaviour: 'sit',
  real: false,
  performed: true,
  marked: true,
  delayMs: 100,
});
ok('a rehearsal does not move trust', rehearsed.state.trust === rehearsalState.trust, `trust ${rehearsed.state.trust}`);
ok('a rehearsal does not move the strength', rehearsed.state.behaviours.sit.strength === 0);
const realRep = recordRep(rehearsalState, {
  behaviour: 'sit',
  real: true,
  performed: true,
  marked: true,
  delayMs: 100,
});
ok('a real rep DOES move trust', realRep.state.trust > rehearsalState.trust);

console.log('\nTHE BODY GATES THE LEARNING');
const hungryDog = createPetState();
hungryDog.needs.hunger = 10;
hungryDog.needs.energy = 20;
const tiredRep = recordRep(hungryDog, {
  behaviour: 'sit',
  real: true,
  performed: true,
  marked: true,
  delayMs: 100,
});
const restedRep = recordRep(createPetState(), {
  behaviour: 'sit',
  real: true,
  performed: true,
  marked: true,
  delayMs: 100,
});
ok(
  'a hungry, exhausted dog learns less from the same rep',
  tiredRep.state.behaviours.sit.strength < restedRep.state.behaviours.sit.strength,
  `${tiredRep.state.behaviours.sit.strength} vs ${restedRep.state.behaviours.sit.strength}`
);
ok('a hungry dog is less ready than a fed one', readiness(hungryDog) < readiness(createPetState()));

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
/* The behaviour was last rewarded a day ago, and the decay is measured from
   that moment. A day without a reward should cost a little, not half. */
const burstState = { ...createPetState(), behaviours: { sit: ext } };
const afterOneDay = decay(burstState, Date.now());
ok('a behaviour nobody rewards fades', afterOneDay.behaviours.sit.strength < 0.8, `got ${afterOneDay.behaviours.sit.strength}`);
ok('a behaviour nobody rewards fades slowly at first', afterOneDay.behaviours.sit.strength > 0.7, `got ${afterOneDay.behaviours.sit.strength}`);
const afterAWeek = decay(burstState, Date.now() + 6 * 86_400_000);
ok('a behaviour nobody rewards for a week is mostly gone', afterAWeek.behaviours.sit.strength < 0.5, `got ${afterAWeek.behaviours.sit.strength}`);

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

console.log('\nTHE DOG IS NAMED, NOT ASSUMED');
// The notes are about a particular animal. A note that says "Expo" while the
// reader is holding Mali is a lie about who is being cared for; a note that
// says "he" for a female dog is a lie about the dog.
const expo = { name: 'Expo', sex: 'male' as const };
const mali = { name: 'Mali', sex: 'female' as const };
const said = communicate(createPetState(), 'dinner', Date.now(), mali);
ok('the note names the dog it is about', said.note.includes('Mali'), said.note);
ok('the note does not name some other dog', !said.note.includes('Expo'), said.note);

const tiredMale = { ...createPetState(), needs: { hunger: 70, energy: 20, hygiene: 85 } };
const maleNote = interact(tiredMale, 'play', Date.now(), expo).note;
const femaleNote = interact(tiredMale, 'play', Date.now(), mali).note;
ok('a male dog is described as he', maleNote.includes(' he '), maleNote);
ok('a female dog is described as she', femaleNote.includes(' she '), femaleNote);
ok('the note does not describe a female dog as he', !femaleNote.includes(' he '), femaleNote);

const approximation = nextApproximation('sit', mali);
ok('the coach speaks about the dog by name', approximation.includes('Mali'), approximation);

console.log('\nHAPPINESS IS COMPUTED, NOT STORED');
const content = createPetState();
const glad = interact(content, 'pet', Date.now(), expo).state;
ok('happiness rises when trust rises', happiness(glad) > happiness(content));
const starving = { ...content, needs: { hunger: 5, energy: 5, hygiene: 5 } };
ok('happiness is not a fourth bar', happiness(starving) < happiness(content));
ok('happiness stays a percentage', happiness(starving) >= 0 && happiness(starving) <= 100);

console.log('\nTHE CUE WORD IS STORED');
const cued = setCue(createPetState(), 'sit', 'Sit Down');
ok('the cue is stored on the behaviour', primaryCue(getBehaviour(cued, 'sit')) === 'sit down');
ok('the cue survives the state', getBehaviour(cued, 'sit').cues.includes('sit down'));
ok('a second cue does not duplicate the first', setCue(cued, 'sit', 'sit down').behaviours.sit.cues.length === 1);

console.log('\nTHE OBSERVATION LOG IS KEPT');
let logged = createPetState();
logged = observe(logged, { tag: 'nervousWithStrangers', at: new Date().toISOString() });
logged = observe(logged, { tag: 'soughtOutCompany', at: new Date().toISOString() });
ok('each observation is kept', logged.observations.length === 2, `got ${logged.observations.length}`);
ok('the log records what was seen', logged.observations[0].tag === 'nervousWithStrangers');
ok('the log is in order', logged.observations[1].tag === 'soughtOutCompany');

console.log('\nTIME PASSES');
const before = createPetState();
const later = decay(before, Date.now() + 3_600_000);
ok('an hour of drift makes a dog hungrier', later.needs.hunger < before.needs.hunger, `${later.needs.hunger} vs ${before.needs.hunger}`);
ok('drift does not touch the body it did not drift', later.needs.energy <= before.needs.energy);
ok('drift keeps the observation log', later.observations.length === before.observations.length);

console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures > 0) {
  throw new Error(`${failures} of ${checks} checks FAILED.`);
}
