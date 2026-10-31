/**
 * CAPTURING: how a dog learns a word he never heard before.
 *
 * You say "Sit" and he has no idea. He wanders, sniffs, lies down — and
 * sooner or later sits on his own. In that instant you say "Sit!" and pet
 * him. Do that a few times and the word starts to *predict* the pet (that part
 * is Pavlov); the sit that earned it gets more likely (that part is Skinner).
 * Then one day "Sit" and he is already down on his haunches, wagging, waiting.
 *
 * The rule the whole game rests on: association only rises when the mark
 * lands while he is actually doing the thing. You have to be watching.
 */
import type {BehaviourName, PetState} from './types';

export interface Capture {association:number; pairings:number}

/** Sit first. Nothing else opens until the one before it is learned. */
export const LEARN_ORDER:BehaviourName[]=['sit','down','paw','come','fetch','stay','wait','leaveIt'];
export const LEARNED=.8;
export const PAIR_WITH_PET=.18, PAIR_NO_PET=.06, WRONG_MARK=.04;
export const PET_WINDOW_MS=3000, OFFER_HOLD_MS=1500;

const clamp01=(n:number)=>Math.max(0,Math.min(1,n));

export function captureOf(state:PetState,name:BehaviourName):Capture{
  const c=state.capture?.[name];
  if(c)return c;
  // Saves from before capturing keep what the dog already knew.
  const l=state.lessons?.[name];
  return l&&(l.stage>=1||l.skill>=LEARNED)?{association:1,pairings:0}:{association:0,pairings:0};
}
export const isLearned=(s:PetState,n:BehaviourName)=>captureOf(s,n).association>=LEARNED;
export function isUnlocked(s:PetState,n:BehaviourName){
  const i=LEARN_ORDER.indexOf(n);
  return i<=0||isLearned(s,n)||isLearned(s,LEARN_ORDER[i-1]);
}
/** The behaviour he must learn before `n`, or null when `n` is open. */
export const lockedBehind=(s:PetState,n:BehaviourName)=>isUnlocked(s,n)?null:LEARN_ORDER[LEARN_ORDER.indexOf(n)-1];

/** Chance that his next spontaneous offer is the cued behaviour. */
export const offerChance=(association:number)=>.12+.83*clamp01(association);

/** A mark while he does it, followed (or not) by a pet. */
export function pair(c:Capture,petted:boolean):Capture{
  // Only a mark *and* a pet is a catch; a mark alone nudges the word a little.
  return {association:clamp01(c.association+(petted?PAIR_WITH_PET:PAIR_NO_PET)),pairings:c.pairings+(petted?1:0)};
}
/** A mark at the wrong moment teaches the wrong thing, a little. */
export const wrongMark=(c:Capture):Capture=>({...c,association:clamp01(c.association-WRONG_MARK)});

export function withCapture(s:PetState,n:BehaviourName,c:Capture):PetState{
  return {...s,capture:{...s.capture,[n]:c}};
}
