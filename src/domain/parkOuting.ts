import type {PetState} from './types';
import {completeParkWalk,gameState} from './companionGame';
import {answerCall,LONELY_AFTER_MS,whyCalling} from './attention';
import {dailyLife} from './dailyLife';
import {grantWish,logCare} from './life';

export interface ParkOutingResult {
 state:PetState;
 credited:boolean;
 wished:boolean;
 coinsAwarded:number;
 trustAwarded:number;
 note:string|null;
}

/** Credit the outing itself once, then resolve the care promises it actually fulfilled. */
export function finishParkOuting(state:PetState,now:number,movingSeconds:number,distance:number):ParkOutingResult {
 const walked=completeParkWalk(state,now,movingSeconds,distance);
 if(walked===state)return {state,credited:false,wished:false,coinsAwarded:0,trustAwarded:0,note:null};
 let next=logCare({...walked,lastCareAt:now},'walk');
 const call=state.call,life=dailyLife(next);
 // A lower-priority need can disappear behind a new urgent one. Verify its
 // actual threshold too, so a still-bored hungry dog gets no false answer bonus.
 const relieved=call&&(call.reason==='toilet'?life.bladder<70:
  call.reason==='bored'?life.boredom<55:
  call.reason==='lonely'?now-next.lastCareAt<=LONELY_AFTER_MS:
  call.reason==='tantrum'?next.arousal<=75:false);
 const answer=answerCall(state,'walk',now);
 if(answer.answered&&relieved&&whyCalling(next,now)!==call?.reason){
  next=logCare({...next,call:undefined,trust:Math.min(100,next.trust+answer.trustBonus)},'answered');
 }
 const wish=grantWish(next,'walk',now);next=wish.state;
 const coinsAwarded=gameState(next).coins-gameState(state).coins;
 const trustAwarded=next.trust-state.trust;
 const facts=['Home from a sniff walk: a toilet break and a little company.'];
 if(wish.granted)facts.push('Today’s walk wish fulfilled.');
 if(coinsAwarded>0)facts.push(`+${coinsAwarded} paw coins.`);
 return {state:next,credited:true,wished:wish.granted,coinsAwarded,trustAwarded,note:facts.join(' ')};
}
