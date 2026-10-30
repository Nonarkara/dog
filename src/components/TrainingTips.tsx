import React,{useRef} from 'react';
import {BookOpen,X} from 'lucide-react';
import type {PetState} from '../domain/types';
export function trainingTip(state:PetState):string{
 if(state.sick||state.needs.energy<25)return 'Rest and recovery before practice.';
 if(state.needs.hunger<35)return 'Very hungry? Feed first. Never skip meals to make a dog work.';
 if(state.needs.hunger>85)return 'Full belly? Try praise or play; save food practice for later.';
 return 'A normal appetite is fine. Use tiny rewards from the daily food allowance.';
}
export function TrainingTips({state}:{state:PetState}){
 const dialog=useRef<HTMLDialogElement>(null);
 return <div className="training-tip"><span>{trainingTip(state)}</span><button type="button" className="btn-quiet" aria-label="Read evidence-based training tips" onClick={()=>dialog.current?.showModal()}><BookOpen size={17}/></button>
 <dialog ref={dialog} className="care-details-dialog training-literature" aria-label="Training with food: what the literature says"><button type="button" className="btn-quiet care-details-close" aria-label="Close training tips" onClick={()=>dialog.current?.close()}><X size={18}/></button>
 <h2>Hungry enough to enjoy a treat?</h2>
 <p>Normal appetite is useful. Hunger is not a training tool: don’t skip meals or make food depend on getting a trick right. If your dog is very hungry, unwell or tired, care comes first. <a href="https://www.aaha.org/resources/2015-aaha-canine-and-feline-behavior-management-guidelines/changing-behaviors/" target="_blank" rel="noreferrer">AAHA guidance ↗</a></p>
 <p>Use small rewards within the daily food allowance. A normal meal does not erase learning. A full dog may prefer a toy or gentle praise. Find what this dog values. <a href="https://www.dogstrust.org.uk/dog-advice/training/techniques/positive-reinforcement-training-with-rewards" target="_blank" rel="noreferrer">Dogs Trust ↗</a> · <a href="https://vcahospitals.com/know-your-pet/using-food-and-treats-for-training-dogs" target="_blank" rel="noreferrer">VCA ↗</a></p>
 <p>For a new skill, reward successful responses consistently. Mark the action, then deliver the promised reward promptly. Keep sessions short and enjoyable. <a href="https://www.dogstrust.org.uk/dog-advice/training/techniques/positive-reinforcement-training-with-rewards" target="_blank" rel="noreferrer">Dogs Trust ↗</a></p>
 <p>Use rewards, patient handling and manageable steps. Avoid pain, fear and forced compliance. <a href="https://avsab.org/resources/position-statements/" target="_blank" rel="noreferrer">AVSAB humane-training statement ↗</a></p>
 <p className="text-faint">Tama-Dog-Chi’s meters, traits and growth pace are a game model, not measurements of a real dog.</p>
 </dialog></div>;
}
