/**
 * THE LESSON — training the dog on the screen the way you train the dog on
 * the floor.
 *
 * The other half of the coach (training.ts) is an instrument for logging
 * reps with the real animal. This half is the practice field: Expo on the
 * stage decides for himself whether to respond, and you have to do the four
 * things a good trainer does, in order and on time:
 *
 *   1. CUE ONCE. A repeated cue becomes the cue ("sit, sit, SIT").
 *   2. WAIT. Give him about three seconds to think.
 *   3. MARK the instant the behaviour is complete — "Yes!" or a click.
 *      The scoring target is 500ms. This is game pacing, not a biological cutoff.
 *   4. TREAT within a couple of seconds of the marker.
 *
 * And a dog learns a behaviour in stages: first he follows a lure, then a
 * hand signal, then the word with the signal, then the word alone, then the
 * word anywhere (the 3 Ds: distance, duration, distraction).
 *
 * Sources: Karen Pryor, "Don't Shoot the Dog" (marker timing, shaping);
 * Ian Dunbar, lure-reward training (dogstardaily.com, SIRIUS puppy
 * training); Emily Larlham, Kikopup; AVSAB Position Statement on Humane
 * Dog Training (2021), which recommends reward-based methods and advises
 * against dominance and punishment. This app teaches reward-based training
 * only.
 *
 * The numbers are a game model, chosen to be legible — they reward the
 * same habits that work with a real dog.
 */

import type { BehaviourName, PetState } from './types';
import { timingQuality } from './training';

export const STAGES = [
  { id: 'lure', label: 'Lure', act: 'Lure', how: 'Hold a treat at his nose and move your hand to guide him into the position.' },
  { id: 'signal', label: 'Hand signal', act: 'Signal', how: 'Same hand movement, but with no treat in that hand. The treat comes from your other hand after the marker.' },
  { id: 'wordSignal', label: 'Word, then signal', act: 'Word + signal', how: 'Say the word once, pause a beat, then give the hand signal. The word starts to predict the signal.' },
  { id: 'word', label: 'Word only', act: 'Say it', how: 'Say the word once and keep your hands still. If he does not respond in three seconds, go back a stage.' },
  { id: 'proof', label: 'Anywhere', act: 'Say it', how: 'The word alone, with a little distance, duration or distraction. Raise only one at a time.' },
] as const;

export type StageIndex = 0 | 1 | 2 | 3 | 4;

export interface Lesson {
  stage: StageIndex;
  /** 0..1, how solid the behaviour is at this stage. */
  skill: number;
  /** Good trials in a row at this stage. */
  streak: number;
  /** Non-responses in a row. Two means the step was too big. */
  misses: number;
  /** Trials in the current session. */
  sessionTrials: number;
  sessionStartedAt?: number;
}

export const newLesson = (): Lesson => ({ stage: 0, skill: 0.2, streak: 0, misses: 0, sessionTrials: 0 });

/** How long a session should be. Short sessions; end on a success. */
export const SESSION_MS = 5 * 60_000;
export const SESSION_TRIALS = 15;
/** How long you should wait for him before deciding he did not respond. */
export const WAIT_MS = 3000;
/** How long after the marker the treat still counts as paying for it. */
export const TREAT_WINDOW_MS = 2000;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * DOES HE RESPOND, AND HOW SOON.
 *
 * A lure works almost every time — that is why you start there. Every later
 * stage starts weak and grows with skill. A tired, hungry or anxious dog
 * (low readiness) responds less, and slower.
 */
export function dogResponds(
  lesson: Lesson,
  readiness: number,
  random: number = Math.random(),
  random2: number = Math.random()
): { responds: boolean; latencyMs: number } {
  const ready = clamp01(readiness);
  const base = lesson.stage === 0 ? 0.88 : 0.2 + 0.72 * lesson.skill;
  const chance = base * (0.45 + 0.55 * ready);
  const latencyMs = Math.round(500 + (1 - lesson.skill) * 1400 * (1.5 - ready * 0.5) + random2 * 400);
  return { responds: random < chance, latencyMs: Math.min(latencyMs, WAIT_MS - 200) };
}

export interface TrialInput {
  /** Did he do it? */
  responded: boolean;
  /** How many times you gave the cue in this trial. */
  cueCount: number;
  /** Marker time minus completion time, ms. Negative = marked too early. Undefined = never marked. */
  markDelayMs?: number;
  /** The rendered action had not finished when the player marked. */
  markedBeforeCompletion?:boolean;
  prematureReward?:boolean;
  /** Treat time minus marker time, ms. Undefined = no treat. */
  treatDelayMs?: number;
}

