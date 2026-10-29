import React from 'react';
import {Check,Plus,X} from 'lucide-react';
import type {DogProfile} from '../types/dog';
interface Props {dogs:DogProfile[];activeId:string;onSelect:(id:string)=>void;onClose:()=>void;onEnroll:()=>void;}
/** A temporary choice in the existing Care region, never a layer over the animal. */
export function DogChooser({dogs,activeId,onSelect,onClose,onEnroll}:Props){
 const keys=(event:React.KeyboardEvent<HTMLUListElement>)=>{
  if(event.key==='Escape'){event.preventDefault();onClose();return;}
  const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
  const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(index+1)%buttons.length:event.key==='ArrowUp'?(index-1+buttons.length)%buttons.length:-1;
  if(next>=0){event.preventDefault();buttons[next]?.focus();}
 };
 return <section className="panel region-care dog-chooser h-full" aria-label="Choose a dog">
  <header className="panel-head"><h2 className="label">Choose a dog</h2><button type="button" className="btn-quiet" onClick={onClose} aria-label="Close dog chooser"><X size={16} aria-hidden="true"/></button></header>
  <ul id="dog-switcher" role="listbox" aria-label="Dogs" className="panel-body dog-choices" onKeyDown={keys}>
   {dogs.map(dog=><li key={dog.id} role="none"><button type="button" role="option" aria-selected={dog.id===activeId} className="dog-choice btn-quiet" onClick={()=>onSelect(dog.id)} title={`${dog.name} · ${dog.breed}`}>
    <span className="dog-choice-check" aria-hidden="true">{dog.id===activeId&&<Check size={14}/>}</span><strong>{dog.name}</strong><span className="dog-choice-breed">{dog.breed}</span>
   </button></li>)}
   <li role="none"><button type="button" role="option" aria-selected={false} className="dog-choice btn-quiet" onClick={onEnroll}><Plus size={14} aria-hidden="true"/><span>Enroll another dog</span></button></li>
  </ul>
 </section>;
}
