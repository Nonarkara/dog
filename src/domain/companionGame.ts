import type {PetState} from './types';
import {dailyLife} from './dailyLife';
/** Virtual game economy only; meals never depend on performing a trick. */
export interface CompanionGame {coins:number;portions:number;paidMinutes:number;extras:number;wakeMinute:number;bedMinute:number;wakeBark:boolean;homes:string[];socialVisits:number;lastGreetingAt?:number;lastOutingAt?:number;touchDiscoveries:string[];}
const finite=(x:unknown,d:number)=>typeof x==='number'&&Number.isFinite(x)?x:d;
/**
 * THE HOUSE'S EVENING.
 * Night starts at the bedtime the owner sets, from 20:00 to 01:00 (stored as minutes
 * after the previous midnight, so 01:00 is 1500). An evening player can keep the dog
 * up until they come home; an early household can put it down at eight.
 */
export const DEFAULT_BEDTIME=22*60,BEDTIME_EARLIEST=20*60,BEDTIME_LATEST=25*60;
export const WAKE_MINUTES:Record<string,number>={'expo-2021':375,'mali-2022':420,'oreo-frenchie':360,'paolo-pug':450,'shiba-chai':390};
export function gameState(state:Pick<PetState,'game'|'together'>,id=''):CompanionGame{
 const g=state.game,minutes=Math.floor(Math.max(0,finite(state.together?.totalSec,0))/60),paid=Math.max(0,Math.floor(finite(g?.paidMinutes,0)));
 return {coins:Math.min(200,Math.max(0,finite(g?.coins,18))+Math.max(0,minutes-paid)*3),portions:Math.max(0,Math.floor(finite(g?.portions,3))),paidMinutes:Math.max(minutes,paid),extras:Math.max(0,finite(g?.extras,0)),wakeMinute:Math.floor(Math.min(600,Math.max(240,finite(g?.wakeMinute,WAKE_MINUTES[id]??390)))),bedMinute:Math.round(Math.min(BEDTIME_LATEST,Math.max(BEDTIME_EARLIEST,finite(g?.bedMinute,DEFAULT_BEDTIME)))/30)*30,homes:Array.isArray(g?.homes)?g.homes.filter((x:unknown)=>typeof x==='string'):[],wakeBark:g?.wakeBark===true,socialVisits:Math.max(0,finite(g?.socialVisits,0)),lastGreetingAt:g?.lastGreetingAt,lastOutingAt:g?.lastOutingAt,touchDiscoveries:Array.isArray(g?.touchDiscoveries)?g.touchDiscoveries.filter(x=>typeof x==='string'):[]};
}
export function buyFood(state:PetState):{state:PetState;note:string}{
 const g=gameState(state);if(g.coins<6)return {state,note:'A food pouch costs 6 paw coins. A minute of active time together earns 3.'};
 return {state:{...state,game:{...g,coins:g.coins-6,portions:g.portions+3}},note:'Three meal portions added to the pantry. −6 paw coins.'};
}
export function takeMeal(state:PetState):{state:PetState;allowed:boolean;note:string}{
 const g=gameState(state);
 // 75 is where a meal stops adding fullness (pet.ts), so that is where the pantry stops handing one out.
 if(state.needs.hunger>=75)return {state:{...state,game:{...g,extras:g.extras+1}},allowed:false,note:'That belly is full. Save the meal; a little play or company is better now.'};
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
 if(state.sleep.asleep||state.sick||!Number.isFinite(movingSeconds)||!Number.isFinite(distance)||movingSeconds<10||distance<120)return state;
 const life=dailyLife(state);
 // The rewards rest for twenty minutes between outings; the toilet break never does.
 if(now-(g.lastOutingAt??0)<20*60*1000)return life.bladder>0?{...state,life:{...life,bladder:0}}:state;
 return {...state,game:{...g,lastOutingAt:now,coins:Math.min(200,g.coins+3)},life:{...life,boredom:Math.max(0,life.boredom-25),bladder:0},trust:Math.min(100,state.trust+3),arousal:Math.max(0,state.arousal-8),needs:{...state.needs,energy:Math.max(0,state.needs.energy-3)},personality:{...state.personality,boldness:Math.min(1,state.personality.boldness+.01)}};
}

/**
 * WHAT COINS ARE FOR.
 * Coins come from time spent together (3 a minute, see gameState). Food is cheap on
 * purpose, so basic care never waits on a wallet. The rooms are what a player saves
 * for: the house is free, every other room is bought once and kept, and the dog can
 * move between owned rooms at any time. A saved room the dog already lives in counts
 * as owned, so no existing player loses the room they chose.
 */
export const HOME_PRICES:Record<string,number>={house:0,apartment:30,studio:30,farm:50,school:60,office:60,heaven:90};
export const ownsHome=(state:PetState,id:string)=>(HOME_PRICES[id]??Infinity)===0||state.home===id||gameState(state).homes.includes(id);
export function moveHome(state:PetState,id:string):{state:PetState;moved:boolean;note:string}{
 const price=HOME_PRICES[id];
 if(price===undefined)return {state,moved:false,note:''};
 const g=gameState(state);
 // The room being left stays owned, even one an older save chose before rooms had prices.
 const kept=state.home&&state.home!==id&&(HOME_PRICES[state.home]??0)>0&&!g.homes.includes(state.home)?[...g.homes,state.home]:g.homes;
 if(ownsHome(state,id))return {state:{...state,home:id as PetState['home'],game:{...g,homes:kept}},moved:true,note:''};
 if(g.coins<price)return {state,moved:false,note:`That room costs ${price} paw coins; there are ${Math.floor(g.coins)}. A minute together earns 3.`};
 return {state:{...state,home:id as PetState['home'],game:{...g,coins:g.coins-price,homes:[...kept,id]}},moved:true,note:`A new room, kept for good. −${price} paw coins.`};
}
