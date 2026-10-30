import {growCompanion,growthStage} from './growth';
import {gameState,buyFood,takeMeal,fetchLearned,discoverTouch,socialize,completeParkWalk,TOUCH_PREFERENCES} from './companionGame';
import {DOG_BEHAVIOURS,behaviourPool,chooseBehaviour} from '../components/dogBehaviour';
import {newIdle,stepIdle,idlePool,idleWeight, type IdleContext} from '../components/fallbackIdle';
import {recordSources,recordExport} from '../utils/recordProvenance';
import {DEFAULT_DOGS} from '../data/defaultDogs';
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
import { dailyLife, dailyMood } from './dailyLife';
import { settleSleep, willSettle } from './pet';
import { coatColorAt } from './coat';
import { chooseActivity, type Activity } from './parkPersonality';
import { newRoomName, parseClient, validRoom, withinRate, RATE_LIMIT, WORLD } from './parkProtocol';
import { addTogether, answerCall, tickCall, CALL_FADES_MS } from './attention';
import { dogResponds, newLesson, scoreTrial, practiceSession, endPracticeSession, type Lesson } from './lesson';

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
ok('a marker at 500ms earns partial game timing credit', timingQuality(500) > 0 && timingQuality(500) < 1);
ok('a marker at 1000ms earns no game timing credit', timingQuality(1000) === 0);
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
const fedWhenFull = interact(full, 'feed',full.updatedAt).state;
ok('a full belly saves the meal instead of overfeeding or erasing training',fedWhenFull.needs.hunger===full.needs.hunger&&gameState(fedWhenFull).portions===gameState(full).portions&&JSON.stringify(fedWhenFull.behaviours)===JSON.stringify(full.behaviours));
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
const driftNoon=new Date(2026,9,29,12).getTime();
const before = createPetState(driftNoon);
const later = decay(before, driftNoon + 3_600_000);
ok('an hour of drift makes a dog hungrier', later.needs.hunger < before.needs.hunger, `${later.needs.hunger} vs ${before.needs.hunger}`);
ok('drift does not touch the body it did not drift', later.needs.energy <= before.needs.energy);
ok('drift keeps the observation log', later.observations.length === before.observations.length);

console.log('\nTHE COAT');
const expoCoat = { base: '#ece7de', light: '#f8f6f1', dark: '#211c18', point: '#9a6c43' };
const lum = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
ok('Expo is white at the chest', lum(coatColorAt('mane', 0, 0, 0.3, 'bangkaew', expoCoat)) > 0.85);
ok('Expo is dark on the saddle', lum(coatColorAt('torso', 0, 0.3, -0.1, 'bangkaew', expoCoat)) < 0.35);
ok('the blaze is white between the eyes', lum(coatColorAt('head', 0, 0.15, 0.25, 'bangkaew', expoCoat)) > 0.7);
ok('a solid dog has no saddle', lum(coatColorAt('torso', 0, 0.3, -0.1, 'solid', expoCoat)) > 0.8);
let darkSpots = 0;
for (let i = 0; i < 400; i++) {
  const [x, y, z] = [((i * 37) % 20) / 25 - 0.4, ((i * 13) % 20) / 25 - 0.4, ((i * 7) % 20) / 25 - 0.4];
  if (lum(coatColorAt('mane', x, y, z, 'spotted', expoCoat)) < 0.4) darkSpots++;
}
ok('a spotted coat has spots, and is mostly not spots', darkSpots > 20 && darkSpots < 250, `${darkSpots}/400 dark`);

