/**
 * THE PET'S INNER LIFE.
 *
 * This is the model. It is deliberately small enough to be read in one sitting
 * and honest enough that every number on screen can be traced to something
 * that happened.
 *
 * FOUR IDEAS CARRY IT:
 *
 * 1. A PET IS NOT FOUR BARS.
 *    Hunger, energy and hygiene are the Tamagotchi's body. Trust and arousal
 *    are what a relationship with a creature actually is. Trust is the ledger
 *    of consistency; arousal is the animal's excitement, which rises with
 *    play and cues and falls with rest. A pet with full bars and low trust is
 *    a pet that will not work for you, and the model has to be able to say so.
 *
 * 2. THE BODY GATES THE LEARNING.
 *    A hungry, exhausted dog does not perform. So the care loop is not
 *    decoration next to the training loop: they are the same loop. Feed the
 *    dog, walk him, then train him — the model makes that visible, and the
 *    pet visibly performs worse when it is skipped.
 *
 * 3. APP TIME IS NOT DOG TIME.
 *    Rehearsing in the app is allowed, and it is how a person learns their
 *    timing. But a rehearsed rep does NOT strengthen a behaviour. Only a
 *    rep that happened with the real animal does. This is the one rule that
 *    keeps the system from being a game about tapping.
 *
 * 4. EVERYTHING IS LEGIBLE.
 *    The pet never hides a number, and never invents one. If a behaviour is
 *    at 62%, it is at 62% and the app can show the last ten attempts that
 *    produced it.
 */

import { maybeRunAway } from './runaway';
import type {
  Behaviour,
  BehaviourName,
  Observation,
  ObservationTag,
  PetState,
  Schedule,
  SleepState,
  Subject,
} from './types';

export type { Observation, ObservationTag };
import {gameState,takeMeal} from './companionGame';
import { dailyLife, advanceDailyLife } from './dailyLife';
import {calmInteraction,calmNeed} from './calm';

/** How long after a behaviour a marker still predicts it. */
export const MARKER_WINDOW_MS = 500;

/** A pet that has not been cared for drifts. One point per hour. */
const DECAY_PER_HOUR = { hunger: 1.6, energy: 1.1, hygiene: 0.7 } as const;

/** How fast trust is lost when a cue stops meaning anything. */
const TRUST_DECAY_PER_DAY = 4;

export function createPetState(now: number = Date.now()): PetState {
  return {
    updatedAt: now,
    needs: { hunger: 70, energy: 75, hygiene: 85 },
    trust: 60,
    arousal: 30,
    personality: {
      boldness: 0,
      sociability: 0,
      foodDrive: 0.2,
      playDrive: 0.3,
      sensitivity: 0.2,
    },
    behaviours: {},
    associations: {},
    observations: [],
    sleep: createSleepState(),
    lastCareAt: now,
    lastRealSessionAt: undefined,
    lastCue: undefined,
    lastCueAt: undefined,
    poopCount: 0,
    life: dailyLife({}),
    lastPoopedAt: undefined,
    sick: false,
    sickSince: undefined,
    discipline: 60,
    weightKg: 24.8,
  };
}

/**
 * A FRESH NIGHT.
 *
 * He is awake, he has not been woken tonight, and nothing is pending.
 */
export function createSleepState(): SleepState {
  return {
    asleep: false,
    fellAsleepAt: null,
    wokenAt: null,
    wakeCount: 0,
    restlessness: 0,
  };
}

/**
 * WHEN A DOG SLEEPS.
 *
 * He sleeps at night, like we do — from late evening to small hours — and
 * whenever he is spent. The hours are the house's hours, not the dog's
 * biology: this is a pet that lives with a person, so the bed belongs to the
 * person too.
 */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;