export interface TrialResult {
  lesson: Lesson;
  /** 0..1, how well YOU did on this trial. */
  score: number;
  /** One line on what happened, one line on what to do next. */
  verdict: string;
  tip: string;
  trustDelta: number;
  stageChange: -1 | 0 | 1;
}

/** One trial, scored. Pure: same inputs, same lesson. */
export function scoreTrial(lesson: Lesson, input: TrialInput, now: number = Date.now()): TrialResult {
  const next: Lesson = {
    ...lesson,
    sessionTrials: lesson.sessionTrials + 1,
    sessionStartedAt: lesson.sessionStartedAt ?? now,
  };
  let score = 0;
  let verdict = '';
  let tip = '';
  let trustDelta = 0;
  let stageChange: -1 | 0 | 1 = 0;
  const repeated = input.cueCount > 1;

  if(input.prematureReward){
    next.streak=0;
    return {lesson:next,score:0,verdict:'Reward offered before the action finished.',tip:'Wait for the action, mark, then reward.',trustDelta,stageChange};
  }
  if(input.markedBeforeCompletion){
    next.streak=0;next.skill=clamp01(lesson.skill-.03);
    return {lesson:next,score:.1,verdict:'Marked before the dog finished moving.',tip:input.treatDelayMs===undefined?'Even an early marker still promises a reward.':'Watch the completed action, then mark and reward.',trustDelta,stageChange};
  }

  if (!input.responded) {
    next.streak = 0;
    next.misses = lesson.misses + 1;
    if (repeated) {
      next.skill = clamp01(lesson.skill - 0.04);
      verdict = 'He did not respond, and the cue was repeated.';
      tip = 'Say it once. Repeating it teaches him that the cue is "sit, sit, sit".';
    } else {
      verdict = 'He did not respond within three seconds.';
      tip = 'Good — you waited and did not repeat yourself.';
      score = 0.5;
    }
    if (next.misses >= 2 && lesson.stage > 0) {
      next.stage = (lesson.stage - 1) as StageIndex;
      next.skill = 0.6;
      next.misses = 0;
      stageChange = -1;
      tip = 'Two misses in a row: the step was too big. Going back a stage to make it easier.';
    }
    return { lesson: next, score, verdict, tip, trustDelta, stageChange };
  }

  next.misses = 0;


  if (input.markDelayMs === undefined) {
    next.streak = 0;
    verdict = 'Action completed; no marker recorded in this drill.';
    tip = 'This drill practises a marker followed by a reward. In real training, prompt rewards can also work without a marker.';
    return { lesson: next, score: 0.1, verdict, tip, trustDelta, stageChange };
  }

  if (input.markDelayMs < 0) {
    next.streak = 0;
    next.skill = clamp01(lesson.skill - 0.03);
    verdict = `Marked ${Math.abs(Math.round(input.markDelayMs))} ms before he finished.`;
    tip = 'An early marker pays for "almost". Wait until the behaviour is complete.';
    return { lesson: next, score: 0.1, verdict, tip, trustDelta, stageChange };
  }

  const timing = timingQuality(input.markDelayMs);
  const treated = input.treatDelayMs !== undefined;
  const treatOnTime = treated && input.treatDelayMs! <= TREAT_WINDOW_MS;
  const payFactor = treatOnTime ? 1 : treated ? 0.5 : 0.15;
  const cueFactor = repeated ? 0.5 : 1;
  score = clamp01(timing * payFactor * cueFactor);

  const gain = 0.18 * score * (1 - lesson.skill);
  next.skill = clamp01(lesson.skill + gain);
  next.streak = score >= 0.6 ? lesson.streak + 1 : 0;
  trustDelta = treatOnTime ? 1 : treated ? 0.5 : -0.5;

  const ms = Math.round(input.markDelayMs);
  verdict =
    timing === 1
      ? `Marked ${ms} ms after he finished: on time.`
      : timing > 0
        ? `Marked ${ms} ms after he finished: reduced game timing credit.`
        : `Marked ${ms} ms after he finished: outside the game timing target.`;
  tip = repeated
    ? 'He did it, but you said the cue more than once. Next time say it once and wait.'
    : !treated
      ? 'The marker is a promise. Always follow it with a treat, or the marker stops meaning anything.'
      : !treatOnTime
        ? 'Treat within two seconds of the marker.'
        : timing < 1
          ? 'Watch for the moment he completes it, and mark exactly then.'
          : 'Clean rep. Cue, wait, mark, treat.';

  if (next.skill >= 0.8 && next.streak >= 5 && lesson.stage < 4) {
    next.stage = (lesson.stage + 1) as StageIndex;
    next.skill = 0.3;
    next.streak = 0;
    stageChange = 1;
    tip = `Five clean reps in a row. Moving on to: ${STAGES[next.stage].label}.`;
  }
  return { lesson: next, score, verdict, tip, trustDelta, stageChange };
}

