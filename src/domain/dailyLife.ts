import type { PetState } from './types';

/** Authored game pacing. This is a virtual dog's day, not clinical physiology. */
export interface DailyLife {
  bladder: number;
  boredom: number;
  digestionMinutes: number;
  lowFullnessMinutes: number;
  peeCount: number;
  lastPeedAt?: number;
}
const bound=(n:number,hi=100)=>Math.max(0,Math.min(hi,n));
const number=(n:unknown,fallback=0)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
export function dailyLife(state: Pick<PetState,'life'>): DailyLife {
  const l=state.life;
  return {bladder:bound(number(l?.bladder)),boredom:bound(number(l?.boredom)),
    digestionMinutes:bound(number(l?.digestionMinutes),90),lowFullnessMinutes:bound(number(l?.lowFullnessMinutes),4320),
    peeCount:Math.floor(bound(number(l?.peeCount),3)),lastPeedAt:typeof l?.lastPeedAt==='number'&&Number.isFinite(l.lastPeedAt)?l.lastPeedAt:undefined};
}
export function advanceDailyLife(state:PetState,minutes:number,now:number){
  const life=dailyLife(state),elapsed=bound(minutes,4320),bodyMinutes=elapsed*(state.sleep?.asleep ? .25 : 1);
  const bladder=life.bladder+bodyMinutes*100/35,pees=Math.floor((bladder+1e-8)/100);
  // Use accumulated digestion rather than a single frame's elapsed time.
  const fedMinutes=state.needs.hunger>30?Math.min(elapsed,Math.max(0,(state.needs.hunger-30)/1.6*60)):0;
  const digestion=life.digestionMinutes+fedMinutes*(state.sleep?.asleep ? .4 : 1),poops=Math.floor((digestion+1e-8)/90);
  const lowMinutes=state.needs.hunger<10?elapsed:Math.max(0,elapsed-(state.needs.hunger-10)/1.6*60);
  // Two puddles and two piles is a messy home. Six, with no warning, is a punishment.
  return {life:{...life,bladder:bound(bladder-pees*100),boredom:bound(life.boredom+elapsed*(state.sleep?.asleep?-.25:100/30)),
    digestionMinutes:Math.max(0,digestion-poops*90),lowFullnessMinutes:lowMinutes>0?life.lowFullnessMinutes+lowMinutes:0,
    peeCount:Math.min(2,life.peeCount+pees),lastPeedAt:pees?now:life.lastPeedAt},
    poopCount:Math.min(2,(state.poopCount??0)+poops),lastPoopedAt:poops?now:state.lastPoopedAt};
}
export type DailyMood='sleeping'|'sick'|'toilet'|'bored'|'hungry'|'tired'|'dirty'|'content';
export function dailyMood(state:PetState):DailyMood {
  const life=dailyLife(state);
  if(state.sick)return 'sick';
  if(state.sleep?.asleep)return 'sleeping';
  if(life.bladder>=70)return 'toilet';
  if(state.needs.hunger<30)return 'hungry';
  if(state.needs.energy<25)return 'tired';
  if((state.poopCount??0)+life.peeCount>0||state.needs.hygiene<30)return 'dirty';
  if(life.boredom>=55)return 'bored';
  return 'content';
}
