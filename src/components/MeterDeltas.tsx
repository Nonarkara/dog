/**
 * WHAT YOUR CARE JUST DID.
 *
 * Nong Plub, first play: "the activities are not quite clear yet". So the
 * meter an action moved says so, on the meter itself: its bar slides, it
 * rings in amber, and "+12" takes its number's place for a moment. Decay
 * moves a meter a point at a time; an action moves it by two or more.
 */
import {useEffect,useRef,useState} from 'react';
import type {PetState} from '../domain/types';
import {happiness} from '../domain/pet';
import {meterChanges} from '../domain/nextStep';

const READ={
  fullness:(s:PetState)=>s.needs.hunger,
  energy:(s:PetState)=>s.needs.energy,
  hygiene:(s:PetState)=>s.needs.hygiene,
  happiness,
  trust:(s:PetState)=>s.trust,
  arousal:(s:PetState)=>s.arousal,
} as const;
const SHOW_MS=1800;

// ponytail: module-level memory, because the stage may remount mid-action
// (a care animation swaps its subtree) and a ref would forget the "before".
let last:{id:string;v:Record<string,number>}|null=null;

/** The meters moved by the latest action, for a moment: key -> signed change. */
export function useMeterDeltas(petState:PetState,dogId:string):Record<string,number>{
  const [shown,setShown]=useState<Record<string,number>>({});
  const timer=useRef<number>(0);
  useEffect(()=>()=>window.clearTimeout(timer.current),[]);
  const now=Object.fromEntries(Object.entries(READ).map(([k,f])=>[k,Math.round(f(petState))]));
  const reading=Object.values(now).join();
  useEffect(()=>{
    const before=last;last={id:dogId,v:now};
    if(!before||before.id!==dogId)return;// switching dogs is not care
    const changes=meterChanges(before.v,now);
    if(!changes.length)return;
    setShown(Object.fromEntries(changes.map(c=>[c.key,c.d])));
    window.clearTimeout(timer.current);
    timer.current=window.setTimeout(()=>setShown({}),SHOW_MS);
  },[reading,dogId]);// eslint-disable-line react-hooks/exhaustive-deps
  return shown;
}
