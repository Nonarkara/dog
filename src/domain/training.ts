/**
 * THE OPERANT ENGINE.
 *
 * A behaviour changes because of what happened AFTER it. That is the whole
 * model, and it is stricter than most people's intuitions:
 *
 *   - Mark promptly, then deliver the promised reward. The 500ms cutoff
 *     below is a practice-game target, not a biological learning deadline.
 *   - Rehearsal updates practice statistics; real logs are self-reported.
 *     Their strength estimate is a game model, not a verified assessment.
 *   - Reward new skills consistently and make an exercise easier when the
 *     dog struggles. Never treat non-response as defiance.
 *
 * The learning numbers here are a MODEL, not a claim about a real dog's
 * neurology. They are chosen to be monotone, bounded, and legible — so that
 * a change in the curve always means something changed in the world.
 */

import type { Behaviour, BehaviourName, PetState, Schedule, Subject } from './types';
import { MARKER_WINDOW_MS, clamp, getBehaviour, pronouns, readiness } from './pet';

/** How fast a well-timed, well-scheduled rep raises a behaviour. */
const BASE_GAIN = 0.16;
/** The fixed interval schedule: a reward is available every 30 seconds. */
const FIXED_INTERVAL_MS = 30_000;
/** How fast an unrewarded, performed rep erodes it. */
const BASE_LOSS = 0.05;

export interface RepInput {
  behaviour: BehaviourName;
  /** TRUE only if this happened with the real animal. */
  real: boolean;
  /** Did the dog do it? */
  performed: boolean;
  /** Did you mark it? */
  marked: boolean;
  /** Milliseconds between the behaviour and the marker. */
  delayMs?: number;
  at?: string;
}

/** Authored game score: full credit through 150ms, decreasing to the 500ms target. */
export function timingQuality(delayMs: number | undefined): number {
  if (delayMs === undefined) return 0;
  if (delayMs <= 150) return 1;
  if (delayMs > MARKER_WINDOW_MS) return 0;
  return clamp(1 - ((delayMs - 150) / (MARKER_WINDOW_MS - 150)) * 0.75, 0, 1);
}

export function timingVerdict(delayMs: number | undefined): string {
  if (delayMs === undefined) return 'No marker recorded.';
  if (delayMs <= 150) return 'On the game timing target.';
  if (delayMs <= MARKER_WINDOW_MS) return 'A little late for full game credit. Aim to mark the completed action promptly.';
  return 'Marker late for the game timing target. Mark sooner next time; this score cannot measure real learning.';
}

/**
 * THE SCHEDULE'S EFFECT ON ONE REP.
 *
 * A schedule decides whether a rep is reinforced at all, and how much that
 * reinforcement is worth. Under a fixed ratio of three, only every third rep
 * is rewarded — the other two still count as performances, and the dog still
 * gets a great deal of practice without getting paid for all of it.
 */
export function scheduleEffect(
  schedule: Schedule,
  repsSinceReinforcement: number,
  random: number = Math.random(),
  msSinceReinforcement: number = 0
): { reinforced: boolean; factor: number; note: string } {
  switch (schedule) {
    case 'continuous':
      return { reinforced: true, factor: 1, note: 'Every rep is paid for.' };
    case 'fixedRatio':
      return repsSinceReinforcement % 3 === 2
        ? { reinforced: true, factor: 0.85, note: 'Every third rep is paid for.' }
        : { reinforced: false, factor: 0.35, note: 'Paid every third rep.' };
    case 'variableRatio':
      // Unpredictable, and occasionally very stingy. This is the schedule
      // that holds a behaviour through a bad week.
      return random < 0.3
        ? { reinforced: true, factor: 0.9, note: 'Paid — you cannot predict when.' }
        : { reinforced: false, factor: 0.3, note: 'Not paid. And you cannot predict when.' };
    case 'fixedInterval':
      // An INTERVAL is a length of TIME, not a number of reps. The reward is
      // available once 30 seconds have passed since the last one; before
      // that, a rep earns nothing, because paying early is what teaches a
      // dog to work for a reward that has not been earned yet.
      return msSinceReinforcement >= FIXED_INTERVAL_MS
        ? { reinforced: true, factor: 0.7, note: 'Paid — the 30 seconds are up.' }
        : {
            reinforced: false,
            factor: 0.3,
            note: `Not paid. The next one is in ${Math.max(
              0,
              Math.ceil((FIXED_INTERVAL_MS - msSinceReinforcement) / 1000)
            )}s.`,
          };
    case 'variableInterval':
      // Also a length of time, but one you cannot predict: the longer it has
      // been, the likelier the reward, and never certain.
      const waited = msSinceReinforcement / FIXED_INTERVAL_MS;
      const chance = Math.min(0.9, 0.1 + waited * 0.35);
      return random < chance
        ? { reinforced: true, factor: 0.7, note: 'Paid — at a moment of its choosing.' }
        : { reinforced: false, factor: 0.3, note: 'Not paid. It may pay later.' };
  }
}

