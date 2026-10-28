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
  // Past the window the marker predicts nothing: the dog has already moved
  // its attention, and paying for the behaviour now teaches the marker to
  // mean "nothing in particular". So it is worth NOTHING past the window —
  // not a little. The app says the window is 500ms, and the engine has to
  // mean it.
  if (delayMs > MARKER_WINDOW_MS) return 0;
  // Inside the window it still teaches, but less and less: a mark 400ms
  // late is late enough that the dog is starting to look elsewhere.
  return clamp(1 - ((delayMs - 150) / (MARKER_WINDOW_MS - 150)) * 0.75, 0, 1);
}

/** The same window, as a verdict the coach can say out loud. */
export function timingVerdict(delayMs: number | undefined): string {
  if (delayMs === undefined) return 'No marker was given.';
  if (delayMs <= 150) return 'Marker on time.';
  if (delayMs <= MARKER_WINDOW_MS) return 'Marker late. It still taught something, less than it should have.';
  return 'Marker far too late. It taught nothing, and it taught the marker to mean nothing.';
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
            ' He was too tired or hungry to take much of it in — feed him, walk him, and try again.';
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
      return `${who}drops the back end. Mark that, not the sit.`;
    case 'down':
      return `${who}lowers the back end. Mark that, not the down.`;
    case 'paw':
      return `${who}lifts a paw. Mark that, not the paw.`;
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
    return { advance: true, reason: 'Reliable. Move to every third rep before the reward goes stale.' };
  }
  if (behaviour.schedule === 'fixedRatio' && (behaviour.performedReps ?? 0) < 36) {
    return {
      advance: false,
      reason:
        'Doing every third. Do a dozen PAID reps — that is about thirty-six tries — before the schedule gets harder.',
    };
  }
  if (behaviour.schedule === 'fixedRatio') {
    return { advance: true, reason: 'Solid on every third. Make the reward unpredictable now.' };
  }
  if (behaviour.schedule === 'variableRatio' && (behaviour.performedReps ?? 0) < 30) {
    return { advance: false, reason: 'On an unpredictable schedule. Give it thirty reps before you add difficulty.' };
  }
  if (behaviour.schedule === 'variableRatio') {
    return { advance: true, reason: 'Holds up on an unpredictable schedule. Add distance, then distraction.' };
  }
  return { advance: false, reason: 'Keep the schedule for now.' };
}