import {bodyPoseFor,trainingMotion} from '../components/trainingMotion';
const sessionDog={...createPetState(),lessons:{sit:{...newLesson(),skill:.87,stage:2 as const,streak:4,sessionTrials:8,sessionStartedAt:1000},down:{...newLesson(),sessionTrials:7,sessionStartedAt:2000}}};
const ended=endPracticeSession(sessionDog);
ok('session advice counts practice across behaviors',practiceSession(sessionDog.lessons).sessionTrials===15&&practiceSession(sessionDog.lessons).sessionStartedAt===1000);
ok('a practice break clears all session clocks and trial counts',practiceSession(ended.lessons).sessionTrials===0&&practiceSession(ended.lessons).sessionStartedAt===undefined);
ok('a break preserves stages, learned skill and real logs',ended.lessons?.sit?.skill===.87&&ended.lessons?.sit?.stage===2&&ended.behaviours===sessionDog.behaviours&&ended.observations===sessionDog.observations);
ok('a break clears consecutive misses and streaks',ended.lessons?.sit?.streak===0&&ended.lessons?.sit?.misses===0);
const sourceExpo=structuredClone(DEFAULT_DOGS[0]),sourceBefore=JSON.stringify(sourceExpo),starterSource=recordSources(sourceExpo);
ok('unchanged starter clinical fields and entries are identified',starterSource.fields.includes('microchipId')&&starterSource.fields.includes('weightKg')&&starterSource.vaccinations.length===sourceExpo.vaccinations.length);
const ownerSource={...sourceExpo,weightKg:19.5,microchipId:'owner-chip',birthDate:'2022-03-02',vaccinations:sourceExpo.vaccinations.map((v,i)=>i? v:{...v,clinic:'Owner clinic'})};
ok('owner edits remain distinct from exact starter examples',!recordSources(ownerSource).fields.includes('weightKg')&&!recordSources(ownerSource).fields.includes('birthDate')&&!recordSources(ownerSource).vaccinations.includes(ownerSource.vaccinations[0].id));
ok('Mali sterilisation is a supplied fact, not a starter assumption',!recordSources(DEFAULT_DOGS.find(d=>d.id==='mali-2022')!).fields.includes('isNeutered'));
const sourceExport=recordExport(sourceExpo);
ok('source detection and export preserve every original value',JSON.stringify(sourceExpo)===sourceBefore&&sourceExport.vaccinations===sourceExpo.vaccinations&&sourceExport.medicalHistory===sourceExpo.medicalHistory&&sourceExport.microchipId===sourceExpo.microchipId);
ok('record export carries unverified-source qualification',sourceExport.recordSources.notice.includes('unverified')&&sourceExport.recordSources.starterExamples.fields.includes('microchipId'));
const idleContext:IdleContext={reduced:false,asleep:false,sick:false,busy:false,standing:true,energy:.8,trust:.9,arousal:.8,fullness:.8};
let lifeIdle=newIdle(()=>.5);for(let t=0;t<60;t+=.05)lifeIdle=stepIdle(lifeIdle,t,idleContext,()=>.5);
ok('fallback idle theatre repeats after completed acts and quiet intervals',lifeIdle.starts>=5);
const bowIdle=stepIdle(newIdle(()=>0),3,idleContext,()=>.99),endedBow=stepIdle(bowIdle,3+bowIdle.dur+.01,idleContext,()=>.99);
ok('finished bow clears its state and tail override',bowIdle.name==='bow'&&endedBow.name==='none'&&idleWeight(endedBow,6)===0);
ok('tired or low-trust dogs cannot select playful bow or hop',!idlePool({...idleContext,energy:.1}).includes('bow')&&!idlePool({...idleContext,trust:.2}).includes('hop'));
let asleepIdle=stepIdle(newIdle(),0,{...idleContext,asleep:true});
const deferredWake=stepIdle(asleepIdle,1,{...idleContext,busy:true}),freeWake=stepIdle(deferredWake,3,idleContext);
ok('wake stretch waits until care finishes',deferredWake.name==='none'&&deferredWake.wakePending&&freeWake.name==='stretch');
ok('reduced motion suppresses waking stretch',stepIdle(asleepIdle,1,{...idleContext,reduced:true}).name==='none');
ok('training/calm/sickness interrupt active idle motion',stepIdle(bowIdle,3.5,{...idleContext,busy:true}).name==='none'&&stepIdle(bowIdle,3.5,{...idleContext,sick:true}).name==='none');
console.log('\nTHE PRACTICE FIELD');
const L: Lesson = { ...newLesson(), stage: 3, skill: 0.5 };
const clean = scoreTrial(L, { responded: true, cueCount: 1, markDelayMs: 100, treatDelayMs: 800 });
ok('cue once, mark on time, treat on time: full marks', clean.score === 1 && clean.lesson.skill > L.skill);
const early = scoreTrial(L, { responded: true, cueCount: 1, markDelayMs: -200, treatDelayMs: 800 });
ok('a marker before he finishes pays for "almost"', early.score < 0.2 && early.lesson.skill < L.skill);
const beforeDone=scoreTrial(L,{responded:false,cueCount:1,markedBeforeCompletion:true,treatDelayMs:100});
ok('an early marker can still be rewarded without a false no-response success',beforeDone.score===.1&&beforeDone.lesson.misses===L.misses&&beforeDone.lesson.streak===0);
const earlyTreat=scoreTrial(L,{responded:false,cueCount:1,prematureReward:true});
ok('premature food never earns patient-waiting credit',earlyTreat.score===0&&earlyTreat.lesson.skill===L.skill);
ok('down has its own pose and wait holds a sit',bodyPoseFor('down')==='down'&&bodyPoseFor('wait')==='sit');
ok('fetch moves out, returns and carries the toy',trainingMotion('fetch',900).x>.6&&Math.abs(trainingMotion('fetch',1800).x)<.001&&trainingMotion('fetch',1800).carrying&&trainingMotion('fetch',1800).done);
ok('come approaches before completion',trainingMotion('come',0).scale<trainingMotion('come',1000).scale&&!trainingMotion('come',500).done);
ok('stay needs a completed hold even in reduced motion',!trainingMotion('stay',999,true).done&&trainingMotion('stay',1000,true).done);
ok('reduced motion removes fetch travel but retains completion and toy',trainingMotion('fetch',0,true).x===0&&trainingMotion('fetch',0,true).done&&trainingMotion('fetch',0,true).toy);
const twice = scoreTrial(L, { responded: true, cueCount: 2, markDelayMs: 100, treatDelayMs: 800 });
ok('saying the cue twice costs you', twice.score < clean.score && twice.lesson.skill < clean.lesson.skill);
const noTreat = scoreTrial(L, { responded: true, cueCount: 1, markDelayMs: 100 });
ok('a marker with no treat breaks the promise', noTreat.score < 0.3 && noTreat.trustDelta < 0);
const tooLate = scoreTrial(L, { responded: true, cueCount: 1, markDelayMs: 900, treatDelayMs: 800 });
ok("a late marker earns no game skill gain", tooLate.score === 0 && tooLate.lesson.skill === L.skill);
const miss1 = scoreTrial(L, { responded: false, cueCount: 1 });
const miss2 = scoreTrial(miss1.lesson, { responded: false, cueCount: 1 });
ok('two misses in a row step back a stage', miss2.lesson.stage === 2 && miss2.stageChange === -1);
let up: Lesson = { ...newLesson(), stage: 1, skill: 0.79 };
for (let i = 0; i < 6; i++) up = scoreTrial(up, { responded: true, cueCount: 1, markDelayMs: 80, treatDelayMs: 500 }).lesson;
ok('five clean reps at 80% move up a stage', up.stage === 2);
ok('a lure works far more often than a new word', dogResponds({ ...newLesson(), stage: 0 }, 0.8, 0.6).responds && !dogResponds({ ...newLesson(), stage: 3 }, 0.8, 0.6).responds);

