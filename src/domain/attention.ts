/**
 * ATTENTION IS THE CURRENCY.
 *
 * What a Tamagotchi actually does, under the pixels: its needs drain in
 * real time, it CALLS you when something is wrong, answering promptly is
 * what builds the relationship, and the only thing you ever spend on it is
 * your time. This module is that loop and nothing else.
 *
 *   - Time together is counted from real activity with the app in front of
 *     you, never from button presses — tapping "pet" forty times in a second
 *     is not forty units of attention.
 *   - A call fades if you ignore it. Nothing is punished: you simply did not
 *     get the trust that answering would have earned.
 */

import type { NeedKey, PetState } from './types';

export interface Together {
  /** Local calendar day, YYYY-MM-DD, that `todaySec` belongs to. */
  day: string;
  todaySec: number;
  totalSec: number;
  /** Consecutive days with any time together. */
  streak: number;
}

export type CallReason = 'hungry' | 'dirty' | 'lonely' | 'sick' | 'tantrum';
export type Answer = 'feed' | 'groom' | 'pet' | 'play' | 'walk' | 'medicine' | 'scold' | 'clean';

export interface Call {
  reason: CallReason;
  since: number;
}

/** Answer within this window and he remembers that you came. */
export const ANSWER_WINDOW_MS = 5 * 60_000;
/** Ignore him for this long and he gives up asking. */
export const CALL_FADES_MS = 10 * 60_000;
/** No contact for this long and he comes looking for you. */
export const LONELY_AFTER_MS = 45 * 60_000;

export const dayKey = (now: number): string => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function addTogether(t: Together | undefined, seconds: number, now: number = Date.now()): Together {
  const today = dayKey(now);
  if (!t) return { day: today, todaySec: seconds, totalSec: seconds, streak: 1 };
  if (t.day === today) return { ...t, todaySec: t.todaySec + seconds, totalSec: t.totalSec + seconds };
  const yesterday = dayKey(now - 86_400_000);
  return {
    day: today,
    todaySec: seconds,
    totalSec: t.totalSec + seconds,
    streak: t.day === yesterday ? t.streak + 1 : 1,
  };
}

const NEED_CALLS: { need: NeedKey; below: number; reason: CallReason }[] = [
  { need: 'hunger', below: 35, reason: 'hungry' },
  { need: 'hygiene', below: 30, reason: 'dirty' },
];

/** Why he would call for you right now, if he would. A sleeping dog does not call. */
export function whyCalling(state: PetState, now: number = Date.now()): CallReason | null {
  if (state.sleep?.asleep) return null;
  if (state.sick) return 'sick';
  if ((state.poopCount ?? 0) > 0) return 'dirty';
  for (const c of NEED_CALLS) if (state.needs[c.need] < c.below) return c.reason;
  // Tamagotchi classic: misbehaviour call (calls despite having all needs fulfilled).
  if (
    (state.discipline ?? 50) < 50 &&
    state.needs.hunger > 70 &&
    state.needs.energy > 60 &&
    now - state.lastCareAt < 25 * 60_000
  ) {
    return 'tantrum';
  }
  if (now - state.lastCareAt > LONELY_AFTER_MS) return 'lonely';
  return null;
}

export const ANSWERS: Record<CallReason, Answer[]> = {
  hungry: ['feed'],
  dirty: ['groom', 'clean'],
  lonely: ['pet', 'play', 'walk'],
  sick: ['medicine'],
  tantrum: ['play', 'walk', 'scold'],
};

export const CALL_TEXT: Record<CallReason, string> = {
  hungry: 'is hungry and looking at the bowl',
  dirty: 'is in a messy area and needs cleaning',
  lonely: 'is looking for you',
  sick: 'is shivering, whimpering and needs medicine',
  tantrum: 'is asking for something to do; try play or a sniff walk',
};

/**
 * One step of the call loop: start a call, let an old one fade, or keep it.
 */
export function tickCall(state: PetState, now: number = Date.now()): { call: Call | undefined; started: boolean } {
  const current = state.call;
  if (current) {
    if (now - current.since > CALL_FADES_MS || state.sleep?.asleep) return { call: undefined, started: false };
    return { call: current, started: false };
  }
  const reason = whyCalling(state, now);
  return reason ? { call: { reason, since: now }, started: true } : { call: undefined, started: false };
}

/** Did this action answer his call, and in time to count? */
export function answerCall(
  state: PetState,
  action: Answer,
  now: number = Date.now()
): { answered: boolean; trustBonus: number } {
  const call = state.call;
  if (!call || !ANSWERS[call.reason].includes(action)) return { answered: false, trustBonus: 0 };
  return { answered: true, trustBonus: now - call.since <= ANSWER_WINDOW_MS ? 3 : 1 };
}

export const minutes = (sec: number): string =>
  sec < 3600 ? `${Math.floor(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`;
