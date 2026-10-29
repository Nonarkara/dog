/**
 * THE TYPES OF THE INNER LIFE.
 *
 * Kept in one file so the model can be read as a whole: a state, a behaviour,
 * an attempt, a schedule.
 */

export type NeedKey = 'hunger' | 'energy' | 'hygiene';

/**
 * THE SUBJECT OF A SENTENCE.
 *
 * The notes this app writes are about a particular animal, so they use that
 * animal's name. A note that says "Expo" while the reader is holding Mali is a
 * lie about who is being cared for; a note that says "he" for a dog the reader
 * just enrolled as female is a lie about the dog. The subject carries the
 * name and the sex so that neither has to be guessed at the point of use.
 */
export interface Subject {
  name: string;
  sex: 'male' | 'female';
}

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
  /**
   * Reps that HAPPENED with the real animal, whether they were paid for or
   * not. The coach talks about reps ("do a dozen"), and a dozen is a dozen
   * whether or not the schedule paid for every third one.
   */
  performedReps: number;
  /** Rehearsed reps in the app. These do not raise `strength`. */
  rehearsals: number;
  /**
   * How many reps have happened since the last reward.
   *
   * It is stored rather than counted out of the history, because the history
   * is a window of forty: counting from it froze the schedule once the window
   * filled, and a fixed ratio that never pays again is worse than no schedule
   * at all.
   */
  repsSinceReinforcement: number;
  /** When the strength was last decayed, so the decay can be applied once. */
  decayedAt?: number;
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

/**
 * WHAT THE OWNER SAW.
 *
 * The observation log is the channel from the real animal into the model. It
 * is kept because it is the evidence: a personality number that cannot be
 * traced back to something that happened is a number nobody should trust.
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

export const OBSERVATION_LABELS: Record<ObservationTag, string> = {
  ateNewFoodEagerly: 'Ate a new food eagerly',
  refusedFood: 'Refused food',
  nervousWithStrangers: 'Nervous with strangers',
  relaxedWithStrangers: 'Relaxed with strangers',
  pulledHardOnLeash: 'Pulled hard on the leash',
  pulledCalmOnLeash: 'Walked calmly on the leash',
  soughtOutCompany: 'Sought out company',
  hidUnderTheBed: 'Hid under the bed',
  succeededAtCue: 'Succeeded at a cue',
  ignoredCue: 'Ignored a cue',
};

export const OBSERVATION_TAGS = Object.keys(OBSERVATION_LABELS) as ObservationTag[];

/**
 * SLEEP.
 *
 * A dog sleeps like we do: at night, and when he is spent. He is harder to
 * wake than a human is, and — this is the part that matters — if you keep
 * him up past his bedtime, he does not go straight back down. He takes it
 * personally, and he sulks.
 *
 * That is the whole point of a Tamagotchi: it is fun AND it is a burden,
 * because you cannot look away for long without something needing you, and
 * you cannot simply decide the animal is finished for the night.
 */
export interface SleepState {
  /** TRUE when he is asleep, curled up, breathing slowly. */
  asleep: boolean;
  /** When he fell asleep. */
  fellAsleepAt: number | null;
  /** When he was last woken. */
  wokenAt: number | null;
  /** How many times he has been woken since he last settled. */
  wakeCount: number;
  /**
   * How hard it is to settle again, 0..1.
   *
   * Waking him raises it. Time asleep lowers it. A dog woken twice in one
   * night is twice as reluctant to go back down, so the bar for settling
   * rises with every interruption.
   */
  restlessness: number;
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
  /** What the owner actually saw, newest last. */
  observations: Observation[];
  /** Whether he is asleep, and how hard he is to settle. */
  sleep: SleepState;
  lastCareAt: number;
  lastRealSessionAt?: number;
  /** The last cue word the owner said, for classical-conditioning pairing. */
  lastCue?: string;
  /** When the last cue was said. */
  lastCueAt?: number;
  /** Practice-field progress per behaviour, with the dog on the stage. */
  lessons?: Record<string, import('./lesson').Lesson>;
  /** Time spent with him: today, in total, and the run of days. */
  together?: import('./attention').Together;
  /** He is asking for you, and why. */
  call?: import('./attention').Call;
  /** Tamagotchi waste mechanic: uncleaned poops on the stage (0..4). */
  poopCount: number;
  /** Persisted daily timers: toilet, digestion and boredom. Old saves default safely. */
  life?: import('./dailyLife').DailyLife;
  lastPoopedAt?: number;
  /** Sickness from neglect, dirty stage, or extreme hunger. */
  sick: boolean;
  sickSince?: number;
  /** Tamagotchi discipline: 0..100%. Raised by firm scolding on misbehaviour; spoiled by pampering bad calls. */
  discipline: number;
  /** Biological weight in kg. Influenced by overfeeding vs active play. */
  weightKg?: number;
}
