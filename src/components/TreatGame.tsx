/**
 * THREE CUPS.
 *
 * He turns his back. You hide a bone under one of three cups (and, once his
 * nose is good, shuffle them). He turns round, sniffs along the row, and paws
 * the cup he believes in. A practised nose finds it more often — never always.
 */
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bone,PawPrint,X} from 'lucide-react';
import {sound} from '../utils/proceduralAudio';
import {pickCup,shuffles} from '../domain/nose';

type Phase='hide'|'hiding'|'shuffle'|'sniff'|'tap'|'result';
interface Props {
  name:string; nose:number; host?:HTMLElement|null;
  onTurn:(away:boolean)=>void; onLook:(x:number)=>void; onReact:(hit:boolean)=>void;
  onClose:()=>void; onComplete:(won:boolean)=>void;
}
const ROUNDS=3;
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

export function TreatGame({name,nose,host,onTurn,onLook,onReact,onClose,onComplete}:Props){
  const [round,setRound]=useState(1);
  const [score,setScore]=useState(0);
  const [phase,setPhase]=useState<Phase>('hide');
  const [bone,setBone]=useState<number|null>(null);      // which cup hides it
  const [slots,setSlots]=useState([0,1,2]);              // slot of each cup
  const [open,setOpen]=useState<number[]>([]);           // lifted cups
  const [tapped,setTapped]=useState<number|null>(null);
  const [text,setText]=useState('');
  const alive=useRef(true);
  const cb=useRef({onTurn,onLook,onReact,onComplete});cb.current={onTurn,onLook,onReact,onComplete};
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;cb.current.onTurn(false);};},[]);

  // Each round starts with his back to you.
  useEffect(()=>{
    setPhase('hide');setBone(null);setOpen([]);setTapped(null);setSlots([0,1,2]);
    cb.current.onTurn(true);setText(`${name} turned away. Tap a cup to hide the bone.`);
  },[round,name]);

  const hide=async(cup:number)=>{
    if(phase!=='hide')return;
    setPhase('hiding');setBone(cup);setOpen([cup]);sound.ballBounce();
    await wait(650);if(!alive.current)return;
    setOpen([]);await wait(350);
    let order=[0,1,2];
    const n=shuffles(nose);
    if(n){setPhase('shuffle');setText('Shuffle! Keep your eye on it.');
      for(let i=0;i<n;i++){const a=Math.floor(Math.random()*3),b=(a+1+Math.floor(Math.random()*2))%3;
        const next=[...order];const t=next[a];next[a]=next[b];next[b]=t;order=next;setSlots(next);await wait(480);if(!alive.current)return;}
    }
    // He turns round and sniffs along the row.
    setPhase('sniff');cb.current.onTurn(false);setText(`${name} turns round and sniffs each cup…`);
    await wait(650);
    for(const x of [-.8,0,.8]){cb.current.onLook(x);await wait(420);if(!alive.current)return;}
    let left=[0,1,2],first=true;
    while(alive.current){
      const pick=pickCup(cup,left,nose);
      const slot=order[pick];
      cb.current.onLook((slot-1)*.8);setPhase('tap');setTapped(pick);sound.markerClick();
      await wait(550);if(!alive.current)return;
      setOpen(o=>[...o,pick]);setTapped(null);
      const hit=pick===cup;cb.current.onReact(hit);
      if(hit){
        sound.eatCrunch();if(first)setScore(s=>s+1);
        setText(first?`Found it first try — good nose!`:`There it is. ${name} gets the bone anyway.`);
        break;
      }
      sound.ballBounce();setText('Not that one…');
      left=left.filter(c=>c!==pick);first=false;
      await wait(900);
    }
    setPhase('result');
    await wait(1500);if(!alive.current)return;
    if(round<ROUNDS)setRound(r=>r+1);
  };

  // Last round decides the game once its result has been seen.
  useEffect(()=>{
    if(phase==='result'&&round===ROUNDS){const t=setTimeout(()=>cb.current.onComplete(score>=2),1500);return()=>clearTimeout(t);}
  },[phase,round,score]);

  useEffect(()=>{
    const keys=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement|null)?.closest('input,textarea,select'))return;
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}
      else if(/^[123]$/.test(e.key)&&phase==='hide'){e.preventDefault();e.stopPropagation();void hide(slots.indexOf(+e.key-1));}
    };
    window.addEventListener('keydown',keys,true);return()=>window.removeEventListener('keydown',keys,true);
  });

  const head=<div className="treat-game" aria-label="Three cups game">
    <div className="treat-heading"><span className="inline-flex items-center gap-1"><Bone size={16} aria-hidden="true"/><span className="data">Round {round}/{ROUNDS} · {score} first-try</span></span>
      <button type="button" className="btn-quiet" aria-label="Close three cups" onClick={onClose}><X size={16}/></button></div>
    <p className="treat-instruction" role="status" aria-live="polite">{text}</p>
  </div>;
  return <>
    {host?createPortal(head,host):head}
    <div className="cups-row" data-phase={phase}>
      {[0,1,2].map(cup=>{const lifted=open.includes(cup);return(
        <button key={cup} type="button" className="stage-cup" style={{'--slot':slots[cup]} as React.CSSProperties}
          aria-label={phase==='hide'?`Hide the bone under cup ${slots[cup]+1}`:`Cup ${slots[cup]+1}`}
          disabled={phase!=='hide'} data-lifted={lifted} data-tapped={tapped===cup} onClick={()=>void hide(cup)}>
          {lifted&&bone===cup&&<Bone className="stage-cup-bone" aria-hidden="true"/>}
          <svg className="stage-cup-shell" viewBox="0 0 80 70" aria-hidden="true">
            <path d="M14 62 L22 12 Q40 2 58 12 L66 62 Z" fill="var(--bg-surface)" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
            <path d="M24 22 Q40 15 56 22" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".55"/>
            <ellipse cx="40" cy="62" rx="27" ry="6" fill="var(--bg-elevated)" stroke="currentColor" strokeWidth="2.2"/>
          </svg>
          {tapped===cup&&<PawPrint className="stage-cup-paw" aria-hidden="true"/>}
        </button>);})}
    </div>
  </>;
}
