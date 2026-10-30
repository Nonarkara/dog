/**
 * A NEGLECTED DOG NEVER DIES. HE RUNS AWAY.
 *
 * The owner's rule (2026-10-31): after about three days with nobody caring
 * for him, while he is hungry, he slips out. He is not gone forever: he is in
 * the park, wary. Find him there and win him back with a few gentle pets, and
 * he comes home — trusting you less than before, and hungry.
 *
 * The pull comes from his relief when you return, never from fear of loss.
 */

import type { PetState } from './types';

export const RUN_AWAY_AFTER_MS = 72 * 3_600_000;
/** Hunger is fullness: at or below this he is hungry enough to go looking for food. */
export const RUN_AWAY_HUNGER = 15;
/** Gentle pets in the park that bring him home. */
export const COAX_PETS = 3;
/** The trust he comes home with, at most. */
export const RETURN_TRUST = 35;

export function maybeRunAway(state: PetState, now: number = Date.now()): PetState {
  if (state.away) return state;
  if (now - state.lastCareAt < RUN_AWAY_AFTER_MS) return state;
  if (state.needs.hunger > RUN_AWAY_HUNGER) return state;
  return { ...state, away: { since: now, coaxed: 0 } };
}

/** One gentle pet in the park while he is away. Three bring him home. */
export function coax(state: PetState, now: number = Date.now()): { state: PetState; home: boolean } {
  if (!state.away) return { state, home: false };
  const coaxed = state.away.coaxed + 1;
  if (coaxed < COAX_PETS) return { state: { ...state, away: { ...state.away, coaxed } }, home: false };
  const { away: _gone, ...rest } = state;
  return {
    state: { ...rest, trust: Math.min(state.trust, RETURN_TRUST), arousal: 40, lastCareAt: now },
    home: true,
  };
}
