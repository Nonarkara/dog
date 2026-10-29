import React,{useEffect,useRef,useState} from 'react';
import {Bone,X,Check} from 'lucide-react';
import {sound} from '../utils/proceduralAudio';
interface Props {name:string;onClose:()=>void;onComplete:(won:boolean)=>void;onReact:(cup:number,hit:boolean)=>void;}
type Round={number:number;score:number;target:number;phase:'reveal'|'guess'|'result';picked:number|null};
const nextRound=(number:number,score:number):Round=>({number,score,target:Math.floor(Math.random()*3),phase:'reveal',picked:null});
export function TreatGame({name,onClose,onComplete,onReact}:Props){
 const [round,setRound]=useState<Round>(()=>nextRound(1,0));
 const current=useRef(round);current.current=round;
 const latest=useRef({onComplete,onReact});latest.current={onComplete,onReact};
 const finished=useRef(false);
 useEffect(()=>{
  if(round.phase==='guess')return;
  const timer=setTimeout(()=>{
   if(finished.current)return;
   if(round.phase==='reveal'){const r={...round,phase:'guess' as const};current.current=r;setRound(r);}
   else if(round.number===3){finished.current=true;latest.current.onComplete(round.score>=2);}
   else{const r=nextRound(round.number+1,round.score);current.current=r;setRound(r);}
  },round.phase==='reveal'?1100:1000);
  return()=>clearTimeout(timer);
 },[round]);
 const choose=(cup:number)=>{
  const r=current.current;if(finished.current||r.phase!=='guess')return;
  const hit=cup===r.target;const next={...r,phase:'result' as const,picked:cup,score:r.score+(hit?1:0)};
  current.current=next;setRound(next);latest.current.onReact(cup,hit);
  if(hit)sound.chimeSuccess();else sound.ballBounce();
 };
 const close=()=>{finished.current=true;onClose();};
 useEffect(()=>{
  const keys=(event:KeyboardEvent)=>{
   const target=event.target as HTMLElement|null;
   if(document.querySelector('.dog-chooser,.control-reference'))return;
   if(target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
   else if(event.key===' '&&!target?.closest('button,a,[role="button"],[role="tab"],[role="option"]')){event.preventDefault();event.stopPropagation();}
   else if(/^[123]$/.test(event.key)){event.preventDefault();event.stopPropagation();if(current.current.phase==='guess')choose(+event.key-1);}
  };
  window.addEventListener('keydown',keys,true);
  return()=>window.removeEventListener('keydown',keys,true);
 },[round.phase,onClose]);
 return <div className="treat-game" onKeyDown={event=>event.stopPropagation()} aria-label="Find the treat game">
  <div className="treat-heading"><span className="inline-flex items-center gap-1"><Bone size={16} aria-hidden="true"/><strong className="sr-only">Find the treat</strong><span className="data">{round.number}/3 · {round.score} found</span></span><button type="button" className="btn-quiet" aria-label="Close treat game" onClick={close}><X size={16}/></button></div>
  <p className="treat-instruction" role="status" aria-live="polite">{round.phase==='reveal'?`Watch cup ${round.target+1}…`:round.phase==='guess'?`Which cup, ${name}?`:round.picked===round.target?'Good nose!':'There it was! Try the next one.'}</p>
  <div className="treat-cups">{[0,1,2].map(cup=>{
   const show=round.phase==='reveal'||round.phase==='result';const found=round.phase==='result'&&cup===round.target;
   return <button key={cup} type="button" className={`treat-cup ${show?'treat-cup--open':''} ${found?'treat-cup--found':''}`} aria-label={`Cup ${cup+1}`} disabled={round.phase!=='guess'} onClick={()=>choose(cup)}>
    <svg className="cup-cover" viewBox="0 0 64 54" aria-hidden="true"><path d="M15 45L19 9Q32 1 45 9L49 45Z" fill="var(--bg-surface)" stroke="currentColor" strokeWidth="2"/><ellipse cx="32" cy="45" rx="20" ry="6" fill="var(--bg-elevated)" stroke="currentColor" strokeWidth="2"/></svg>
    {show&&cup===round.target&&<Bone className="cup-bone" size={22} aria-hidden="true"/>}<span className="cup-number data">{cup+1}</span>{found&&<Check className="cup-check" size={16} aria-hidden="true"/>}
   </button>;
  })}</div>
 </div>;
}
