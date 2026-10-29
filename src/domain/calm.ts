import type {PetState} from './types';
import {dailyLife} from './dailyLife';

// Authored practice pacing, not a promise about how fast a real dog relaxes.
export const CALM_WAIT_MS=3000;
export const CALM_REWARD_COOLDOWN_MS=60_000;

export function calmNeed(state:PetState):string|null {
  if(state.sleep.asleep)return 'Let the dog sleep.';
  if(state.sick)return 'Care and rest first; calm practice can wait.';
  if(dailyLife(state).bladder>=70)return 'Toilet break first.';
  if(state.needs.hunger<35)return 'Food first.';
  if(state.needs.energy<25)return 'Rest first.';
  if(state.needs.hygiene<30||(state.poopCount??0)+dailyLife(state).peeCount>0)return 'Clean up first.';
  return null;
}

export function calmRewardWait(state:PetState,now:number):number {
  return Math.max(0,CALM_WAIT_MS-(now-(state.calmSince??now)),
    state.lastCalmRewardAt===undefined?0:CALM_REWARD_COOLDOWN_MS-(now-state.lastCalmRewardAt));
}

export function calmInteraction(state:PetState,action:'settle'|'rewardCalm',now:number,name:string):{state:PetState;note:string}{
  const need=calmNeed(state);
  if(need)return {state:{...state,calmSince:undefined},note:need};
  if(action==='settle'){
    const arousal=Math.max(0,state.arousal-15);
    return {state:{...state,arousal,updatedAt:now,lastCareAt:now,
      call:state.call?.reason==='tantrum'?undefined:state.call,
      sleep:{...state.sleep,restlessness:Math.max(0,state.sleep.restlessness-.12)},
      calmSince:arousal<=55?now:undefined},
      note:arousal<=55?`${name} softens into a quiet rest. Watch, then reward calm.`:`${name} is still excited. Give space and quiet time; reward relaxed body language.`};
  }
  if(state.calmSince===undefined||state.arousal>55)return {state:{...state,calmSince:undefined},note:'Wait for relaxed body language before rewarding calm.'};
  if(calmRewardWait(state,now)>0)return {state,note:'Keep watching quietly. No reward yet.'};
  return {state:{...state,updatedAt:now,lastCareAt:now,calmSince:undefined,lastCalmRewardAt:now,
    trust:Math.min(100,state.trust+2),discipline:Math.min(100,state.discipline+5),
    call:state.call?.reason==='tantrum'?undefined:state.call},
    note:`A small reward for ${name}'s relaxed posture. Calm +5 · Trust +2. Game practice; real sessions stay separate.`};
}