console.log('\nATTENTION');
const noon = new Date(2026, 9, 29, 12).getTime();
const t1 = addTogether(undefined, 60, noon);
const t2 = addTogether(t1, 60, noon + 1000);
const t3 = addTogether(t2, 15, noon + 86_400_000);
const t4 = addTogether(t3, 15, noon + 3 * 86_400_000);
ok('time adds up within a day', t2.todaySec === 120 && t2.totalSec === 120);
ok('the next day continues the streak and resets today', t3.streak === 2 && t3.todaySec === 15 && t3.totalSec === 135);
ok('a missed day breaks the streak', t4.streak === 1);
const callingDog: PetState = { ...createPetState(noon), needs: { hunger: 20, energy: 80, hygiene: 80 } };
const called = tickCall(callingDog, noon);
ok('a hungry dog calls you', called.started && called.call?.reason === 'hungry');
const withCall: PetState = { ...callingDog, call: called.call };
ok('feeding him answers the call, with a bonus for coming quickly', answerCall(withCall, 'feed', noon + 60_000).trustBonus === 3);
ok('petting him does not answer a hungry call', !answerCall(withCall, 'pet', noon).answered);
ok('an ignored call fades, unpunished', tickCall(withCall, noon + CALL_FADES_MS + 1).call === undefined);
ok('a sleeping dog does not call', !tickCall({ ...callingDog, sleep: { ...callingDog.sleep, asleep: true } }, noon).started);

console.log('\nTAMAGOTCHI MVP CONSEQUENCES');
const messyState: PetState = { ...createPetState(noon), poopCount: 2, needs: { hunger: 80, energy: 80, hygiene: 20 } };
ok('poop reduces happiness', happiness(messyState) < happiness(createPetState(noon)));
const cleaned = interact(messyState, 'clean', noon);
ok('cleaning clears all mess from stage', cleaned.state.poopCount === 0 && cleaned.state.needs.hygiene > messyState.needs.hygiene);

