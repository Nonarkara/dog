/**
 * THE OPERANT ENGINE.
 *
 * A behaviour changes because of what happened AFTER it. That is the whole
 * model, and it is stricter than most people's intuitions:
 *
 *   - A marker (a click, a word) only teaches anything if it arrives within
 *     about half a second of the behaviour. Later than that and the dog
 *     cannot tell what the marker was for. This is the single most common
 *     mistake in real training, and the app can measure it, so it measures it.
 *   - The reward must follow the marker closely, or the marker predicts the
 *     clicker and not the behaviour.
 *   - A rehearsal in the app teaches YOU, not the dog. The timing statistics
 *     update; the behaviour's strength does not. Only a rep with the real
 *     animal raises it.
 *   - A behaviour nobody rewards stops, and gets MORE likely for a few days
 *     first. That spike is the extinction burst, and owners read it as
 *     stubbornness.
 *
 * The learning numbers here are a MODEL, not a claim about a real dog's
 * neurology. They are chosen to be monotone, bounded, and legible — so that
 * a change in the curve always means something changed in the world.
 */

import type { Behaviour, BehaviourName, PetState, Schedule } from './types';
import { MARKER_WINDOW_MS, clamp, getBehaviour } from './pet';

/** How fast a well-timed, well-scheduled rep raises a behaviour. */
const BASE_GAIN = 0.16;
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

/**
 * TIMING QUALITY.
 *
 * 1.0 at or under 150ms, falling to 0 at 1000ms. The window between 150ms
 * and 500ms still works, but weakly — the marker is arriving late enough
 * that the dog is starting to look elsewhere.
 */
export function timingQuality(delayMs: number | undefined): number {
  if (delayMs === undefined) return 0;
  if (delayMs <= 150) return 1;
  if (delayMs >= 1000) return 0;
  return clamp((1000 - delayMs) / 850, 0, 1);
}

/** The same window, as a verdict the coach can say out loud. */
export function timingVerdict(delayMs: number | undefined): string {
  if (delayMs === undefined) return 'No marker was given.';
  if (delayMs <= 150) return 'Marker on time.';
  if (delayMs <= MARKER_WINDOW_MS) return 'Marker late — the dog may not have connected it.';
  return 'Marker far too late. He was looking somewhere else by then.';
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
  random: number = Math.random()
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
      return repsSinceReinforcement >= 3
        ? { reinforced: true, factor: 0.7, note: 'Paid once the interval has passed.' }
        : { reinforced: false, factor: 0.3, note: 'Too early. Wait for the interval.' };
    case 'variableInterval':
      return random < 0.25
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
  random: number = Math.random()
): RepOutcome {
  const at = input.at ?? new Date().toISOString();
  const history = [
    ...behaviour.history,
    { at, real: input.real, performed: input.performed, marked: input.marked, delayMs: input.delayMs },
  ].slice(-40);

  const quality = timingQuality(input.delayMs);
  const repsSince = behaviour.history.filter((a) => a.real && a.performed).length;
  const { reinforced, factor, note } = scheduleEffect(behaviour.schedule, repsSince, random);

  let strength = behaviour.strength;
  let delta = 0;
  let explanation = '';

  if (input.performed) {
    if (input.marked && reinforced) {
      // A well-timed, rewarded rep. Diminishing returns: the closer to
      // certainty, the less a single rep can add.
      delta = BASE_GAIN * quality * factor * (1 - strength);
      // A REHEARSAL teaches the person, not the dog. The number that moves
      // is the person's timing; the behaviour on the record does not move
      // until the same thing happens with the real animal.
      if (input.real) {
        strength = clamp(strength + delta, 0, 1);
        explanation = `Reinforced, ${Math.round(quality * 100)}% on timing. ${note}`;
      } else {
        strength = behaviour.strength;
        explanation = `Rehearsed, not reinforced on the record. Your timing was ${Math.round(
          quality * 100
        )}%. Do it with the real dog and it counts.`;
      }
    } else if (input.marked && !reinforced) {
      explanation = `Performed and marked, but not paid for. ${note}`;
    } else {
      delta = -BASE_LOSS * 0.5;
      if (input.real) {
        strength = clamp(strength + delta, 0, 1);
      }
      explanation = 'Performed, unmarked. No consequence, so nothing was learned.';
    }
  } else {
    delta = -BASE_LOSS;
    if (input.real) {
      strength = clamp(strength + delta, 0, 1);
    }
    explanation = 'Did not perform. The cue and the consequence are not connected yet.';
  }

  // Trust: a cue that never pays costs a little. A cue that pays, on time,
  // earns a little.
  const trustDelta = input.performed && input.marked && reinforced ? 1.5 : input.marked ? 0 : -1;

  const next: Behaviour = {
    ...behaviour,
    strength,
    reps: behaviour.reps + (input.real && input.performed && input.marked && reinforced ? 1 : 0),
    rehearsals: behaviour.rehearsals + (input.real ? 0 : 1),
    lastReinforcedAt:
      input.real && input.performed && input.marked && reinforced
        ? at
        : behaviour.lastReinforcedAt,
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
  const outcome = applyRep(current, input, random);
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
export function nextApproximation(behaviour: BehaviourName): string {
  switch (behaviour) {
    case 'sit':
      return 'He drops his back end. Mark that, not the sit.';
    case 'down':
      return 'He lowers his back end. Mark that, not the down.';
    case 'paw':
      return 'He lifts a paw. Mark that, not the paw.';
    case 'stay':
      return 'He stays for one second. Mark that, not the minute.';
    case 'come':
      return 'He looks at you. Mark that, not the coming.';
    case 'leaveIt':
      return 'He moves his head away. Mark that, not the leaving.';
    case 'wait':
      return 'He holds still for one breath. Mark that, not the waiting.';
    case 'fetch':
      return 'He picks it up. Mark that, not the bringing back.';
  }
}

/**
 * THE CUE. A dog learns a word when the word and the behaviour arrive
 * together, repeatedly, before the behaviour does.
 */
export function addCue(behaviour: Behaviour, cue: string): Behaviour {
  const clean = cue.trim().toLowerCase();
  if (!clean || behaviour.cues.includes(clean)) return behaviour;
  return { ...behaviour, cues: [...behaviour.cues, clean] };
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
    return { advance: true, reason: 'Reliable. Move to every third rep before the reward goes stale.' };
  }
  if (behaviour.schedule === 'fixedRatio' && behaviour.reps < 12) {
    return { advance: false, reason: 'Doing every third. Do a dozen reps before the schedule gets harder.' };
  }
  if (behaviour.schedule === 'fixedRatio') {
    return { advance: true, reason: 'Solid on every third. Make the reward unpredictable now.' };
  }
  if (behaviour.schedule === 'variableRatio' && behaviour.reps < 30) {
    return { advance: false, reason: 'On an unpredictable schedule. Give it thirty reps before you add difficulty.' };
  }
  if (behaviour.schedule === 'variableRatio') {
    return { advance: true, reason: 'Holds up on an unpredictable schedule. Add distance, then distraction.' };
  }
  return { advance: false, reason: 'Keep the schedule for now.' };
}
