/**
 * TRUST IS A RECORD OF CONSISTENCY, NOT OF TAPPING.
 *
 * Each kind of care earns trust once, then rests for ten minutes. Eleven pets
 * in a row used to take a new dog from 60 to 100 in twenty seconds, and a day
 * of neglect followed by clean, medicine, groom and pet ended above where it
 * started. Everything else an action does (the meter it fills, the mood, the
 * animation) still happens every time; only the trust waits. Coming back
 * through the day is what builds it.
 *
 * Inside a rest window a kind is worth its BEST award, not its first: a lost
 * cups round (+1) followed by a win (+3) ends at +3, never at +1. A loss is
 * rested the same way, so ten clumsy trials cost what one does.
 *
 * A stamp from a clock that ran ahead is ignored, so a corrected clock can
 * never lock a kind of care out of earning.
 */
import type { PetState } from './types';

export const TRUST_REST_MS = 10 * 60_000;
const bound = (n: number) => Math.max(0, Math.min(100, n));
/** The open window for this kind, or null when it has rested (or its stamp is from the future). */
const open = (state: PetState, kind: string, now: number) => {
  const at = state.trustAt?.[kind];
  return at !== undefined && at <= now && now - at < TRUST_REST_MS ? { at, got: state.trustGot?.[kind] ?? 0 } : null;
};

/** Trust for a kind of care: the full amount after a rest, a top-up to the best award inside one. */
export function earnTrust(state: PetState, kind: string, amount: number, now: number): PetState {
  if (!(amount > 0)) return state;
  const window = open(state, kind, now);
  const extra = window ? amount - window.got : amount;
  if (extra <= 0) return state;
  return {
    ...state,
    trust: bound(state.trust + extra),
    trustAt: { ...state.trustAt, [kind]: window ? window.at : now },
    trustGot: { ...state.trustGot, [kind]: window ? amount : amount },
  };
}

/** Trust lost for a kind of mistake, at most once per rest. `amount` is positive. */
export function chargeTrust(state: PetState, kind: string, amount: number, now: number): PetState {
  if (!(amount > 0) || open(state, kind, now)) return state;
  return { ...state, trust: bound(state.trust - amount), trustAt: { ...state.trustAt, [kind]: now }, trustGot: { ...state.trustGot, [kind]: 0 } };
}