const sickState: PetState = { ...createPetState(noon), sick: true, sickSince: noon };
ok('a sick dog has zero readiness for training', readiness(sickState) === 0);
ok('a sick dog cannot play', interact(sickState, 'play', noon).note.includes('sick'));
const cured = interact(sickState, 'medicine', noon);
ok('medicine cures sickness and restores readiness', !cured.state.sick && readiness(cured.state) > 0);

const tantrumDog: PetState = {
  ...createPetState(noon),
  discipline: 40,
  needs: { hunger: 90, energy: 85, hygiene: 85 },
  call: { reason: 'tantrum', since: noon },
};
const oldScold = interact(tantrumDog, 'scold', noon);
ok('legacy scold callers safely start quiet time without reward or punishment',oldScold.state.trust===tantrumDog.trust&&oldScold.state.discipline===40&&oldScold.state.calmSince===noon);
const quiet=interact(tantrumDog,'settle',noon).state;
ok('quiet time offers rest without inventing training progress',quiet.calmSince===noon&&quiet.trust===tantrumDog.trust&&JSON.stringify(quiet.behaviours)===JSON.stringify(tantrumDog.behaviours));
const earlyCalm=interact(quiet,'rewardCalm',noon+2000).state;
ok('a reward before relaxed observation earns nothing',near(earlyCalm.trust,decay(quiet,noon+2000).trust)&&earlyCalm.discipline===40);
const rewardedCalm=interact(quiet,'rewardCalm',noon+3000).state;
ok('observing then rewarding calm increases virtual calm and trust',rewardedCalm.discipline===45&&near(rewardedCalm.trust,decay(quiet,noon+3000).trust+2));
ok('calm reward clears the legacy activity call',rewardedCalm.call===undefined);
ok('calm practice never writes real training reps',JSON.stringify(rewardedCalm.behaviours)===JSON.stringify(tantrumDog.behaviours)&&rewardedCalm.lastRealSessionAt===undefined);
ok('one calm observation pays only once',interact(rewardedCalm,'rewardCalm',noon+3000).state.trust===rewardedCalm.trust);
const repeatQuiet=interact(rewardedCalm,'settle',noon+4000).state;
ok('restarting quiet time cannot bypass the calm reward cooldown',interact(repeatQuiet,'rewardCalm',noon+7000).state.discipline===45);
ok('a later calm observation can earn another bounded reward',interact(repeatQuiet,'rewardCalm',noon+63000).state.discipline===50);
const distractedCalm=interact(quiet,'play',noon+1000).state;
ok('play cancels the calm observation',distractedCalm.calmSince===undefined&&interact(distractedCalm,'rewardCalm',noon+4000).state.discipline===40);
ok('a cue cancels calm observation',communicate(quiet,'come',noon+1000).state.calmSince===undefined);
const needsFirst=[{...quiet,sick:true},{...quiet,sleep:{...quiet.sleep,asleep:true,fellAsleepAt:noon}},{...quiet,needs:{...quiet.needs,hunger:10}},{...quiet,needs:{...quiet.needs,energy:10}},{...quiet,poopCount:1},{...quiet,life:{...dailyLife(quiet),bladder:90}}];
ok('unmet needs never earn a calm reward',needsFirst.every(s=>interact(s,'rewardCalm',noon+3000).state.discipline===40));
ok('quiet practice never wakes a sleeping dog',interact(needsFirst[1],'settle',noon+3000).state.sleep.asleep);
ok('excitement is not mistaken for relaxed posture',interact({...quiet,arousal:90},'rewardCalm',noon+3000).state.discipline===40);
ok('a full meal does not punish the virtual calm score',interact(tantrumDog,'feed',noon).state.discipline===40);
ok('low calm score alone does not create a misbehaviour call',tickCall({...tantrumDog,call:undefined,discipline:0},noon).call===undefined);
ok('excitement calls can be answered with a sniff walk',answerCall(tantrumDog,'walk',noon).answered&&!answerCall(tantrumDog,'scold',noon).answered);