/** Session pacing spans behaviors; learned skills and real-session logs survive a break. */
export function practiceSession(lessons:PetState['lessons']) {
  const active=Object.values(lessons??{}).filter((lesson):lesson is Lesson=>!!lesson&&lesson.sessionTrials>0);
  return {sessionTrials:active.reduce((sum,lesson)=>sum+lesson.sessionTrials,0),
    sessionStartedAt:active.length?Math.min(...active.map(lesson=>lesson.sessionStartedAt??Date.now())):undefined};
}
export function endPracticeSession(state:PetState):PetState {
  return {...state,lessons:Object.fromEntries(Object.entries(state.lessons??{}).map(([name,lesson])=>[name,lesson?{...lesson,sessionTrials:0,sessionStartedAt:undefined,streak:0,misses:0}:lesson]))};
}

/** Should this session end? End on a success, and before he gets bored. */
export function sessionAdvice(lesson: Lesson, lastScore: number, now: number = Date.now()): string | null {
  const long = lesson.sessionStartedAt !== undefined && now - lesson.sessionStartedAt > SESSION_MS;
  if ((long || lesson.sessionTrials >= SESSION_TRIALS) && lastScore >= 0.6) {
    return 'That was a good one. End the session here — on a success — and give him a break.';
  }
  if (long || lesson.sessionTrials >= SESSION_TRIALS) {
    return 'Session is long enough. Take a break; there is no need to push for another response.';
  }
  return null;
}

/**
 * TRY IT WITH THE REAL DOG.
 *
 * The lure for each behaviour, as you would do it on the floor, with the
 * one mistake people make most.
 */
export const REAL_DOG: Record<BehaviourName, { lure: string; mistake: string }> = {
  sit: {
    lure: 'Treat at his nose, move it slowly up and back over his head. His bottom drops as his head rises. Mark the moment it touches the floor.',
    mistake: 'Pushing his bottom down. Let the lure do it.',
  },
  down: {
    lure: 'From a sit, take the treat from his nose straight down to between his paws, then slowly along the floor. Mark when his elbows touch.',
    mistake: 'Moving the hand too fast; he stands up to follow it.',
  },
  stay: {
    lure: 'Ask for a sit, show a flat palm, wait one second, mark, and treat him IN position. Add seconds before you add distance.',
    mistake: 'Adding distance and time together. Raise one at a time.',
  },
  come: {
    lure: 'Say his name and the word once in a happy voice, then back away. Mark as he reaches you and treat at your feet.',
    mistake: 'Calling him to end the fun or for something he dislikes. Coming must always pay.',
  },
  paw: {
    lure: 'Hold a treat in a closed fist near his paw. When he paws at it, mark and open your hand.',
    mistake: 'Grabbing his paw. Let him offer it.',
  },
  wait: {
    lure: 'At a doorway or food bowl, hold still. The moment he pauses, mark and release him with "OK".',
    mistake: 'Releasing him when he pushes forward. Only stillness opens the door.',
  },
  leaveIt: {
    lure: 'Show a treat in a closed fist. Ignore sniffing and licking. The moment he backs off, mark and pay from your OTHER hand.',
    mistake: 'Paying with the treat he was told to leave.',
  },
  fetch: {
    lure: 'Mark and treat any touch of the toy. Then only when he picks it up. Then only when he brings it closer.',
    mistake: 'Chasing him for the toy. That turns fetch into keep-away.',
  },
};

/** What his body does when he performs the behaviour, for the avatar. */
export const POSE_FOR: Record<BehaviourName, import('../components/trainingMotion').AvatarPose> = {
  sit: 'sit',
  down: 'down',
  stay: 'stay',
  come: 'come',
  paw: 'paw',
  wait: 'wait',
  leaveIt: 'leaveIt',
  fetch: 'fetch',
};
