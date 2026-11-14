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

import type { PetState } from './types';
import { dailyLife } from './dailyLife';

export interface Together {
  /** Local calendar day, YYYY-MM-DD, that `todaySec` belongs to. */
  day: string;
  todaySec: number;
  totalSec: number;
  /** Consecutive days with any time together. */
  streak: number;
}

export type CallReason = 'hungry' | 'dirty' | 'lonely' | 'sick' | 'tantrum' | 'toilet' | 'bored';
export type Answer = import('./pet').Interaction;

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
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 1);
  const yesterday = dayKey(previous.getTime());
  return {
    day: today,
    todaySec: seconds,
    totalSec: t.totalSec + seconds,
    streak: t.day === yesterday ? t.streak + 1 : 1,
  };
}

/** Why he would call for you right now, if he would. A sleeping dog does not call. */
export function whyCalling(state: PetState, now: number = Date.now()): CallReason | null {
  if (state.sleep?.asleep) return null;
  if (state.sick) return 'sick';
  if(dailyLife(state).bladder>=70)return 'toilet';
  // Match the Care sentence: a hungry dog can ask for food even when
  // there is also a mess. Following the visible advice must answer the call.
  if (state.needs.hunger < 35) return 'hungry';
  if ((state.poopCount ?? 0)+dailyLife(state).peeCount > 0) return 'dirty';
  if (state.needs.hygiene < 30) return 'dirty';
  if (state.needs.energy < 25) return null;
  // Legacy save key: an overstimulated dog needs an outlet, not punishment.
  if (
    state.arousal > 75 &&
    state.needs.hunger > 70 &&
    state.needs.energy > 60 &&
    now - state.lastCareAt < 25 * 60_000
  ) {
    return 'tantrum';
  }
  if(dailyLife(state).boredom>=55)return 'bored';
  if (now - state.lastCareAt > LONELY_AFTER_MS) return 'lonely';
  return null;
}

export const ANSWERS: Record<CallReason, Answer[]> = {
  toilet: ['walk'],
  bored: ['pet','play','walk'],
  hungry: ['feed'],
  dirty: ['groom', 'clean'],
  lonely: ['pet', 'play', 'walk'],
  sick: ['medicine'],
  tantrum: ['walk'],
};

export const CALL_TEXT: Record<CallReason, string> = {
  toilet: 'is sniffing for a toilet spot; go outside',
  bored: 'is bored and looking for something to do',
  hungry: 'is hungry and looking at the bowl',
  dirty: 'is in a messy area and needs cleaning',
  lonely: 'is looking for you',
  sick: 'is shivering, whimpering and needs medicine',
  tantrum: 'is excited; offer quiet time or a sniff walk',
};

/**
 * One step of the call loop: start a call, let an old one fade, or keep it.
 */
export function tickCall(state: PetState, now: number = Date.now()): { call: Call | undefined; started: boolean } {
  const current = state.call;
  if (current) {
    if (now - current.since > CALL_FADES_MS || state.sleep?.asleep) return { call: undefined, started: false };
    const reason=whyCalling(state,now);
    if(reason!==current.reason)return {call:reason?{reason,since:now}:undefined,started:!!reason};
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
  const elapsed = now - call.since;
  if (elapsed < 0 || elapsed > CALL_FADES_MS) return { answered: false, trustBonus: 0 };
  return { answered: true, trustBonus: elapsed <= ANSWER_WINDOW_MS ? 3 : 1 };
}

/** A matching button only answers the call when the dog actually receives care. */
export function answerCareCall(before: PetState, after: PetState, action: Answer, now: number) {
  const answer = answerCall(before, action, now);
  if (!answer.answered) return answer;
  const relieved = before.call?.reason === 'hungry' ? after.needs.hunger > before.needs.hunger
    : before.call?.reason === 'sick' ? !after.sick
    : before.call?.reason === 'dirty' ? after.needs.hygiene > before.needs.hygiene ||
      (after.poopCount ?? 0) + dailyLife(after).peeCount < (before.poopCount ?? 0) + dailyLife(before).peeCount
    : after.lastCareAt === now;
  return relieved ? answer : { answered: false, trustBonus: 0 };
}

export const minutes = (sec: number): string =>
  sec < 3600 ? `${Math.floor(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`;
