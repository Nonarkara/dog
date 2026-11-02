import {Eye,MessageCircle,Cookie,Square} from 'lucide-react';
import {TrainingSteps} from './TrainingSteps';
/**
 * THE FIRST WORD.
 *
 * Watch the dog offer an action. Name it at that moment, then give one tiny
 * treat. Three pictures and a single next action make the first catch legible.
 * Direct petting remains an alternate reward; the advanced deck teaches
 * giving an established cue before the action, once the word is familiar.
 *
 * Nothing here trains itself. Look away and you miss the sit.
 */
import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {BehaviourName, PetState} from '../domain/types';
import {BEHAVIOURS} from '../domain/types';
import {captureOf, offerChance, pair, withCapture, LEARNED, LEARN_ORDER, OFFER_HOLD_MS, PET_WINDOW_MS} from '../domain/capture';
import {POSE_FOR} from '../domain/lesson';
import type {AvatarPose, PerformPose} from './trainingMotion';
import type {CommitPet} from '../utils/progressStore';
import {sound} from '../utils/proceduralAudio';
import {logCare,grantWish} from '../domain/life';

type Phase='ready'|'offering'|'marked';
const DISTRACT:AvatarPose[]=['down','stand','come','paw','stand'];
const pause=(ms:number)=>new Promise(r=>window.setTimeout(r,ms));

interface Props {
  dogName:string; name:BehaviourName; petState:PetState; onPetStateChange:CommitPet;
  onPose:PerformPose; petPulse:number;busy?:boolean; unavailable:string|null;
}

