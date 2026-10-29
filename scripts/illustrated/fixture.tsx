// Development-only motion review surface. Vite does not include this test entry
// in the production build. Domain behavior is exercised by test-tamagotchi.cjs.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {IllustratedDog} from '../../src/components/IllustratedDog';
import {DEFAULT_DOGS} from '../../src/data/defaultDogs';
import {createPetState} from '../../src/domain/pet';
import type {AvatarPose, AvatarInteractionTrigger} from '../../src/components/DogAvatar3D';
import '../../src/index.css';
function Fixture(){
 const [id,setId]=useState('expo-2021'),[pose,setPose]=useState<AvatarPose>('stand'),[action,setAction]=useState<AvatarInteractionTrigger>(null);
 const [state,setState]=useState(createPetState());
 const dog=DEFAULT_DOGS.find(d=>d.id===id)!;
 return <main style={{width:640,margin:'0 auto'}}><nav style={{display:'flex',gap:8}}>{DEFAULT_DOGS.filter(d=>['Expo','Mali','Oreo','Paolo','Hachiku'].includes(d.name)).map(d=><button key={d.id} onClick={()=>{setId(d.id);setPose('stand');setState(createPetState());setAction(null);}}>{d.name}</button>)}</nav>
 <section style={{width:640,height:480}}><IllustratedDog key={id} dog={dog} pose={pose} petState={state} interactionTrigger={action} onInteractionEnd={()=>{}} onPet={()=>setAction('pet')} onClean={()=>setState(s=>({...s,poopCount:0}))} fallback={<p>Fallback</p>}/></section>
 <nav style={{display:'flex',gap:8}}>{(['stand','sit','down','paw','sleep'] as AvatarPose[]).map(p=><button key={p} onClick={()=>{setPose(p);setAction(null);}}>{p}</button>)}</nav>
 <nav style={{display:'flex',gap:8}}>{(['pet','feed','walk','groom','communicate','play','clean','medicine'] as AvatarInteractionTrigger[]).map(a=><button key={a} onClick={()=>{setAction(null);requestAnimationFrame(()=>setAction(a));}}>{a}</button>)}</nav>
 <button onClick={()=>setState(s=>({...s,sick:!s.sick,poopCount:2}))}>needs</button></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
