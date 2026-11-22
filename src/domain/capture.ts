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
import {BEHAVIOURS, type BehaviourName, type PetState} from './types';

export interface Capture {association:number; pairings:number; /** When the word crossed LEARNED; absent on older saves. */ learnedAt?:number}

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
/** Local calendar day as a sortable number (20261103). */
const dayOf=(t:number)=>{const d=new Date(t);return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();};
/**
 * ONE NEW WORD A DAY.
 *
 * The next word opens the day after the one before it was learned. All eight
 * could be caught in ten minutes of one sitting, which left nothing to come
 * back for and decided the dog's character on day one. A word learned today
 * can still be practised and proofed today; only the next door waits.
 * Words learned before this rule (no learnedAt) never hold anything back.
 */
export function opensTomorrow(s:PetState,n:BehaviourName,now:number=Date.now()):boolean{
  const i=LEARN_ORDER.indexOf(n);if(i<=0||isLearned(s,n))return false;
  const before=captureOf(s,LEARN_ORDER[i-1]);
  // "Tomorrow" is a LATER day, not a different one: setting the clock back cannot open the word.
  return before.association>=LEARNED&&before.learnedAt!==undefined&&dayOf(now)<=dayOf(before.learnedAt);
}
export function isUnlocked(s:PetState,n:BehaviourName,now:number=Date.now()){
  const i=LEARN_ORDER.indexOf(n);
  return i<=0||isLearned(s,n)||(isLearned(s,LEARN_ORDER[i-1])&&!opensTomorrow(s,n,now));
}
/** The behaviour he must learn before `n`, or null when `n` is open. */
export const lockedBehind=(s:PetState,n:BehaviourName,now:number=Date.now())=>isUnlocked(s,n,now)?null:LEARN_ORDER[LEARN_ORDER.indexOf(n)-1];
/**
 * THE WORD TO TEACH NEXT.
 *
 * The behaviours unlock in order, so a reader who wants fetch and has only
 * taught sit cannot open fetch yet. This is the first word the reader has
 * NOT taught — the one that actually opens the next door.
 */
/** Today that is the first unlearned word, unless it only opens tomorrow: then the newest learned word is the one to practise. */
export const nextTeachable=(s:PetState,now:number=Date.now()):BehaviourName=>{const next=LEARN_ORDER.find(b=>!isLearned(s,b));if(!next)return 'sit';return isUnlocked(s,next,now)?next:LEARN_ORDER[LEARN_ORDER.indexOf(next)-1];};

/** Chance that his next spontaneous offer is the cued behaviour. */
export const offerChance=(association:number)=>.12+.83*clamp01(association);

/** A mark while he does it, followed (or not) by a pet. */
export function pair(c:Capture,petted:boolean):Capture{
  // Only a mark *and* a pet is a catch; a mark alone nudges the word a little.
  return {association:clamp01(c.association+(petted?PAIR_WITH_PET:PAIR_NO_PET)),pairings:c.pairings+(petted?1:0)};
}
/** A mark at the wrong moment teaches the wrong thing, a little. */
export const wrongMark=(c:Capture):Capture=>({...c,association:clamp01(c.association-WRONG_MARK)});

export function withCapture(s:PetState,n:BehaviourName,c:Capture,now:number=Date.now()):PetState{
  // The moment the word is learned is recorded once; it is what the next word waits on.
  const was=captureOf(s,n),learnedAt=c.association>=LEARNED?(was.association>=LEARNED?was.learnedAt:now):undefined;
  return {...s,capture:{...s.capture,[n]:{association:c.association,pairings:c.pairings,...(learnedAt!==undefined?{learnedAt}:{})}}};
}

/** The words taught in Coach, as the player says them ("sit", "leave it"). One
 * meaning of "knows a word" across the game: the word list and the dog's answer
 * to a spoken word both read this as well as the care-paired words. */
export const taughtWords=(s:PetState):{name:BehaviourName;label:string;cue:string}[]=>BEHAVIOURS.filter(b=>isLearned(s,b.name));
export const taughtWord=(s:PetState,spoken:string)=>{const w=spoken.toLowerCase().replace(/[^\p{L}\s]/gu,'').trim();return taughtWords(s).find(b=>b.cue.toLowerCase()===w||b.label.toLowerCase()===w);};