export const CaptureGame:React.FC<Props>=({dogName,name,petState,onPetStateChange,onPose,petPulse,unavailable,busy})=>{
  const [phase,setPhase]=useState<Phase>('ready');
  const [status,setStatus]=useState('');
  const [bubble,setBubble]=useState<string|null>(null);
  const [doing,setDoing]=useState(false);
  const saving=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const run=useRef(0), doingAt=useRef(false), doneAt=useRef(0), pulseAt=useRef(petPulse), markedAt=useRef(0);
  const c=captureOf(petState,name);
  const word=BEHAVIOURS.find(b=>b.name===name)?.label??name;
  const target=POSE_FOR[name];
  const stars=Math.min(5,Math.round(c.association/LEARNED*5));

  const stop=()=>{run.current++;doneAt.current=0;doingAt.current=false;setDoing(false);setBubble(null);setPhase('ready');void onPose('stand');};
  useEffect(()=>stop,[name]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if((unavailable&&phase!=='ready')||(busy&&phase==='offering')){stop();setStatus(`${unavailable??'Finish caring first.'} Training paused.`);}},[unavailable,busy]);// eslint-disable-line react-hooks/exhaustive-deps

  /** He tries things. Sometimes the right thing. */
  const offer=async(id:number)=>{
    const learned=captureOf(petState,name).association>=LEARNED;
    for(let i=0;i<(learned?1:3)&&run.current===id;i++){
      await pause(learned&&i===0?250:1100+Math.random()*1300);
      if(run.current!==id)return;
      const hit=learned||i===2||i>0&&Math.random()<offerChance(captureOf(petState,name).association);
      const distract=DISTRACT.filter(pose=>pose!==target);
      const pose=hit?target:distract[Math.floor(Math.random()*distract.length)];
      setBubble(hit?null:Math.random()<.5?'?':null);
      if(!hit)setStatus(pose==='down'?`${dogName} lies down…`:pose==='paw'?`${dogName} lifts a paw…`:`${dogName} wanders, sniffing…`);
      const completed=await onPose(pose);
      if(run.current!==id)return;
      if(completed===null&&pose!=='stand'){stop();setStatus('That action was interrupted. Watch again when ready.');return;}
      if(hit){
        doingAt.current=true;setDoing(true);setBubble(learned?'♥':'!');
        setStatus(`Now say “${word}” once.`);
        if(learned)sound.happyYip();
        await pause(Math.max(3000,OFFER_HOLD_MS));
        if(run.current!==id)return;
        doingAt.current=false;doneAt.current=Date.now();setDoing(false);setBubble(null);
      }
    }
    if(run.current===id){setPhase('ready');setBubble(null);void onPose('stand');setStatus('No rush. Watch again to catch the next one.');}
  };

  const cue=()=>{
    if(unavailable||saving.current||phase!=='ready')return;
    const id=++run.current;setPhase('offering');
    doneAt.current=0;
    const fresh=c.association<.4;
    setBubble(fresh?'?':null);
    setStatus(`Watch for ${word.toLowerCase()}.`);
    void offer(id);
  };

  const commit=async(next:(s:PetState)=>PetState,msg:string)=>{
    if(saving.current)return;
    saving.current=true;const current=run.current;
    const before=captureOf(petState,name).association;
    const saved=await onPetStateChange(next);
    saving.current=false;if(!mounted.current||current!==run.current)return;
    if(!saved){setStatus('Not saved. Please try again.');return;}
    const after=captureOf(saved,name).association;
    if(before<LEARNED&&after>=LEARNED){
      const open=LEARN_ORDER[LEARN_ORDER.indexOf(name)+1];
      sound.chimeSuccess();setBubble('★');
      setStatus(`${dogName} learned “${word}”!${open?` ${BEHAVIOURS.find(b=>b.name===open)?.label} is open now.`:''}`);
      window.setTimeout(()=>setBubble(null),1800);
    }else setStatus(msg);
  };

  /** "Sit!" — the marker. Only worth something if he is sitting right now. */
  const mark=()=>{
    if(unavailable||saving.current||phase!=='offering'||!doingAt.current)return;
    sound.markerClick();
    run.current++;setPhase('marked');markedAt.current=Date.now();pulseAt.current=petPulse;
    setStatus('Now give one tiny treat.');
    const id=run.current;
    window.setTimeout(()=>{if(run.current!==id)return;run.current++;setPhase('ready');setDoing(false);doingAt.current=false;setBubble(null);
      void commit(s=>withCapture(s,name,pair(captureOf(s,name),false)),`The reward was late. Try again; treat right after naming it.`);},PET_WINDOW_MS);
  };

  const reward=(kind:'treat'|'pet'='treat')=>{
    if(unavailable||saving.current||phase!=='marked'||(busy&&kind==='treat'))return;
    run.current++;setPhase('ready');setDoing(false);doingAt.current=false;setBubble('♥');
    const known=captureOf(petState,name).association>=LEARNED;
    if(kind==='treat')sound.eatCrunch();
    void commit(s=>{
      if(s.sleep.asleep||s.sick)return s;
      const n=logCare(withCapture({...s,needs:{...s.needs,hunger:Math.min(100,s.needs.hunger+(kind==='treat'?1:0))}},name,pair(captureOf(s,name),true)),'train');
      return known?grantWish(n,'trick',Date.now()).state:n;
    },known?`Good dog! ${dogName} remembers.`:'Good catch. A clear word and a little reward.');
    if(kind==='treat'&&!['sit','stay','wait'].includes(name))void onPose('reward');
    const id=run.current;window.setTimeout(()=>{if(run.current===id&&mounted.current)setBubble(null);},1400);
  };
  // Direct petting remains an alternate reward for existing players.
  useEffect(()=>{if(phase==='marked'&&petPulse!==pulseAt.current)reward('pet');},[petPulse]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{const hidden=()=>{if(document.hidden){stop();setStatus('Paused. Watch again when you return.');}};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[]);// eslint-disable-line react-hooks/exhaustive-deps

  const stage=typeof document!=='undefined'?document.querySelector('.stage-frame'):null;
  return (
    <div className="capture-game" data-capture-phase={phase} data-capture-doing={doing}>
      <div className="capture-progress" aria-label={`${word}: ${stars} of 5`}>
        <span className="label">Teach “{word}”</span>
        <span className="capture-stars" aria-hidden="true">{Array.from({length:5},(_,i)=><i key={i} data-on={i<stars}>★</i>)}</span>
        <span className="data">{c.association>=LEARNED?'Learned ✓':`${stars}/5 to learn`}</span>
      </div>
      <TrainingSteps name={name} word={word} step={phase==='marked'?2:doing?1:0}/>
      <p className="capture-status" aria-live="polite">{unavailable??(status||`Watch for ${word.toLowerCase()}.`)}</p>
      <div className="capture-actions">
        <button type="button" className="btn btn-accent capture-primary" onClick={phase==='ready'?cue:phase==='marked'?()=>reward():mark} disabled={!!unavailable||!!busy||saving.current||(phase==='offering'&&!doing)}>
          {phase==='ready'?<Eye size={19}/>:phase==='marked'?<Cookie size={19}/>:<MessageCircle size={19}/>}
          {phase==='ready'?'Watch':phase==='marked'?'Tiny treat':doing?`Say “${word}”`:'Watch…'}
        </button>
        {phase!=='ready'&&<button type="button" className="btn btn-quiet border-hairline" aria-label="Stop training" onClick={()=>{stop();setStatus('Paused. Watch again when ready.');}}><Square size={16}/></button>}
      </div>
      {stage&&bubble&&createPortal(<div className="think-bubble" aria-hidden="true">{bubble}</div>,stage)}
    </div>
  );
};