/**
 * ONE REP, APPLIED.
 *
 * Returns the behaviour as it now stands, plus what changed and why, so the
 * app can say it out loud without inventing a reason.
 */
export interface RepOutcome {
  behaviour: Behaviour;
  strengthened: boolean;
  delta: number;
  explanation: string;
}

export function applyRep(
  behaviour: Behaviour,
  input: RepInput,
  random: number = Math.random(),
  /** How ready the dog is to learn right now, 0..1. */
  readiness: number = 1
): RepOutcome {
  const at = input.at ?? new Date().toISOString();
  const history = [
    ...behaviour.history,
    { at, real: input.real, performed: input.performed, marked: input.marked, delayMs: input.delayMs },
  ].slice(-40);

  const quality = timingQuality(input.delayMs);
  const repsSince = behaviour.repsSinceReinforcement ?? 0;
  const msSince = behaviour.lastReinforcedAt
    ? Math.max(0, Date.now() - new Date(behaviour.lastReinforcedAt).getTime())
    : Number.MAX_SAFE_INTEGER;
  const { reinforced, factor, note } = scheduleEffect(
    behaviour.schedule,
    repsSince,
    random,
    msSince
  );

  let strength = behaviour.strength;
  let delta = 0;
  let explanation = '';
  let performedReps = behaviour.performedReps ?? 0;
  let repsSinceReinforcement = repsSince;

  if (input.performed) {
    if (input.real) performedReps += 1;
    if (input.marked && reinforced) {
      // A well-timed, rewarded rep. Diminishing returns: the closer to
      // certainty, the less a single rep can add.
      //
      // And the gain is scaled by how ready the dog is: a hungry, exhausted
      // dog does not learn much from a rep, and the app says so rather than
      // crediting the dog with learning it did not do.
      delta = BASE_GAIN * quality * factor * readiness * (1 - strength);
      // A REHEARSAL teaches the person, not the dog. The number that moves
      // is the person's timing; the behaviour on the record does not move
      // until the same thing happens with the real animal.
      if (input.real) {
        strength = clamp(strength + delta, 0, 1);
        repsSinceReinforcement = 0;
        explanation = `Reinforced, ${Math.round(quality * 100)}% on timing. ${note}`;
        if (readiness < 0.45) {
          explanation +=
            ' The virtual dog needs care before more practice. Check the real dog’s comfort separately.';
        }
      } else {
        strength = behaviour.strength;
        explanation = `Rehearsed, not reinforced on the record. Your timing was ${Math.round(
          quality * 100
        )}%. Do it with the real dog and it counts.`;
      }
    } else if (input.marked && !reinforced) {
      if (input.real) repsSinceReinforcement += 1;
      explanation = `Performed and marked, but not paid for. ${note}`;
    } else {
      delta = -BASE_LOSS * 0.5;
      if (input.real) {
        strength = clamp(strength + delta, 0, 1);
        repsSinceReinforcement += 1;
      }
      explanation = 'Performed without a recorded marker. Prompt rewards can still reinforce behavior; this timing drill needs a marker.';
    }
  } else {
    delta = -BASE_LOSS;
    if (input.real) {
      strength = clamp(strength + delta, 0, 1);
    }
    explanation = 'No response recorded. Check needs and distractions, and make the next step easier.';
  }

  // Trust: a cue that never pays costs a little. A cue that pays, on time,
  // earns a little.
  const trustDelta = !input.real
    ? 0
    : input.performed && input.marked && reinforced
      ? 1.5
      : input.marked
        ? 0
        : -1;

  const paid = input.real && input.performed && input.marked && reinforced;
  const next: Behaviour = {
    ...behaviour,
    strength,
    reps: behaviour.reps + (paid ? 1 : 0),
    performedReps,
    repsSinceReinforcement,
    rehearsals: behaviour.rehearsals + (input.real ? 0 : 1),
    // A fresh reward restarts the extinction clock and the decay anchor.
    decayedAt: paid ? Date.now() : behaviour.decayedAt,
    lastReinforcedAt: paid ? at : behaviour.lastReinforcedAt,
    markerDelayMs: input.delayMs === undefined
      ? behaviour.markerDelayMs
      : behaviour.markerDelayMs === 0
        ? input.delayMs
        : Math.round(behaviour.markerDelayMs * 0.7 + input.delayMs * 0.3),
    history,
  };

  return {
    behaviour: next,
    strengthened: delta > 0,
    delta,
    explanation: `${explanation} ${trustDelta > 0 ? 'Trust up.' : trustDelta < 0 ? 'Trust down.' : ''}`.trim(),
  };
}

