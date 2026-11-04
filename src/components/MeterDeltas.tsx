/**
 * WHAT YOUR CARE JUST DID.
 *
 * Nong Plub, first play: "the activities are not quite clear yet". So every
 * care action floats the meters it moved over the dog — "+12 fullness" — on
 * every layout, including the phone, where the meters are often out of view.
 * Decay moves a meter a point at a time; an action moves it by two or more.
 */
import React, {useEffect, useState} from 'react';
import {Activity, Battery, Heart, Smile, Sparkles, Utensils} from 'lucide-react';
import type {PetState} from '../domain/types';
import {happiness} from '../domain/pet';

const METERS=[
  {key:'fullness',label:'fullness',icon:Utensils,read:(s:PetState)=>s.needs.hunger},
  {key:'energy',label:'energy',icon:Battery,read:(s:PetState)=>s.needs.energy},
  {key:'hygiene',label:'clean',icon:Sparkles,read:(s:PetState)=>s.needs.hygiene},
  {key:'happiness',label:'happy',icon:Smile,read:happiness},
  {key:'trust',label:'trust',icon:Heart,read:(s:PetState)=>s.trust},
  {key:'arousal',label:'excited',icon:Activity,read:(s:PetState)=>s.arousal},
] as const;

// ponytail: module-level memory, because the stage may remount mid-action
// (a care animation swaps its subtree) and a ref would forget the "before".
let last:{id:string;v:Record<string,number>}|null=null;
let shown:{dogId:string;items:{key:string;d:number}[];until:number}={dogId:'',items:[],until:0};
const SHOW_MS=1800;

export const MeterDeltas:React.FC<{petState:PetState;dogId:string}>=({petState,dogId})=>{
  const [,tick]=useState(0);
  const now=Object.fromEntries(METERS.map(m=>[m.key,Math.round(m.read(petState))]));
  const reading=Object.values(now).join();
  useEffect(()=>{
    const before=last;last={id:dogId,v:now};
    if(!before||before.id!==dogId)return;// switching dogs is not care
    const changes=METERS.map(m=>({key:m.key,d:now[m.key]-before.v[m.key]})).filter(c=>Math.abs(c.d)>=2);
    if(changes.length){shown={dogId,items:changes,until:Date.now()+SHOW_MS};tick(n=>n+1);}
  },[reading,dogId]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const left=shown.until-Date.now();
    if(left<=0)return;
    const t=window.setTimeout(()=>tick(n=>n+1),left);
    return()=>window.clearTimeout(t);
  });
  if(shown.dogId!==dogId||Date.now()>=shown.until)return null;
  return (
    <div className="meter-deltas" aria-live="polite">
      {shown.items.map(({key,d})=>{const m=METERS.find(x=>x.key===key)!;return(
        <span key={key+d+shown.until} className="meter-delta" data-up={d>0}>
          {React.createElement(m.icon,{size:14,'aria-hidden':true})}{d>0?'+':'−'}{Math.abs(d)}<span className="sr-only"> {m.label}</span>
        </span>);})}
    </div>
  );
};