console.log('\nA DAY OF ITS OWN');
const minute=60_000;
const lifeStart=createPetState(noon);
const stepLife=(base:PetState,n:number)=>{let s=base;for(let i=1;i<=n;i++)s=decay(s,base.updatedAt+i*minute);return s;};
const liveDay=stepLife(lifeStart,90),offlineDay=decay(lifeStart,noon+90*minute);
ok('small ticks produce droppings while the app stays open',liveDay.poopCount===1);
ok('small ticks produce two puddles in 90 awake minutes',dailyLife(liveDay).peeCount===2);
ok('offline and minute ticks agree on bladder',near(dailyLife(liveDay).bladder,dailyLife(offlineDay).bladder,1e-5));
ok('offline and minute ticks agree on digestion',near(dailyLife(liveDay).digestionMinutes,dailyLife(offlineDay).digestionMinutes,1e-5));
ok('repeating a tick cannot create another mess',decay(liveDay,liveDay.updatedAt).poopCount===liveDay.poopCount&&dailyLife(decay(liveDay,liveDay.updatedAt)).peeCount===2);
const needsToilet={...lifeStart,life:{...dailyLife(lifeStart),bladder:85}};
ok('toilet pressure is visible before an accident',dailyMood(needsToilet)==='toilet'&&tickCall(needsToilet,noon).call?.reason==='toilet');
const relieved=interact(needsToilet,'walk',noon).state;
ok('a walk relieves bladder without spawning an indoor puddle',dailyLife(relieved).bladder===0&&dailyLife(relieved).peeCount===0);
const dull={...lifeStart,life:{...dailyLife(lifeStart),boredom:80}};
ok('boredom becomes a call and visible mood',dailyMood(dull)==='bored'&&tickCall(dull,noon).call?.reason==='bored');
ok('company reduces boredom',dailyLife(interact(dull,'pet',noon).state).boredom===55);
ok('play resolves boredom',dailyLife(interact(dull,'play',noon).state).boredom===15);
const peeOnly={...lifeStart,life:{...dailyLife(lifeStart),peeCount:2}};
ok('puddles can be cleaned even without poop',dailyLife(interact(peeOnly,'clean',noon).state).peeCount===0);
const sleepingMess={...peeOnly,sleep:{...lifeStart.sleep,asleep:true,fellAsleepAt:noon}};
ok('cleaning does not wake a sleeping dog',interact(sleepingMess,'clean',noon).state.sleep.asleep);
ok('sleep slows bladder filling',dailyLife(decay(sleepingMess,noon+20*minute)).bladder<dailyLife(decay(lifeStart,noon+20*minute)).bladder);
const bedtime=settleSleep(lifeStart,noon).state;
ok('a restored daytime nap ends naturally',!decay(bedtime,noon+61*minute).sleep.asleep);
ok('automatic waking has no manual-wake penalty',decay(bedtime,noon+61*minute).sleep.wakeCount===0);
ok('a tired dog will settle on its own',willSettle({...lifeStart,needs:{...lifeStart.needs,energy:10}},noon));
const prolongedHunger={...lifeStart,needs:{...lifeStart.needs,hunger:5},life:{...dailyLife(lifeStart),lowFullnessMinutes:179}};
ok('prolonged low fullness gets sick across small ticks',stepLife(prolongedHunger,2).sick);
ok('sickness is more visible than boredom',dailyMood({...dull,sick:true})==='sick');
const oldSave={...lifeStart,life:undefined};
ok('older saves gain safe daily defaults',dailyLife(oldSave).bladder===0&&dailyLife(oldSave).peeCount===0);
ok('care never mutates a different dog state',dailyLife(needsToilet).bladder===85&&dailyLife(peeOnly).peeCount===2);
ok('a new urgent sickness replaces an old boredom call',tickCall({...dull,sick:true,call:{reason:'bored',since:noon}},noon).call?.reason==='sick');

const filthyStart={...lifeStart,needs:{...lifeStart.needs,hygiene:35}};
const filthyOffline=decay(filthyStart,noon+180*minute),filthyTicks=stepLife(filthyStart,180);
ok('mess created during offline time affects hygiene at the right time',near(filthyOffline.needs.hygiene,filthyTicks.needs.hygiene,.001));
let frequentPets=lifeStart;for(let i=1;i<=20;i++)frequentPets=interact(frequentPets,'pet',noon+i*9000).state;
ok('frequent care cannot stop the bladder clock',near(dailyLife(frequentPets).bladder,dailyLife(decay(lifeStart,noon+3*minute)).bladder,.001));
ok('frequent care cannot erase energy decay',near(frequentPets.needs.energy,decay(lifeStart,noon+3*minute).needs.energy,.001));
const nightStart=new Date(2026,9,29,22).getTime();
const overnight={...createPetState(nightStart),needs:{...lifeStart.needs,energy:30},sleep:{...lifeStart.sleep,asleep:true,fellAsleepAt:nightStart}};
const overnightOffline=decay(overnight,nightStart+12*60*minute),overnightTicks=stepLife(overnight,12*60);
ok('offline night sleep and morning waking agree with live ticks',overnightOffline.sleep.asleep===overnightTicks.sleep.asleep&&near(overnightOffline.needs.energy,overnightTicks.needs.energy,.001));
ok('the morning has awake boredom and bladder progression offline',near(dailyLife(overnightOffline).boredom,dailyLife(overnightTicks).boredom,.001)&&near(dailyLife(overnightOffline).bladder,dailyLife(overnightTicks).bladder,.001));

