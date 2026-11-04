/**
 * A LIFE, NOT A LEVEL.
 *
 * The 1996 chip grew into one of several characters depending on how it was
 * raised. So does he: by his seventh care day he shows who he has become, and
 * that is decided by what you actually did — not by a dice roll.
 *
 * Also here: his daily wish, his month-birthdays, and when he would next
 * call you if the app were closed.
 */
import type {PetState} from './types';
import {dayKey, whyCalling, type CallReason} from './attention';
import {decay} from './pet';
import {captureOf, LEARN_ORDER, LEARNED} from './capture';
import {growthStage} from './growth';
import {gameState} from './companionGame';

export type CareKind='feed'|'play'|'pet'|'walk'|'train'|'cups'|'answered'|'missed';
export type CareLog=Partial<Record<CareKind,number>>;
export type Character='Steady'|'Playful'|'Clingy'|'Independent'|'Clever';

export const CHARACTER_TEXT:Record<Character,string>={
  Steady:'calm and easy-going. Raised on a bit of everything.',
  Playful:'always ready for a game. All that play shaped him.',
  Clingy:'happiest right beside you. All those strokes did it.',
  Independent:'self-reliant. He learned to wait for you on his own.',
  Clever:'quick to learn. Words and cups came easily.',
};

export const logCare=(s:PetState,k:CareKind):PetState=>({...s,careLog:{...s.careLog,[k]:(s.careLog?.[k]??0)+1}});

export const wordsLearned=(s:PetState)=>LEARN_ORDER.filter(n=>captureOf(s,n).association>=LEARNED).length;

/** Who he has become. Deterministic: the same record always gives the same dog. */
export function characterOf(s:PetState):Character{
  const c=s.careLog??{},n=(k:CareKind)=>c[k]??0;
  const calls=n('answered')+n('missed');
  if(calls>=4&&n('missed')/calls>.5)return 'Independent';
  if(wordsLearned(s)>=3||(s.noseSkill??0)>=.6)return 'Clever';
  const play=n('play')+n('walk')+n('cups'),pet=n('pet'),total=play+pet+n('feed')+n('train');
  if(total>=10&&play/total>.45)return 'Playful';
  if(total>=10&&pet/total>.45)return 'Clingy';
  return 'Steady';
}

/** Fixes his character once he is grown, so it never flips afterwards. */
export function revealCharacter(s:PetState,now:number):{state:PetState;revealed:Character|null}{
  if(s.character||!s.growth||growthStage(s).name==='Puppy'||growthStage(s).name==='Youngster')return {state:s,revealed:null};
  // Not on an empty record: a dog grown before records began waits for ten logged things.
  if(Object.values(s.careLog??{}).reduce((a,b)=>a+(b??0),0)<10)return {state:s,revealed:null};
  const name=characterOf(s);
  return {state:{...s,character:{name,at:now}},revealed:name};
}

/* ------------------------------------------------------------ daily wish */
export type WishKind='walk'|'play'|'pet'|'cups'|'trick';
export const WISH_TEXT:Record<WishKind,string>={walk:'wants a walk in the park',play:'wants a game',pet:'wants a stroke',cups:'wants to play three cups',trick:'wants to show you a trick'};
export interface Wish {day:string;kind:WishKind;done:boolean}

const hash=(t:string)=>{let h=2166136261;for(const ch of t)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;};

/** Today's wish: one per day, the same all day. A trick only once he knows a word. */
export function wishFor(s:PetState,now:number):Wish{
  const day=dayKey(now);
  if(s.wish?.day===day)return s.wish;
  const kinds:WishKind[]=['walk','play','pet','cups',...(wordsLearned(s)?['trick' as const]:[])];
  return {day,kind:kinds[hash((s.growth?.seed??'dog')+day)%kinds.length],done:false};
}
export const WISH_TRUST=3, WISH_COINS=5;
/** Granting the wish: once a day, a little trust and a few coins. */
export function grantWish(s:PetState,kind:WishKind,now:number):{state:PetState;granted:boolean}{
  const w=wishFor(s,now);
  if(w.done||w.kind!==kind)return {state:s.wish?.day===w.day?s:{...s,wish:w},granted:false};
  // Fresh and older saves may not yet have a materialized pantry. Award
  // the promised coins without losing active-time income awaiting collection.
  const game=gameState(s),coins=Math.min(200,game.coins+WISH_COINS);
  return {state:{...s,wish:{...w,done:true},trust:Math.min(100,s.trust+WISH_TRUST),game:{...game,coins}},granted:true};
}

/* -------------------------------------------------------------- birthday */
/** Whole days since adoption, or null for a dog that was never adopted. */
export const ageDays=(s:PetState,now:number)=>s.growth?Math.floor((now-s.growth.adoptedAt)/86_400_000):null;
/** "1 month old today", on each 30th day. */
export function birthday(s:PetState,now:number):string|null{
  const d=ageDays(s,now);if(!d||d%30)return null;
  const m=d/30;return m%12===0?`${m/12} year${m>12?'s':''} old today`:`${m} month${m>1?'s':''} old today`;
}

/* ------------------------------------------------------ calls when closed */
/** Reasons worth waking a phone for. Lonely and bored stay in the app. */
const PUSHABLE:CallReason[]=['hungry','dirty','toilet','sick'];
const STEP=15*60_000, AHEAD=24*3_600_000, MIN_GAP=2*3_600_000;
/** Bangkok wall-clock hour (UTC+7, no daylight saving). */
const bkkHour=(t:number)=>new Date(t+7*3_600_000).getUTCHours();
/** Never between 22:00 and 07:00 Bangkok: a late call waits for the morning. */
export function outOfQuietHours(t:number):number{
  const h=bkkHour(t);if(h>=7&&h<22)return t;
  const morning=new Date(t+7*3_600_000);if(h>=22)morning.setUTCDate(morning.getUTCDate()+1);
  morning.setUTCHours(7,0,0,0);return morning.getTime()-7*3_600_000;
}
/** When he would next call, if nobody opened the app. At least two hours away. */
export function nextCallAt(s:PetState,now:number):{at:number;reason:CallReason}|null{
  let state=s;
  for(let t=now+STEP;t<=now+AHEAD;t+=STEP){
    state=decay(state,t);
    const r=whyCalling(state,t);
    if(r&&PUSHABLE.includes(r))return {at:outOfQuietHours(Math.max(t,now+MIN_GAP)),reason:r};
  }
  return null;
}

/** The one-line growth label: progress while growing, then who he is. */
export function growthLabel(s:PetState):string{
  const g=growthStage(s),days=s.growth?.careDays?.length??0;
  if(g.name==='Puppy'||g.name==='Youngster')return `${g.name} · ${days}/7`;
  return s.character?`${g.name} · ${s.character.name}`:g.name;
}
export const WISH_SHORT:Record<WishKind,string>={walk:'a walk',play:'a game',pet:'a stroke',cups:'three cups',trick:'a trick'};
