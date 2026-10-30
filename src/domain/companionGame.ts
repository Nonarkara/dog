import type {PetState} from './types';
import {dailyLife} from './dailyLife';
/** Virtual game economy only; meals never depend on performing a trick. */
export interface CompanionGame {coins:number;portions:number;paidMinutes:number;extras:number;wakeMinute:number;wakeBark:boolean;socialVisits:number;lastGreetingAt?:number;lastOutingAt?:number;touchDiscoveries:string[];}
const finite=(x:unknown,d:number)=>typeof x==='number'&&Number.isFinite(x)?x:d;
export const WAKE_MINUTES:Record<string,number>={'expo-2021':375,'mali-2022':420,'oreo-frenchie':360,'paolo-pug':450,'shiba-chai':390};
export function gameState(state:Pick<PetState,'game'|'together'>,id=''):CompanionGame{
 const g=state.game,minutes=Math.floor(Math.max(0,finite(state.together?.totalSec,0))/60),paid=Math.max(0,Math.floor(finite(g?.paidMinutes,0)));
 return {coins:Math.min(200,Math.max(0,finite(g?.coins,18))+Math.max(0,minutes-paid)*3),portions:Math.max(0,Math.floor(finite(g?.portions,3))),paidMinutes:Math.max(minutes,paid),extras:Math.max(0,finite(g?.extras,0)),wakeMinute:Math.floor(Math.min(600,Math.max(240,finite(g?.wakeMinute,WAKE_MINUTES[id]??390)))),wakeBark:g?.wakeBark===true,socialVisits:Math.max(0,finite(g?.socialVisits,0)),lastGreetingAt:g?.lastGreetingAt,lastOutingAt:g?.lastOutingAt,touchDiscoveries:Array.isArray(g?.touchDiscoveries)?g.touchDiscoveries.filter(x=>typeof x==='string'):[]};
}
export function buyFood(state:PetState):{state:PetState;note:string}{
 const g=gameState(state);if(g.coins<6)return {state,note:'A food pouch costs 6 paw coins. A minute of active time together earns 3.'};
 return {state:{...state,game:{...g,coins:g.coins-6,portions:g.portions+3}},note:'Three meal portions added to the pantry. −6 paw coins.'};
}
export function takeMeal(state:PetState):{state:PetState;allowed:boolean;note:string}{
 const g=gameState(state);
 if(state.needs.hunger>=85)return {state:{...state,game:{...g,extras:g.extras+1}},allowed:false,note:'That belly is full. Save the meal; a little play or company is better now.'};
 // No paywall on basic care: an empty pantry always has a rescue meal for a hungry dog.
 if(g.portions<1&&state.needs.hunger<35)return {state:{...state,game:g},allowed:true,note:'Emergency pantry bowl — free. '};
 if(g.portions<1)return {state,allowed:false,note:'The pantry is empty. Buy a pouch with paw coins earned by spending time together.'};
 return {state:{...state,game:{...g,portions:g.portions-1}},allowed:true,note:''};
}
export function fetchLearned(state:PetState):boolean {const l=state.lessons?.fetch;return !!l&&(l.stage>0||l.skill>=.45);}
export type TouchPart='cheeks'|'chest'|'back'|'shoulders';
export const TOUCH_PREFERENCES:Record<string,TouchPart>={'expo-2021':'chest','mali-2022':'shoulders','oreo-frenchie':'back','paolo-pug':'cheeks','shiba-chai':'chest'};
export function touchPart(x:number,y:number):TouchPart{return x<.37&&y<.55?'cheeks':x<.48&&y>=.55?'chest':x<.58?'shoulders':'back';}
export function discoverTouch(state:PetState,id:string,part:TouchPart):PetState {const g=gameState(state,id);return {...state,game:{...g,touchDiscoveries:[...new Set([...g.touchDiscoveries,part])]}};}
export function socialize(state:PetState,now:number):PetState {const g=gameState(state);if(state.sleep.asleep||state.sick||now-(g.lastGreetingAt??0)<30000)return state;return {...state,game:{...g,socialVisits:g.socialVisits+1,lastGreetingAt:now},personality:{...state.personality,sociability:Math.min(1,state.personality.sociability+.02)},arousal:Math.min(65,state.arousal+2)};}

/** Credit an actual outing on return, not opening the park or repeated Home taps. */
export function completeParkWalk(state:PetState,now:number,movingSeconds:number,distance:number):PetState {
 const g=gameState(state);
 if(state.sleep.asleep||state.sick||!Number.isFinite(movingSeconds)||!Number.isFinite(distance)||movingSeconds<10||distance<120||now-(g.lastOutingAt??0)<20*60*1000)return state;
 const life=dailyLife(state);
 return {...state,game:{...g,lastOutingAt:now,coins:Math.min(200,g.coins+3)},life:{...life,boredom:Math.max(0,life.boredom-25),bladder:Math.max(0,life.bladder-30)},trust:Math.min(100,state.trust+3),arousal:Math.max(0,state.arousal-8),needs:{...state.needs,energy:Math.max(0,state.needs.energy-3)},personality:{...state.personality,boldness:Math.min(1,state.personality.boldness+.01)}};
}
