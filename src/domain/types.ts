/**
 * THE TYPES OF THE INNER LIFE.
 *
 * Kept in one file so the model can be read as a whole: a state, a behaviour,
 * an attempt, a schedule.
 */

export type NeedKey = 'hunger' | 'energy' | 'hygiene';

/**
 * THE BEHAVIOURS THE SYSTEM TEACHES.
 *
 * A short list, chosen because each one is a different lesson in mechanics:
 * `sit` is the easiest shape to shape; `stay` is the one that needs duration;
 * `come` is the one that needs trust; `leaveIt` is the one where an
 * aversive method does the most damage; `fetch` is the one that carries a
 * reward away from you.
 */
export type BehaviourName =
  | 'sit'
  | 'down'
  | 'stay'
  | 'come'
  | 'paw'
  | 'wait'
  | 'leaveIt'
  | 'fetch';

export const BEHAVIOURS: { name: BehaviourName; label: string; cue: string }[] = [
  { name: 'sit', label: 'Sit', cue: 'sit' },
  { name: 'down', label: 'Down', cue: 'down' },
  { name: 'stay', label: 'Stay', cue: 'stay' },
  { name: 'come', label: 'Come', cue: 'come' },
  { name: 'paw', label: 'Paw', cue: 'paw' },
  { name: 'wait', label: 'Wait', cue: 'wait' },
  { name: 'leaveIt', label: 'Leave it', cue: 'leave it' },
  { name: 'fetch', label: 'Fetch', cue: 'fetch' },
];

/**
 * THE SCHEDULES.
 *
 * How often a behaviour is reinforced, not how well. This is the part almost
 * nobody gets right, and it is why a dog that is rewarded every single time
 * collapses when life stops being perfect.
 */
export type Schedule = 'continuous' | 'fixedRatio' | 'variableRatio' | 'fixedInterval' | 'variableInterval';

export const SCHEDULES: { id: Schedule; label: string; note: string }[] = [
  {
    id: 'continuous',
    label: 'Every rep',
    note: 'Every correct response is rewarded. Best for learning a shape; fragile for life.',
  },
  {
    id: 'fixedRatio',
    label: 'Every 3rd',
    note: 'Three responses per reward. Strong response rate; a pause after the reward.',
  },
  {
    id: 'variableRatio',
    label: 'Unpredictable',
    note: 'Sometimes three, sometimes twenty. The hardest schedule to stop, and the reason a habit holds.',
  },
  {
    id: 'fixedInterval',
    label: 'Every 30 seconds',
    note: 'A reward is available after a pause. Produces steady, unhurried work.',
  },
  {
    id: 'variableInterval',
    label: 'Unpredictable, over time',
    note: 'A reward may come at any moment. Steady work, without a rhythm to lean on.',
  },
];

export interface Attempt {
  /** ISO timestamp. */
  at: string;
  /** TRUE only for a rep that happened with the real animal. */
  real: boolean;
  /** Did the dog do it? */
  performed: boolean;
  /** Did you mark it? */
  marked: boolean;
  /** How long between the behaviour and the marker, in milliseconds. */
  delayMs?: number;
}

export interface Behaviour {
  name: BehaviourName;
  /** 0..1 — the chance the behaviour is available when cued. */
  strength: number;
  /** Reinforced reps with the real animal. */
  reps: number;
  /** Rehearsed reps in the app. These do not raise `strength`. */
  rehearsals: number;
  lastReinforcedAt?: string;
  /** Your average marker delay, over recent rehearsals. */
  markerDelayMs: number;
  schedule: Schedule;
  /** The words this dog answers to. */
  cues: string[];
  history: Attempt[];
}

export interface Personality {
  /** Willingness to approach the unfamiliar. */
  boldness: number;
  /** Preference for company. */
  sociability: number;
  /** How much food is worth as a reward. */
  foodDrive: number;
  /** How much play is worth as a reward. */
  playDrive: number;
  /** How easily the dog is affected by anything. */
  sensitivity: number;
}

export interface PetState {
  updatedAt: number;
  needs: Record<NeedKey, number>;
  /** The ledger of consistency: 0..100. */
  trust: number;
  /** Excitement: 0..100. */
  arousal: number;
  personality: Personality;
  behaviours: Record<string, Behaviour>;
  /** Cue name -> conditioned strength, 0..1. */
  associations: Record<string, number>;
  lastCareAt: number;
  lastRealSessionAt?: number;
}
