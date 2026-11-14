import {Help} from './Help';
import React from 'react';
import {Coins,Utensils,ShoppingBag,Moon,Volume2,X} from 'lucide-react';
import type {PetState} from '../domain/types';
import type {DogProfile} from '../types/dog';
import {gameState} from '../domain/companionGame';
export function CareExtras({kind,dog,state,busy,onClose,onBuy,onFeed,onBed,onPreference}:{kind:'food'|'bed';dog:DogProfile;state:PetState;busy:boolean;onClose:()=>void;onBuy:()=>void;onFeed:()=>void;onBed:()=>void;onPreference:(wakeMinute:number,wakeBark:boolean)=>void}){
 const g=gameState(state,dog.id),time=`${String(Math.floor(g.wakeMinute/60)).padStart(2,'0')}:${String(g.wakeMinute%60).padStart(2,'0')}`;
 return <section className="panel region-care care-extras" aria-label={kind==='food'?'Food pantry':'Bedtime'}>
  <header className="panel-head"><h2 className="label">{kind==='food'?'Pantry':'Bedtime'}</h2><Help label={kind==='food'?'How food works':'How bedtime works'} text={kind==='food'?'Each meal uses one portion. Every minute you spend together earns 3 coins; 6 coins buy 3 meals. Very hungry? The emergency bowl is always free.':'Tuck your dog in when energy is low. Your dog can wake after the time you set, once rested.'}/><button type="button" className="btn-quiet" aria-label="Close care extras" onClick={onClose}><X size={18}/></button></header>
  <div className="panel-body care-extras-body">
  {kind==='food'?<>
   <p className="pantry-balance"><Coins size={18}/><span>{Math.floor(g.coins)} paw coins</span><ShoppingBag size={18}/><span>{g.portions} meals</span></p>
   <div className="care-extra-actions"><button className="btn-quiet" disabled={busy||g.coins<6} onClick={onBuy}><ShoppingBag size={18}/>3 meals · 6 coins</button><button className="btn-accent" disabled={busy||state.needs.hunger>=85||g.portions<1&&state.needs.hunger>=35} onClick={onFeed}><Utensils size={18}/>Serve a meal</button></div>
   <details className="pantry-guide"><summary>Food &amp; rewards</summary><p>A minute of active time together earns 3 coins. Starter food and an emergency bowl keep basic care within reach. Keep regular meals; use tiny training rewards within the daily allowance.</p></details>
  </>:<>
   <div className="care-extra-actions"><button className="btn-accent" disabled={busy||state.sleep.asleep} onClick={onBed}><Moon size={18}/>Tuck {dog.name} in</button><label>Usual wake time <input type="time" min="04:00" max="10:00" value={time} onChange={e=>{const [h,m]=e.target.value.split(':').map(Number);if(Number.isFinite(h)&&Number.isFinite(m))onPreference(h*60+m,g.wakeBark);}}/></label></div>
   <label className="wake-bark"><input type="checkbox" checked={g.wakeBark} disabled={busy} onChange={e=>onPreference(g.wakeMinute,e.target.checked)}/><Volume2 size={18}/>Bark when {dog.name} wakes</label>
   <p>{dog.name} has a personal rhythm. A restful night brings a stretch before the day starts.</p>
   <p className="text-faint">Barking works while this app is open and sound is allowed. It is not a reliable lock-screen alarm.</p>
  </>}
  </div>
 </section>;
}