let shortNight=createPetState(nightStart);for(let i=1;i<=20;i++)shortNight=decay(shortNight,nightStart+i*9000);
ok('sub-tick updates cannot postpone natural night sleep',shortNight.sleep.asleep);
ok('short and long night updates give comparable bladder progression',near(dailyLife(shortNight).bladder,dailyLife(decay(createPetState(nightStart),nightStart+180000)).bladder,.1));

console.log('\nRECOVERY AFTER INTERRUPTED REST');
let interrupted=createPetState(nightStart);
for(let i=0;i<3;i++){
  const at=nightStart+i*1000;
  interrupted=interact(settleSleep(interrupted,at).state,'pet',at).state;
}
ok('three interruptions temporarily prevent settling',!interrupted.sleep.asleep&&interrupted.sleep.restlessness>.55&&!willSettle(interrupted,interrupted.updatedAt));
const quietRecovery=decay(interrupted,nightStart+2*60*minute);
ok('quiet time ends the repeated-waking sleep deadlock',quietRecovery.sleep.asleep);
ok('recovered sleep restores energy',quietRecovery.needs.energy>interrupted.needs.energy);
ok('interruptions are remembered until sustained sleep',decay(interrupted,nightStart+45*minute).sleep.wakeCount===3);
ok('sustained sleep clears the wake tally',decay(interrupted,nightStart+3*60*minute).sleep.wakeCount===0);
const wired={...createPetState(noon),arousal:100,needs:{...lifeStart.needs,energy:10},sleep:{...lifeStart.sleep,restlessness:1,wakeCount:8}};
const wiredRecovery=decay(wired,noon+4*60*minute);
ok('a tired wound-up dog can recover without repeated care clicks',wiredRecovery.sleep.asleep&&wiredRecovery.needs.energy>wired.needs.energy);
const recoveryTicks=stepLife(interrupted,120),recoveryOffline=decay(interrupted,interrupted.updatedAt+120*minute);
ok('offline and live recovery agree',recoveryTicks.sleep.asleep===recoveryOffline.sleep.asleep&&near(recoveryTicks.sleep.restlessness,recoveryOffline.sleep.restlessness,.001)&&near(recoveryTicks.needs.energy,recoveryOffline.needs.energy,.001));
const brokenRest={...wired,sleep:{...wired.sleep,restlessness:2.2}};
ok('old over-range restlessness cannot prolong the deadlock',decay(brokenRest,noon+4*60*minute).sleep.asleep);
ok('waking always keeps restlessness within its 0–1 scale',interact({...wired,sleep:{...wired.sleep,asleep:true,restlessness:.98,fellAsleepAt:noon}},'pet',noon).state.sleep.restlessness<=1);
ok('quiet recovery never raises an already calm dog’s arousal',decay({...lifeStart,arousal:5},noon+minute).arousal<=5);