/** Apply a rep to the whole state. */
export function recordRep(
  state: PetState,
  input: RepInput,
  random: number = Math.random()
): { state: PetState; outcome: RepOutcome; trustDelta: number } {
  const current = getBehaviour(state, input.behaviour);
  const outcome = applyRep(current, input, random, readiness(state));
  const trustDelta = outcome.explanation.includes('Trust up.')
    ? 1.5
    : outcome.explanation.includes('Trust down.')
      ? -1
      : 0;
  return {
    state: {
      ...state,
      trust: clamp(state.trust + trustDelta),
      behaviours: { ...state.behaviours, [input.behaviour]: outcome.behaviour },
      lastRealSessionAt: input.real ? Date.now() : state.lastRealSessionAt,
    },
    outcome,
    trustDelta,
  };
}

/**
 * THE NEXT APPROXIMATION — shaping.
 *
 * If the dog will not do the full behaviour, reinforce what it does that is
 * CLOSER, and narrow the distance a little each time. The app names the
 * approximation so the person can click THAT, not the thing they want.
 */
export function nextApproximation(behaviour: BehaviourName, subject?: Subject): string {
  const p = pronouns(subject);
  const name = subject?.name?.trim();
  // "Expo drops the back end" — the name leads when there is one, otherwise
  // the sentence stays in the second person the owner is already speaking in.
  const who = name ? `${name} ` : 'The dog ';
  switch (behaviour) {
    case 'sit':
      return `${who}lowers the bottom toward the floor. Reward a useful small step.`;
    case 'down':
      return `${who}lowers the elbows toward the floor. Reward a useful small step.`;
    case 'paw':
      return `${who}lifts a paw. Mark the offered paw movement.`;
    case 'stay':
      return `${who}stays for one second. Mark that, not the minute.`;
    case 'come':
      return `${who}looks at you. Mark that, not the coming.`;
    case 'leaveIt':
      return `${who}moves ${p.poss} head away. Mark that, not the leaving.`;
    case 'wait':
      return `${who}holds still for one breath. Mark that, not the waiting.`;
    case 'fetch':
      return `${who}picks it up. Mark that, not the bringing back.`;
  }
}

/**
 * THE CUE, STORED ON THE BEHAVIOUR.
 *
 * A cue word is not a note in the interface — it is the word the dog answers
 * to, and it belongs to the behaviour it buys. So it lives with that
 * behaviour, and switching behaviours switches the word with it.
 *
 * A behaviour can answer to more than one word ("sit" and "sit down"), so the
 * list grows; the FIRST word is the one the coach will say.
 */
export function setCue(state: PetState, behaviour: BehaviourName, cue: string): PetState {
  const clean = cue.trim().toLowerCase();
  const current = getBehaviour(state, behaviour);
  const cues = clean
    ? current.cues.includes(clean)
      ? current.cues
      : [...current.cues, clean]
    : current.cues;
  return {
    ...state,
    behaviours: { ...state.behaviours, [behaviour]: { ...current, cues } },
  };
}

/** The word the coach will say for this behaviour. */
export function primaryCue(behaviour: Behaviour): string {
  return behaviour.cues[0] ?? '';
}

/**
 * HOW MANY REPS IN A ROW, AND ON WHAT SCHEDULE.
 *
 * The moment to move up is not a feeling. It is a number the person can
 * read off the app: the behaviour is reliable, and the schedule has been
 * made unpredictable for long enough that the behaviour survives a gap.
 */
export function readinessToAdvance(behaviour: Behaviour): {
  advance: boolean;
  reason: string;
} {
  if (behaviour.strength < 0.8) {
    return { advance: false, reason: 'Not reliable yet. Keep the reward for every correct response.' };
  }
  if (behaviour.schedule === 'continuous') {
    return { advance: true, reason: 'Game milestone reached. New skills still need every successful response rewarded; thin food rewards gradually only after reliability.' };
  }
  if (behaviour.schedule === 'fixedRatio' && (behaviour.performedReps ?? 0) < 36) {
    return {
      advance: false,
      reason:
        'Game schedule: every third response. Keep real exercises easy and continue rewarding new skills every time.',
    };
  }
  if (behaviour.schedule === 'fixedRatio') {
    return { advance: true, reason: 'Game milestone reached. Vary familiar rewards gradually; do not abruptly withhold rewards for a new skill.' };
  }
  if (behaviour.schedule === 'variableRatio' && (behaviour.performedReps ?? 0) < 30) {
    return { advance: false, reason: 'On an unpredictable schedule. Give it thirty reps before you add difficulty.' };
  }
  if (behaviour.schedule === 'variableRatio') {
    return { advance: true, reason: 'Holds up on an unpredictable schedule. Add distance, then distraction.' };
  }
  return { advance: false, reason: 'Keep the schedule for now.' };
}