/** TRUE when the clock says it is the small hours. */
export function isNightHour(now: number): boolean {
  const hour = new Date(now).getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

/**
 * HOW STRONGLY HE WANTS TO SLEEP, 0..1.
 *
 * Night is most of it; tiredness is the rest. This is the number the app
 * uses to decide whether he settles on his own, and it is also the number
 * that makes the small hours feel different from the afternoon.
 */
export function sleepPressure(state: PetState, now: number = Date.now()): number {
  const tired = 1 - state.needs.energy / 100;
  const night = isNightHour(now) ? 0.65 : 0;
  // The deepest pressure is in the small hours, not at bedtime.
  const hour = new Date(now).getHours();
  const deepNight = hour >= 1 && hour < 4 ? 0.15 : 0;
  return clamp(night + deepNight + tired * 0.55, 0, 1);
}

/**
 * CAN HE SETTLE ON HIS OWN RIGHT NOW?
 *
 * Not if he is wound up, and not if he has been woken too many times tonight.
 * Interruptions raise the bar temporarily; quiet time lets him recover.
 */
export function willSettle(state: PetState, now: number = Date.now()): boolean {
  const sleep = state.sleep ?? createSleepState();
  if (sleep.asleep) return false;
  if (sleep.restlessness > 0.55) return false;
  if (state.arousal > 55) return false;
  return sleepPressure(state, now) > 0.45;
}

/**
 * PUT HIM TO BED.
 *
 * If he will not settle, this says so — and says why. "He is too wound up to
 * settle" is an answer; a silent failure is not.
 */
export function settleSleep(state:PetState,now:number=Date.now(),subject?:Subject):{state:PetState;note:string}{
  return settleBody(decay(state,now),now,subject);
}

function settleBody(
  state: PetState,
  now: number = Date.now(),
  subject?: Subject
): { state: PetState; note: string } {
  const p = pronouns(subject);
  const name = subject?.name?.trim() || 'The dog';
  const sleep = state.sleep ?? createSleepState();

  if (sleep.asleep) {
    return { state, note: `${name} is already asleep.` };
  }
  if (sleep.restlessness > 0.55) {
    return {
      state,
      note: `${name} is restless. Give ${p.obj} some quiet time before trying bed again.`,
    };
  }
  if (state.arousal > 55) {
    return {
      state,
      note: `${name} is too wound up to settle. A walk would bring ${p.poss} arousal down.`,
    };
  }

  const next: PetState = {
    ...state,
    calmSince:undefined,
    sleep: {
      asleep: true,
      fellAsleepAt: now,
      wokenAt: sleep.wokenAt,
      // THE TALLY IS NOT ERASED BY PUTTING HIM DOWN.
      //
      // This is the difference between a night of interruptions and a
      // checklist. If settling him cleared the count, you could keep him up
      // all night at no cost: bed, wake, bed, wake, and every time the slate
      // was wiped clean. He remembers the interruptions, so the bar for
      // settling rises every time you interrupt him. Quiet time reduces
      // restlessness; sustained sleep clears the interruption tally.
      wakeCount: sleep.wakeCount,
      restlessness: sleep.restlessness,
    },
    arousal: clamp(state.arousal - 18),
    updatedAt: now,
  };
  return {
    state: next,
    note: `${name} circles twice and lies down, nose on ${p.poss} paws. Out like a light.`,
  };
}

/**
 * WAKE HIM.
 *
 * He does not want to. Waking him costs him energy and raises his
 * restlessness, so the second and third wake-up of a night are met with less
 * patience than the first — and he is measurably harder to settle afterwards.
 */
export function wake(
  state: PetState,
  now: number = Date.now(),
  subject?: Subject
): { state: PetState; note: string } {
  const sleep = state.sleep ?? createSleepState();
  const p = pronouns(subject);
  const name = subject?.name?.trim() || 'The dog';

  if (!sleep.asleep) {
    return { state, note: '' };
  }

  const wakeCount = sleep.wakeCount + 1;
  const restlessness = clamp(sleep.restlessness + 0.24, 0, 1);
  const next: PetState = {
    ...state,
    sleep: { ...sleep, asleep: false, wokenAt: now, wakeCount, restlessness },
    needs: { ...state.needs, energy: clamp(state.needs.energy - 6) },
    arousal: clamp(state.arousal + 16),
    updatedAt: now,
  };

  const note =
    wakeCount === 1
      ? `${name} was asleep. ${p.subjCap} opens one eye, puts ${p.poss} head back down, and does not get up.`
      : `${name} was asleep — and ${p.subj} has been woken ${wakeCount} times now. ${p.subj} will not settle easily again tonight.`;

  return { state: next, note };
}

/**
 * HOW THIS DOG IS, RIGHT NOW.
 *
 * A phrase, not a number, because the point of the model is that the
 * behaviour follows the animal: a food-driven dog works for food, a bold dog
 * works for the challenge, a sensitive dog needs a quieter criterion. The
 * temperament is the sentence that names which dog this is.
 */
export function temperament(state: PetState): string {
  const p = state.personality;
  if (p.sensitivity > 0.35) return 'a dog who notices everything';
  if (p.foodDrive > 0.5) return 'a dog who works for food';
  if (p.playDrive > 0.5) return 'a dog who works for the ball';
  if (p.sociability > 0.4) return 'a dog who wants company';
  if (p.boldness > 0.4) return 'a dog who is not afraid of anything';
  if (p.sociability < -0.3) return 'a dog who keeps his own distance';
  if (p.boldness < -0.3) return 'a careful dog';
  return 'a steady dog';
}

/**
 * HAPPINESS IS NOT A FOURTH BAR.
 *
 * It is what the other numbers add up to, so it is computed and never stored.
 * A number kept in two places drifts, and the reader ends up looking at two
 * truths. A dog that is fed, rested, clean, and trusts you is happy; a dog
 * with full bars and a broken bond is not, and this is the number that says
 * so.
 */
export function happiness(state: PetState): number {
  if (state.sick) {
    // Sickness is genuinely miserable: capped low and heavily penalized
    return clamp(Math.min(25, (state.trust * 0.2 + state.needs.hunger * 0.1)));
  }
  const body = (state.needs.hunger + state.needs.energy + state.needs.hygiene) / 300;
  const bond = state.trust / 100;
  const calm = clamp(1 - Math.abs(state.arousal - 55) / 100);
  const poopPenalty = ((state.poopCount ?? 0) + dailyLife(state).peeCount) * 8 + dailyLife(state).boredom * .12;
  return clamp((body * 0.5 + bond * 0.35 + calm * 0.15) * 100 - poopPenalty);
}

/** The pet drifts whether anyone is watching. */
export function decay(state: PetState, now: number = Date.now()): PetState {
  // Repair saves from the old 0–100 clamp before applying any elapsed time.
  const sleep=state.sleep??createSleepState();
  state={...state,sleep:{...sleep,restlessness:Number.isFinite(sleep.restlessness)?clamp(sleep.restlessness,0,1):0}};
  if(now<=state.updatedAt)return {...state,life:dailyLife(state),behaviours:Object.fromEntries(Object.entries(state.behaviours).map(([name,b])=>[name,decayBehaviour(b,now)]))};
  // The same bounded steps run on load and while open. Sleep, digestion and
  // filth must change rates during a long absence, not only at its end.
  let cursor=now-Math.min(now-state.updatedAt,72*3_600_000);
  let next={...state,updatedAt:cursor,sleep:{...(state.sleep??createSleepState())}};
  if(next.sleep.asleep&&next.sleep.fellAsleepAt===null)next.sleep.fellAsleepAt=cursor;
  while(cursor<now){
    cursor=Math.min(now,cursor+10_000);
    next=decayStep(next,cursor);
    if(willSettle(next,cursor))next=settleBody(next,cursor).state;
  }
  next.behaviours=Object.fromEntries(Object.entries(next.behaviours).map(([name,b])=>[name,decayBehaviour(b,now)]));
  // Three days of neglect while hungry and he slips out. He never dies.
  return maybeRunAway(next,now);
}

function decayStep(state:PetState,now:number):PetState {
  const hours = Math.max(0, (now - state.updatedAt) / 3_600_000);
  const factor = Math.min(hours, 72); // nobody is away for a month
  const sleep = state.sleep ?? createSleepState();

  // A dog asleep recovers faster than a dog awake, and settles more deeply.
  const asleep = sleep.asleep;
  const energyRate = asleep ? 4.5 : DECAY_PER_HOUR.energy;
  const daily=advanceDailyLife(state,factor*60,now);
  const mess=(state.poopCount??0)+dailyLife(state).peeCount;
  const poopAcc=1+mess*1.5;
  const nextHygiene=clamp(state.needs.hygiene-DECAY_PER_HOUR.hygiene*poopAcc*factor);
  let isSick=state.sick??false,sickSince=state.sickSince;
  if(!isSick&&((daily.poopCount+daily.life.peeCount>=2&&nextHygiene<25)||daily.life.lowFullnessMinutes>=180)){
    isSick=true;sickSince=now;
  }

  // Sick dogs lose trust faster due to distress and suffering
  const trustDecayRate = isSick ? TRUST_DECAY_PER_DAY * 2.5 : TRUST_DECAY_PER_DAY;

  const next: PetState = {
    ...state,
    updatedAt: now,
    needs: {
      hunger: clamp(state.needs.hunger - DECAY_PER_HOUR.hunger * factor),
      energy: clamp(
        state.needs.energy + (asleep ? energyRate : -energyRate * (isSick ? 1.4 : 1)) * factor
      ),
      hygiene: nextHygiene,
    },
    trust: clamp(state.trust - (trustDecayRate * factor) / 24),
    // Authored game pacing: excitement eases toward neutral during quiet time.
    // This never winds up a dog whose arousal is already below neutral.
    arousal: clamp(state.arousal-Math.min(Math.max(0,state.arousal-30),20*factor)),
    ...daily,
    sick: isSick,
    sickSince,
    discipline: clamp(state.discipline ?? 60),
    weightKg: state.weightKg ?? 24.8,
    sleep: {
      ...sleep,
      // Both awake quiet time and sleep reduce restlessness, so the sleep
      // gate can never require sleep as its only route back to sleep.
      // Ninety minutes of unbroken rest clears the interruption tally.
      wakeCount:
        asleep && sleep.fellAsleepAt !== null && now - sleep.fellAsleepAt > 90 * 60_000
          ? 0
          : sleep.wakeCount,
      restlessness: clamp(
        sleep.restlessness-factor*(asleep?.22:.30),0,1
      ),
    },
  };
  // Morning waking and a restored daytime nap are natural, without manual-wake penalties.
  const morning=new Date(now),minute=morning.getHours()*60+morning.getMinutes();
  const fell=sleep.fellAsleepAt===null?null:new Date(sleep.fellAsleepAt),nightSleep=fell&&(fell.getHours()>=20||fell.getHours()<6);
  const mayWake=nightSleep?minute>=gameState(state).wakeMinute&&minute<20*60:!isNightHour(now);
  if(asleep&&mayWake&&next.needs.energy>=65&&sleep.fellAsleepAt!==null&&now-sleep.fellAsleepAt>=60*60_000){
    next.sleep={...next.sleep,asleep:false,wokenAt:now};
  }
  if(next.calmSince!==undefined&&(calmNeed(next)||next.arousal>55))next.calmSince=undefined;
  // A spoken cue expires if nothing follows it — classical conditioning
  // needs the cue and the outcome close together in time.
  if (state.lastCueAt && now - state.lastCueAt > 5 * 60_000) {
    next.lastCue = undefined;
    next.lastCueAt = undefined;
  }
  return next;
}

/**
 * HOW WELL CAN THIS DOG WORK RIGHT NOW?
 *
 * Performance is not the behaviour's strength alone. A dog at 20% energy is
 * not a dog that cannot sit; he is a dog that will not, today. The pet's
 * readiness is the product of the behaviour's strength and the state of the
 * animal — and this is the number the coach shows before a session.
 */
export function readiness(state: PetState): number {
  if (state.sick) return 0; // A sick dog cannot perform or focus on training
  // `hunger` is FULLNESS. Basic nutrition supports learning; food motivation
  // eases after a large meal. Neither starvation nor withholding earns a bonus.
  const body = (state.needs.energy / 100) * 0.6 + (state.needs.hunger / 100) * 0.4;
  const bond = 0.7 + 0.3 * (state.trust / 100);
  const arousalBand = 1 - Math.abs(state.arousal - 55) / 100; // too flat or too wired
  const appetite=state.needs.hunger>85?.9:1;
  return clamp(body * bond * clamp(arousalBand) * 1.25*appetite);
}

/** The chance the pet performs a behaviour when cued, right now. */
export function performChance(state: PetState, behaviour: Behaviour): number {
  return clamp(behaviour.strength * readiness(state));
}

export type Interaction = 'pet' | 'feed' | 'play' | 'groom' | 'walk' | 'medicine' | 'scold' | 'clean' | 'settle' | 'rewardCalm';

export interface InteractionResult {
  state: PetState;
  /** What happened, in one sentence, for the record. */
  note: string;
}

/**
 * PRONOUNS THAT MATCH THE DOG.
 *
 * The household is not all one animal. A note that says "he" about a dog the
 * reader enrolled as female is a small lie that makes the whole record feel
 * written about somebody else's dog. So the pronoun comes from the record.
 */
export interface Pronouns {
  subj: string;
  obj: string;
  poss: string;
  /** The same pronoun, at the start of a sentence. */
  subjCap: string;
}

export function pronouns(subject: Subject | undefined): Pronouns {
  if (subject?.sex === 'female') {
    return { subj: 'she', obj: 'her', poss: 'her', subjCap: 'She' };
  }
  return { subj: 'he', obj: 'him', poss: 'his', subjCap: 'He' };
}

/**
 * THE FOUR THINGS YOU CAN DO, AND WHAT THEY COST.
 *
 * Every interaction moves the state, and every one of them can be mistimed.
 * Meals meet bodily needs. A full belly can reduce the value of food as a
 * reward, but regular meals never erase learned skills. Numerical trait
 * changes below are authored game pacing, not a biological measurement.
 */
export function interact(
  state: PetState,
  action: Interaction,
  now: number = Date.now(),
  subject?: Subject
): InteractionResult {
  const p = pronouns(subject);
  const name = subject?.name?.trim() || 'The dog';

  // ASLEEP FIRST.
  //
  // You cannot play with a sleeping dog without waking him, and waking him
  // costs him. So the interaction goes THROUGH the waking, and the note says
  // so — the reader is told they interrupted something, rather than being
  // served a cheerful response from an animal that was not there.
  let base = decay(state,now);
  // The old scold command remains a safe alias for imported/older callers.
  // Quiet practice never wakes a sleeping dog or rewards an unmet need.
  if(action==='settle'||action==='rewardCalm'||action==='scold')return calmInteraction(base,action==='scold'?'settle':action,now,name);
  let wakeNote = '';
  if ((base.sleep ?? createSleepState()).asleep && action !== 'clean') {
    const woken = wake(base, now, subject);
    base = woken.state;
    wakeNote = woken.note;
  }

  const t = temperament(base);

  let next: PetState = {
    ...base,
    needs: { ...base.needs },
    personality: { ...base.personality },
    updatedAt: now,
    lastCareAt: now,
    life: dailyLife(base),
    calmSince:undefined,
  };

  let note = '';
  switch (action) {
    case 'pet': {
      next.life={...dailyLife(next),boredom:Math.max(0,dailyLife(base).boredom-25)};
      next.trust = clamp(base.trust + 4);
      next.personality.sociability=clampTrait(base.personality.sociability+.015);
      next.personality.sensitivity=clampTrait(base.personality.sensitivity-.005);
      next.arousal = clamp(base.arousal - 6);
      note =
        base.trust > 70
          ? `${name} leans into the hand. Company builds trust and eases boredom.`
          : 'Gentle company builds trust and eases boredom.';
      break;
    }
    case 'feed': {
      const meal=takeMeal(base);if(!meal.allowed)return {state:meal.state,note:meal.note};
      next.game=meal.state.game;
      // `hunger` here is FULLNESS: 100 is a full belly, 30 an empty one.
      if (base.needs.hunger < 75) {
        // Fed when he asked. The food is worth something, and worth more.
        next.needs.hunger = clamp(base.needs.hunger + 26);
        next.personality.foodDrive = clampTrait(base.personality.foodDrive + 0.04);
        next.arousal = clamp(base.arousal + 10);
        note =
          base.personality.foodDrive > 0.45
            ? 'Fed while hungry, and gone at once. Regular meals keep the body well. Tiny training treats reward a specific action.'
            : 'Fed while hungry. Good. Regular meals keep the body well. Tiny training treats reward a specific action.';
      } else {
        // Fed when he did not ask. The food loses its value as a reward.
        next.personality.foodDrive = clampTrait(base.personality.foodDrive - 0.08);
        next.arousal = clamp(base.arousal + 8);
        next.weightKg = (base.weightKg ?? 24.8) + 0.15;
        note = 'Nearly full. Save extra food for later; tiny training portions come from the daily allowance.';
      }
      break;
    }
    case 'play': {
      if (base.sick) {
        note = `${name} is sick and trembling. ${p.subjCap} is too weak to play — administer medicine first.`;
        break;
      }
      next.life={...dailyLife(next),boredom:Math.max(0,dailyLife(base).boredom-65)};
      const capacity = base.needs.energy / 100;
      next.needs.energy = clamp(base.needs.energy - 16);
      next.arousal = clamp(base.arousal + 22 * capacity + (1 - capacity) * 4);
      next.trust = clamp(base.trust + 2);
      next.personality.playDrive = clampTrait(base.personality.playDrive + 0.05);
      next.weightKg = Math.max(15, (base.weightKg ?? 24.8) - 0.05);
      note =
        base.needs.energy < 35
          ? `Played on an empty tank. ${p.subj} was excited, and then ${p.subj} was done.`
          : base.personality.playDrive > 0.45
            ? 'Played, and it is the best part of the day. The ball comes back every time.'
            : 'Played with energy in hand.';
      break;
    }
    case 'groom': {
      next.personality.sensitivity=clampTrait(base.personality.sensitivity-.01);
      next.life={...dailyLife(next),peeCount:0};
      next.needs.hygiene = clamp(base.needs.hygiene + 30);
      next.trust = clamp(base.trust + 3);
      next.arousal = clamp(base.arousal - 4);
      if ((base.poopCount ?? 0) > 0) {
        next.poopCount = 0;
      }
      note =
        base.personality.sensitivity > 0.35
          ? `Groomed. Slow, and worth doing while ${p.subj} is still learning to trust the hand — today ${p.subj} was not sure about it.`
          : `Groomed. Clean coat, stage tidy, and trust steady.`;
      break;
    }
    case 'clean': {
      const mess = (base.poopCount ?? 0)+dailyLife(base).peeCount;
      next.life={...dailyLife(next),peeCount:0};
      if (mess > 0) {
        next.poopCount = 0;
        next.needs.hygiene = clamp(base.needs.hygiene + 35);
        next.trust = clamp(base.trust + 4);
        note = `Scooped and cleared ${mess} mess${mess > 1 ? 'es' : ''} from the stage. Spotless and fresh again. Trust +4.`;
      } else {
        note = 'The stage is already clean and spotless.';
      }
      break;
    }
    case 'medicine': {
      if (base.sick) {
        next.sick = false;
        next.sickSince = undefined;
        next.needs.energy = clamp(base.needs.energy + 25);
        next.trust = clamp(base.trust + 10);
        note = `Administered medication. ${name} ceases shivering, breathes easily, and begins to recover. Health restored!`;
      } else {
        note = `${name} is in good health and does not require medication.`;
      }
      break;
    }
    case 'walk': {
      next.personality.boldness=clampTrait(base.personality.boldness+.015);
      if (base.sick) {
        note = `${name} is sick and shivering. ${p.subjCap} cannot go on a walk — rest and medicine needed.`;
        break;
      }
      next.life={...dailyLife(next),bladder:0,boredom:Math.max(0,dailyLife(base).boredom-45)};
      next.needs.energy = clamp(base.needs.energy - 12);
      next.arousal = clamp(base.arousal - 18);
      next.needs.hygiene = clamp(base.needs.hygiene - 4);
      next.trust = clamp(base.trust + 2);
      next.personality.boldness = clampTrait(base.personality.boldness + 0.03);
      next.weightKg = Math.max(15, (base.weightKg ?? 24.8) - 0.08);
      note = `A sniff walk and a toilet break. ${name} comes back relieved. Arousal down, legs exercised — and ${t} on a walk is a different animal.`;
      break;
    }
  }

  // Pair the last spoken cue with this outcome (classical conditioning):
  // say "dinner", then feed, and the dog learns "dinner" means food is coming.
  if (base.lastCue && base.lastCueAt && now - base.lastCueAt <= 30_000) {
    next = strengthenAssociation(next, base.lastCue, 0.06);
  }

  // The waking, if there was one, comes first: it is what actually happened.
  if (wakeNote) note = `${wakeNote} ${note}`;

  return { state: next, note };
}

/**
 * COMMUNICATE — classical conditioning in one action.
 *
 * You say a word to Expo. If that word has been paired with food, petting or
 * play often enough, Expo responds: ears prick, tail wags, he looks at you.
 * If the word is new, he tilts his head and waits for you to show him what it
 * means. The word is stored as `lastCue` so the next care action can pair with
 * it and strengthen the association.
 */
export function communicate(
  state: PetState,
  cue: string,
  now: number = Date.now(),
  subject?: Subject
): InteractionResult {
  state=decay(state,now);
  const clean = cue.trim().toLowerCase();
  const strength = associationStrength(state, clean);
  const name = subject?.name?.trim() || 'The dog';

  const next: PetState = {
    ...state,
    updatedAt: now,
    calmSince:undefined,
    arousal: clamp(state.arousal + 5),
    lastCue: clean,
    lastCueAt: now,
  };

  let note = '';
  if (clean === '') {
    note = `You said nothing. ${name} blinked at you.`;
  } else if (strength >= 0.5) {
    next.trust = clamp(state.trust + 1);
    note = `${name} knows "${clean}". Ears prick, and ${name} looks at you, waiting.`;
  } else if (strength > 0) {
    note = `${name} recognizes "${clean}" a little. A head tilt — not quite sure what it means yet.`;
  } else {
    note = `${name} doesn't know "${clean}" yet. ${name} looks at you, waiting to be shown.`;
  }

  return { state: next, note };
}

/**
 * THE OBSERVATION LOG — the channel from the real animal into the model.
 *
 * The system learns the dog's personality from what actually happened with
 * him. Each observation nudges a trait. The point is not the score: it is
 * that the model becomes a description of THIS dog, and the training
 * protocol can be chosen to suit him (a sensitive dog needs a quieter
 * criterion; a food-driven dog can carry a variable schedule).
 *
 * The log is KEPT, not just applied. A trait with no record behind it is a
 * number the reader cannot check, and an owner who cannot check a number
 * stops believing the rest of them.
 */
const OBSERVATION_EFFECTS: Record<ObservationTag, Partial<PetState['personality']>> = {
  ateNewFoodEagerly: { foodDrive: 0.12 },
  refusedFood: { foodDrive: -0.1 },
  nervousWithStrangers: { sociability: -0.12, sensitivity: 0.1 },
  relaxedWithStrangers: { sociability: 0.12, sensitivity: -0.05 },
  pulledHardOnLeash: { boldness: 0.1, sensitivity: 0.06 },
  pulledCalmOnLeash: { boldness: -0.05, sensitivity: -0.06 },
  soughtOutCompany: { sociability: 0.15, boldness: 0.05 },
  hidUnderTheBed: { sensitivity: 0.14, boldness: -0.1 },
  succeededAtCue: { boldness: 0.06 },
  ignoredCue: { sensitivity: 0.05, boldness: -0.04 },
};

/** How many observations are kept. The newest are the ones that describe the
 *  dog as it is now. */
const OBSERVATION_LOG_LIMIT = 60;

export function observe(state: PetState, observation: Observation): PetState {
  state=decay(state,Date.now());
  const effect = OBSERVATION_EFFECTS[observation.tag] ?? {};
  const personality = { ...state.personality };
  for (const [key, delta] of Object.entries(effect)) {
    const k = key as keyof typeof personality;
    personality[k] = clampTrait(personality[k] + (delta ?? 0));
  }
  const observations = [...(state.observations ?? []), observation].slice(-OBSERVATION_LOG_LIMIT);
  return { ...state, personality, observations, updatedAt: Date.now() };
}

/** A cue the pet has learned to associate with something. */
export function strengthenAssociation(
  state: PetState,
  cue: string,
  amount = 0.15
): PetState {
  const key = cue.trim().toLowerCase();
  if (!key) return state;
  return {
    ...state,
    associations: {
      ...state.associations,
      [key]: clamp((state.associations[key] ?? 0) + amount),
    },
  };
}

/** How strongly this dog associates a cue word with an outcome, 0..1. */
export function associationStrength(state: PetState, cue: string): number {
  const key = cue.trim().toLowerCase();
  if (!key) return 0;
  return state.associations[key] ?? 0;
}

/**
 * EXTINCTION: a behaviour nobody rewards stops.
 *
 * The strength is a probability, so it lives between 0 and 1 — and it was
 * being clamped to 100, which let it read "10000%" in the coach after an
 * afternoon. It is also applied against the time since the last call, so the
 * decay is now anchored to `decayedAt`: the same behaviour, decayed to the
 * same moment, always gives the same number. A model that changes when you
 * look at it is not a model.
 *
 * The BURST is not baked into the number. The extinction burst is a rise in
 * the RATE of responding for a few days after the reward stops, and owners
 * read it as stubbornness. A probability cannot show a rate, so the app says
 * it in words instead (see the coach's advice) rather than pretending the
 * number spiked.
 */
export function decayBehaviour(behaviour: Behaviour, now: number = Date.now()): Behaviour {
  const anchor = behaviour.decayedAt ?? behaviour.lastReinforcedAt;
  if (!anchor) return behaviour;
  const elapsed = now - new Date(anchor).getTime();
  // The app decays once a minute. A second call a moment later must not move
  // the number: a model that changes when you look at it is not a model.
  if (elapsed < 60_000) return { ...behaviour, decayedAt: behaviour.decayedAt ?? now };
  const days = elapsed / 86_400_000;
  if (days <= 0) return { ...behaviour, decayedAt: now };
  const decayRate = 0.06 * (behaviour.schedule === 'continuous' ? 1.6 : 1);
  const factor = Math.max(0, 1 - decayRate * days);
  return {
    ...behaviour,
    strength: Math.min(1, Math.max(0, behaviour.strength * factor)),
    decayedAt: now,
  };
}

export function getBehaviour(state: PetState, name: BehaviourName): Behaviour {
  return (
    state.behaviours[name] ?? {
      name,
      strength: 0,
      reps: 0,
      performedReps: 0,
      rehearsals: 0,
      repsSinceReinforcement: 0,
      markerDelayMs: 0,
      schedule: 'continuous' as Schedule,
      cues: [],
      history: [],
    }
  );
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A TRAIT CLAMP.
 *
 * The personality traits run from -1 to +1, not 0 to 100: a dog can be
 * unusually bold OR unusually cautious, and a scale that cannot go below zero
 * cannot say "less sociable than the average dog".
 */
export function clampTrait(value: number): number {
  return Math.min(1, Math.max(-1, value));
}