console.log('\nHousehold, pantry, personality and everyday behavior');
ok('only the requested five starters are playable',DEFAULT_DOGS.length===5&&!DEFAULT_DOGS.some(d=>['bangal-2023','companion-dog-2'].includes(d.id)));
const pantry=createPetState(noon),earned={...pantry,together:{day:'2026-10-30',todaySec:120,totalSec:120,streak:1}};
const credited={...earned,game:gameState(earned)};
ok('two active minutes earn six coins exactly once',gameState(earned).coins===24&&gameState(credited).coins===24);
const bought=buyFood(credited).state;
ok('buying a pouch exchanges six coins for three meals',gameState(bought).coins===18&&gameState(bought).portions===6);
ok('insufficient money cannot buy food',buyFood({...pantry,game:{...gameState(pantry),coins:0}}).state.game?.coins===0);
const hungryPantry={...pantry,needs:{...pantry.needs,hunger:20},game:{...gameState(pantry),coins:0,portions:0}};
ok('hungry dog always has an emergency meal without money',takeMeal(hungryPantry).allowed);
ok('ordinary meal consumes one portion',gameState(interact({...pantry,needs:{...pantry.needs,hunger:40}},'feed',noon).state).portions===2);
ok('starter dog does not catch before fetch practice',!fetchLearned(pantry));
ok('actual virtual fetch progress enables catching',fetchLearned({...pantry,lessons:{fetch:{...newLesson(),skill:.5}}}));
const found=discoverTouch(pantry,'oreo-frenchie','back');
ok('touch discoveries persist per dog without duplicate entries',discoverTouch(found,'oreo-frenchie','back').game?.touchDiscoveries.length===1&&TOUCH_PREFERENCES['oreo-frenchie']!==TOUCH_PREFERENCES['paolo-pug']);
const beforeOuting={...pantry,trust:45,arousal:55,life:{...dailyLife(pantry),boredom:65,bladder:60}};
const afterOuting=completeParkWalk(beforeOuting,noon,12,180);
ok('a real outing returns a calmer, closer, relieved dog and food money',afterOuting.trust===48&&afterOuting.arousal===47&&afterOuting.life?.boredom===40&&afterOuting.life?.bladder===30&&gameState(afterOuting).coins===gameState(beforeOuting).coins+3);
ok('opening the park or standing still earns no outing reward',completeParkWalk(beforeOuting,noon,0,0)===beforeOuting&&completeParkWalk(beforeOuting,noon,12,0)===beforeOuting);
ok('outing rewards cannot be farmed by repeated return visits',completeParkWalk(afterOuting,noon+60000,12,180)===afterOuting);
ok('sleeping or sick dogs cannot earn exercise rewards',completeParkWalk({...beforeOuting,sick:true},noon,12,180).trust===45&&completeParkWalk({...beforeOuting,sleep:{...beforeOuting.sleep,asleep:true}},noon,12,180).trust===45);
ok('invalid movement evidence cannot award a walk',completeParkWalk(beforeOuting,noon,NaN,180)===beforeOuting);
const hello=socialize(pantry,noon);
ok('social greeting grows gently and cannot farm repeated frames',hello.personality.sociability>pantry.personality.sociability&&socialize(hello,noon+1000)===hello);
ok('sleeping dog cannot socialize',socialize({...pantry,sleep:{...pantry.sleep,asleep:true}},noon).game===undefined);
ok('repertoire has twenty distinct expressions',DOG_BEHAVIOURS.length===20&&new Set(DOG_BEHAVIOURS).size===20);
ok('sleep has no playful idle candidates',behaviourPool({...pantry,sleep:{...pantry.sleep,asleep:true}}).every(b=>b==='sleeping'));
ok('low energy never selects zooming or play bow',!behaviourPool({...pantry,needs:{...pantry.needs,energy:10}}).some(b=>['trotting','play-bow'].includes(b)));
ok('lonely dog seeks contact',behaviourPool({...pantry,call:{reason:'lonely',since:noon}}).includes('paw-screen'));
ok('random idle choice does not immediately repeat',chooseBehaviour(pantry,'watching',()=>0).kind!=='watching');
const earlyRiser={...pantry,game:{...gameState(pantry),wakeMinute:360},sleep:{...pantry.sleep,asleep:true,fellAsleepAt:new Date(2026,9,29,22).getTime()},updatedAt:new Date(2026,9,30,5,55).getTime(),needs:{...pantry.needs,energy:90}};
const lateSleeper={...earlyRiser,game:{...gameState(earlyRiser),wakeMinute:450}};
ok('individual wake habits separate early and late sleepers',!decay(earlyRiser,new Date(2026,9,30,6,5).getTime()).sleep.asleep&&decay(lateSleeper,new Date(2026,9,30,6,5).getTime()).sleep.asleep);

