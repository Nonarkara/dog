import type {PetState} from './types';
import {dayKey} from './attention';
export interface Growth {adoptedAt:number;seed:string;careDays:string[];day:string;daySeconds:number;}
/** Deliberately authored game growth: seven different days of active care. */
export function growCompanion(state:PetState,seconds:number,now:number):PetState{
 const g=state.growth;if(!g||!Array.isArray(g.careDays)||!Number.isFinite(g.daySeconds)||seconds<=0)return state;const day=dayKey(now),daySeconds=(g.day===day?g.daySeconds:0)+Math.max(0,Math.min(seconds,60));
 const careDays=daySeconds>=60?[...new Set([...g.careDays,day])].slice(0,7):g.careDays;
 return {...state,growth:{...g,day,daySeconds,careDays}};
}
export function growthStage(state:Pick<PetState,'growth'>):{name:'Puppy'|'Youngster'|'Adult';progress:number;scale:number}{
 if(!state.growth)return {name:'Adult',progress:1,scale:1};const days=Array.isArray(state.growth.careDays)?state.growth.careDays.length:0,progress=Math.max(0,Math.min(1,days/7));
 return {name:days<3?'Puppy':days<7?'Youngster':'Adult',progress,scale:.62+.38*progress};
}
