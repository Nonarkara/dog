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

import type { Behaviour, BehaviourName, PetState, Schedule } from './types';

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
    lastCareAt: now,
    lastRealSessionAt: undefined,
  };
}

/** The pet drifts whether anyone is watching. */
export function decay(state: PetState, now: number = Date.now()): PetState {
  const hours = Math.max(0, (now - state.updatedAt) / 3_600_000);
  const factor = Math.min(hours, 72); // nobody is away for a month
  const next: PetState = {
    ...state,
    updatedAt: now,
    needs: {
      hunger: clamp(state.needs.hunger - DECAY_PER_HOUR.hunger * factor),
      energy: clamp(state.needs.energy - DECAY_PER_HOUR.energy * factor),
      hygiene: clamp(state.needs.hygiene - DECAY_PER_HOUR.hygiene * factor),
    },
    trust: clamp(state.trust - (TRUST_DECAY_PER_DAY * factor) / 24),
  };
  next.behaviours = Object.fromEntries(
    Object.entries(state.behaviours).map(([name, b]) => [name, decayBehaviour(b, now)])
  );
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
  const body = (state.needs.energy / 100) * 0.6 + ((100 - state.needs.hunger) / 100) * 0.4;
  const bond = 0.7 + 0.3 * (state.trust / 100);
  const arousalBand = 1 - Math.abs(state.arousal - 55) / 100; // too flat or too wired
  return clamp(body * bond * clamp(arousalBand) * 1.25);
}

/** The chance the pet performs a behaviour when cued, right now. */
export function performChance(state: PetState, behaviour: Behaviour): number {
  return clamp(behaviour.strength * readiness(state));
}

export type Interaction = 'pet' | 'feed' | 'play' | 'groom' | 'walk';

export interface InteractionResult {
  state: PetState;
  /** What happened, in one sentence, for the record. */
  note: string;
}

/**
 * THE FOUR THINGS YOU CAN DO, AND WHAT THEY COST.
 *
 * Every interaction moves the state, and every one of them can be mistimed.
 * Feeding a pet that is not hungry teaches it that food arrives on demand —
 * it lowers the drive and raises the begging. That is not a punishment the
 * app inflicts; it is a property of the contingency, and the pet shows it.
 */
export function interact(
  state: PetState,
  action: Interaction,
  now: number = Date.now()
): InteractionResult {
  const next: PetState = {
    ...state,
    needs: { ...state.needs },
    personality: { ...state.personality },
    updatedAt: now,
    lastCareAt: now,
  };

  let note = '';
  switch (action) {
    case 'pet': {
      next.trust = clamp(state.trust + 4);
      next.arousal = clamp(state.arousal - 6);
      note = 'Contact without a request. Trust is the only thing it moves.';
      break;
    }
    case 'feed': {
      // `hunger` here is FULLNESS: 100 is a full belly, 30 is an empty one.
      if (state.needs.hunger < 62) {
        // Fed when he asked. The food is worth something, and worth more.
        next.needs.hunger = clamp(state.needs.hunger + 26);
        next.personality.foodDrive = clampTrait(state.personality.foodDrive + 0.04);
        next.arousal = clamp(state.arousal + 10);
        note = 'Fed while hungry. Good. Food is worth something, and it is worth more now.';
      } else {
        // Fed when he did not ask. The food loses its value as a reward.
        next.personality.foodDrive = clampTrait(state.personality.foodDrive - 0.08);
        next.arousal = clamp(state.arousal + 8);
        note = 'Fed while full. The value of food as a reward drops, and asking starts.';
      }
      break;
    }
    case 'play': {
      const capacity = state.needs.energy / 100;
      next.needs.energy = clamp(state.needs.energy - 16);
      next.arousal = clamp(state.arousal + 22 * capacity + (1 - capacity) * 4);
      next.trust = clamp(state.trust + 2);
      next.personality.playDrive = clampTrait(state.personality.playDrive + 0.05);
      note =
        state.needs.energy < 35
          ? 'Played on an empty tank. He was excited, and then he was done.'
          : 'Played while he had it in him.';
      break;
    }
    case 'groom': {
      next.needs.hygiene = clamp(state.needs.hygiene + 30);
      next.trust = clamp(state.trust + 3);
      next.arousal = clamp(state.arousal - 4);
      note = 'Groomed. Slow, and worth doing while he is still learning to trust the hand.';
      break;
    }
    case 'walk': {
      next.needs.energy = clamp(state.needs.energy - 12);
      next.arousal = clamp(state.arousal - 18);
      next.needs.hygiene = clamp(state.needs.hygiene - 4);
      next.trust = clamp(state.trust + 2);
      next.personality.boldness = clampTrait(state.personality.boldness + 0.03);
      note = 'Walked. Arousal down, legs exercised.';
      break;
    }
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
 */
export type ObservationTag =
  | 'ateNewFoodEagerly'
  | 'refusedFood'
  | 'nervousWithStrangers'
  | 'relaxedWithStrangers'
  | 'pulledHardOnLeash'
  | 'pulledCalmOnLeash'
  | 'soughtOutCompany'
  | 'hidUnderTheBed'
  | 'succeededAtCue'
  | 'ignoredCue';

export interface Observation {
  tag: ObservationTag;
  at: string;
  note?: string;
}

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

export function observe(state: PetState, observation: Observation): PetState {
  const effect = OBSERVATION_EFFECTS[observation.tag] ?? {};
  const personality = { ...state.personality };
  for (const [key, delta] of Object.entries(effect)) {
    const k = key as keyof typeof personality;
    personality[k] = clampTrait(personality[k] + (delta ?? 0));
  }
  return { ...state, personality, updatedAt: Date.now() };
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

/** Extinction: a behaviour nobody rewards stops, and spikes first. */
export function decayBehaviour(behaviour: Behaviour, now: number = Date.now()): Behaviour {
  if (!behaviour.lastReinforcedAt) return behaviour;
  const days = (now - new Date(behaviour.lastReinforcedAt).getTime()) / 86_400_000;
  if (days <= 0) return behaviour;
  // The extinction burst: a few days after the last reward, the behaviour
  // gets MORE likely before it collapses. Owners read this as stubbornness.
  const burst = days < 3 ? 1 + 0.25 * Math.sin((days / 3) * Math.PI) : 1;
  const decayRate = 0.06 * (behaviour.schedule === 'continuous' ? 1.6 : 1);
  return { ...behaviour, strength: clamp(behaviour.strength * (1 - decayRate * days) * burst) };
}

export function getBehaviour(state: PetState, name: BehaviourName): Behaviour {
  return (
    state.behaviours[name] ?? {
      name,
      strength: 0,
      reps: 0,
      rehearsals: 0,
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