const puppy={...createPetState(noon),growth:{adoptedAt:noon,seed:'test-owner',careDays:[],day:'2026-10-30',daySeconds:0}};
const firstDay=growCompanion(puppy,60,noon),sameDay=growCompanion(firstDay,60,noon+1000);
ok('owned puppy starts smaller with an independent identity',growthStage(puppy).name==='Puppy'&&growthStage(puppy).scale<.7);
ok('active care earns one growth day, not repeated tapping',firstDay.growth?.careDays.length===1&&sameDay.growth?.careDays.length===1);
ok('idle absence alone never grows a puppy',growthStage(decay(puppy,noon+24*60*minute)).progress===0);
let grown:PetState=puppy;for(let day=0;day<7;day++)grown=growCompanion(grown,60,noon+day*24*60*minute);
ok('seven distinct care days reach full size',growthStage(grown).name==='Adult'&&growthStage(grown).scale===1);
const petter=interact(pantry,'pet',noon).state,walker=interact(pantry,'walk',noon).state;
ok('care histories shape different personalities',petter.personality.sociability>walker.personality.sociability&&walker.personality.boldness>petter.personality.boldness);

console.log('\nLIVE PARK MESSAGES');
const liveDog = { name: 'Expo', breed: 'Thai Bangkaew Dog', art: 'expo-2021', owner: "Expo's person", coat: { base: '#ece7de', light: '#f8f6f1', dark: '#211c18' } };
ok('a proper hello is accepted', parseClient(JSON.stringify({ t: 'hello', id: 'abcd1234efgh', dog: liveDog }))?.t === 'hello');
ok('broken JSON is dropped', parseClient('{"t":"hello"') === null);
ok('an unknown message type is dropped', parseClient(JSON.stringify({ t: 'admin', id: 'x' })) === null);
const leaky = parseClient(JSON.stringify({ t: 'hello', id: 'abcd1234efgh', dog: { ...liveDog, microchip: 'TH-985141002849102', vet: 'Thonglor' } }));
ok('record fields never pass through, even if a client sends them', leaky?.t === 'hello' && !JSON.stringify(leaky).includes('985141') && !JSON.stringify(leaky).includes('Thonglor'));
const marked = parseClient(JSON.stringify({ t: 'hello', id: 'abcd1234efgh', dog: { ...liveDog, name: '<img src=x>Mochi' } }));
ok('markup is stripped from names', marked?.t === 'hello' && !marked.dog.name.includes('<'));
ok('a bad coat colour rejects the dog', parseClient(JSON.stringify({ t: 'hello', id: 'abcd1234efgh', dog: { ...liveDog, coat: { ...liveDog.coat, base: 'red; drop' } } })) === null);
const far = parseClient(JSON.stringify({ t: 'intent', x: 1e9, y: -1e9, mode: 'chase', hungry: false, asleep: false }));
ok('positions are clamped to the park', far?.t === 'intent' && far.x === WORLD.maxX && far.y === WORLD.minY);
ok('an oversized message is dropped', parseClient(JSON.stringify({ t: 'pet', target: 'abcd1234', pad: 'x'.repeat(2000) })) === null);
const bucket = { start: 0, count: 0 };
let allowed = 0;
for (let i = 0; i < RATE_LIMIT + 10; i++) if (withinRate(bucket, 1000)) allowed++;
ok('a flooding connection is cut off at the limit', allowed === RATE_LIMIT);
ok('the limit resets after ten seconds', withinRate(bucket, 12_000));
const room = newRoomName();
ok('a new room name is valid and hard to guess', validRoom(room) && room.split('-')[2].length === 8, room);
ok('a path-like room name is refused', !validRoom('../../etc') && !validRoom('a'));

console.log('\nEACH DOG BEING ITSELF IN THE PARK');
const share = (art: string, act: Activity) => { let n = 0; for (let i = 0; i < 1000; i++) if (chooseActivity(art, i / 1000, true) === act) n++; return n / 1000; };
ok('Oreo starts chases more than any other dog', ['expo-2021', 'mali-2022', 'paolo-pug', 'shiba-chai'].every((d) => share('oreo-frenchie', 'chase') > share(d, 'chase')));
ok('Paolo naps; Oreo never does', share('paolo-pug', 'nap') > 0.25 && share('oreo-frenchie', 'nap') === 0);
ok('Expo keeps watch from a lookout', share('expo-2021', 'lookout') > 0.3);
ok('Mali goes to the bowl; Expo does not', share('mali-2022', 'bowl') > 0.2 && share('expo-2021', 'bowl') === 0);
ok('Hachiku waits by the bench, and rarely visits', share('shiba-chai', 'wait') > 0.3 && share('shiba-chai', 'visit') < 0.1);
ok('with no friend free, nobody tries to chase or visit', [0, 0.3, 0.6, 0.99].every((r) => !['chase', 'visit'].includes(chooseActivity('oreo-frenchie', r, false))));

console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures > 0) {
  throw new Error(`${failures} of ${checks} checks FAILED.`);
}
