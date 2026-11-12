/**
 * THE ONE NEXT THING.
 *
 * Six meters are data; a sentence is advice; a button is a way to follow it.
 * Tester, first play: "the activities are not quite clear yet". So the care
 * panel names exactly one thing to do, and carries the one control that does
 * it. Needs outrank his call, his call outranks his wish, his wish outranks
 * idle advice.
 */
import type {PetState} from './types';
import {dailyLife,dailyMood} from './dailyLife';
import {ANSWERS,CALL_TEXT} from './attention';
import {sickCause,readiness} from './pet';
import {wishFor,WISH_TEXT} from './life';

export type StepAct='feed'|'pet'|'play'|'walk'|'groom'|'clean'|'medicine'|'bed'|'practice'|'settle'|'rewardCalm';
export interface Step{text:string;act?:StepAct;why:'need'|'call'|'wish'|'idle'}
/** Wishes a single control can answer. Tricks open Practice; the cups are the icon on the stage. */
const WISH_ACT:Partial<Record<string,StepAct>>={walk:'walk',play:'play',pet:'pet',trick:'practice'};

export function nextStep(s:PetState,name:string,now:number):Step{
  const life=dailyLife(s),mess=(s.poopCount??0)+life.peeCount,mood=dailyMood(s);
  const need=(text:string,act?:StepAct):Step=>({text,act,why:'need'});
  if(s.away)return need(`${name} slipped out. Find him in the park; gentle pets bring him home.`);
  if(mood==='sick'){
    const c=sickCause(s);
    return c==='mess'?need(`${name} is ill from lying in mess. Clean up, then give medicine.`,'clean')
      :c==='hunger'?need(`${name} is ill from going hungry. Give medicine, then a meal.`,'medicine')
      :need(`${name} is still unwell. Medicine and rest.`,'medicine');
  }
  if(mood==='sleeping')return need(`${name} is sleeping. Quiet time while energy returns.`);
  if(mood==='toilet')return need(`${name} needs a toilet break. Walk before an accident.`,'walk');
  if(mood==='hungry')return need(`${name} is hungry. Food first.`,'feed');
  if(mood==='tired')return need(`${name} is tired. Tuck in for a nap.`,'bed');
  if(mood==='dirty')return need(mess?`${name}'s stage has ${mess} mess. Clean up to protect health.`:`${name} needs a groom.`,mess?'clean':'groom');
  if(s.call){
    const first=ANSWERS[s.call.reason][0];
    return {text:`${name} ${CALL_TEXT[s.call.reason]}.`,act:first as StepAct,why:'call'};
  }
  if(mood==='bored')return need(`${name} is bored. A game or a sniff walk helps.`,'play');
  if(s.calmSince!==undefined)return {text:`${name} is resting quietly. Watch, then reward calm.`,act:'rewardCalm',why:'idle'};
  const w=wishFor(s,now);
  if(!w.done)return {text:`Today ${name} ${WISH_TEXT[w.kind]}.${w.kind==='cups'?' Tap the cups icon on the stage.':''}`,act:WISH_ACT[w.kind],why:'wish'};
  if(s.trust<35)return {text:`${name} needs gentle company. A stroke builds trust.`,act:'pet',why:'idle'};
  if(s.arousal>80)return {text:`${name} is wound up. A walk brings it down.`,act:'walk',why:'idle'};
  if(s.arousal<20)return {text:`${name} is flat. A game wakes him up.`,act:'play',why:'idle'};
  if(readiness(s)>.7)return {text:`${name} is ready to learn. Open Practice.`,why:'idle'};
  return {text:`${name} is comfortable. Nothing is urgent.`,why:'idle'};
}

export const STEP_LABEL:Record<StepAct,string>={feed:'Feed',pet:'Pet',play:'Play',walk:'Walk',groom:'Groom',clean:'Clean',medicine:'Medicine',bed:'Bed',practice:'Practice',settle:'Quiet',rewardCalm:'Reward'};

/** Meters that moved by this much or more are worth showing. Decay drifts a point at a time. */
export const DELTA_MIN=2;
export function meterChanges(before:Record<string,number>,after:Record<string,number>):{key:string;d:number}[]{
  return Object.keys(after).filter(k=>k in before).map(key=>({key,d:after[key]-before[key]})).filter(c=>Math.abs(c.d)>=DELTA_MIN);
}
