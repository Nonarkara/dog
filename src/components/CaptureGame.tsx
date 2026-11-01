/**
 * THE FIRST WORD.
 *
 * Say "Sit". He tilts his head — no idea. He wanders, lies down, sniffs, and
 * sometimes sits on his own. Catch that moment: say "Sit!" again and stroke
 * him. A few good catches and the word starts to mean something; then one day
 * "Sit" and he is already sitting, wagging, waiting for your hand.
 *
 * Nothing here trains itself. Look away and you miss the sit.
 */
import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {BehaviourName, PetState} from '../domain/types';
import {BEHAVIOURS} from '../domain/types';
import {captureOf, offerChance, pair, wrongMark, withCapture, LEARNED, LEARN_ORDER, OFFER_HOLD_MS, PET_WINDOW_MS} from '../domain/capture';
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
  onPose:PerformPose; petPulse:number; unavailable:string|null;
}

export const CaptureGame:React.FC<Props>=({dogName,name,petState,onPetStateChange,onPose,petPulse,unavailable})=>{
  const [phase,setPhase]=useState<Phase>('ready');
  const [status,setStatus]=useState('');
  const [bubble,setBubble]=useState<string|null>(null);
  const [doing,setDoing]=useState(false);
  const run=useRef(0), doingAt=useRef(false), doneAt=useRef(0), pulseAt=useRef(petPulse), markedAt=useRef(0);
  const c=captureOf(petState,name);
  const word=BEHAVIOURS.find(b=>b.name===name)?.label??name;
  const target=POSE_FOR[name];
  const stars=Math.min(5,Math.round(c.association/LEARNED*5));

  const stop=()=>{run.current++;doingAt.current=false;setDoing(false);setBubble(null);setPhase('ready');void onPose('stand');};
  useEffect(()=>stop,[name]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(unavailable&&phase==='offering'){stop();setStatus(`${unavailable} Training paused.`);}},[unavailable]);// eslint-disable-line react-hooks/exhaustive-deps

  /** He tries things. Sometimes the right thing. */
  const offer=async(id:number)=>{
    const learned=captureOf(petState,name).association>=LEARNED;
    for(let i=0;i<(learned?1:9)&&run.current===id;i++){
      await pause(learned&&i===0?250:1100+Math.random()*1300);
      if(run.current!==id)return;
      const hit=learned&&i===0?true:Math.random()<offerChance(captureOf(petState,name).association);
      const pose=hit?target:DISTRACT[Math.floor(Math.random()*DISTRACT.length)];
      setBubble(hit?null:Math.random()<.5?'?':null);
      if(!hit)setStatus(pose==='down'?`${dogName} lies down…`:pose==='paw'?`${dogName} lifts a paw…`:`${dogName} wanders, sniffing…`);
      await onPose(pose);
      if(run.current!==id)return;
      if(hit){
        doingAt.current=true;setDoing(true);setBubble(learned?'♥':'!');
        setStatus(learned?`“${word}” — ${dogName} does it at once, wagging. Stroke him!`:`He's doing it — say “${word}!” now!`);
        if(learned)sound.happyYip();
        await pause(learned?2500:OFFER_HOLD_MS);
        if(run.current!==id)return;
        doingAt.current=false;doneAt.current=Date.now();setDoing(false);setBubble(null);
      }
    }
    if(run.current===id){setPhase('ready');setBubble(null);void onPose('stand');setStatus(learned?`He knows “${word}”. Say it again any time.`:`${dogName} lost interest. Say “${word}” to try again.`);}
  };

  const cue=()=>{
    if(unavailable||phase!=='ready')return;
    const id=++run.current;setPhase('offering');
    const fresh=c.association<.4;
    setBubble(fresh?'?':null);
    setStatus(fresh?`“${word}?” ${dogName} tilts his head. Watch him…`:`“${word}.” ${dogName} is thinking…`);
    void offer(id);
  };

  const commit=async(next:(s:PetState)=>PetState,msg:string)=>{
    const before=captureOf(petState,name).association;
    const saved=await onPetStateChange(next);
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
    if(phase!=='offering')return;
    sound.markerClick();
    // A human finger is a beat behind the eye: a press just after he stops still counts.
    if(!doingAt.current&&Date.now()-doneAt.current>250){
      const late=Date.now()-doneAt.current<1500;
      setBubble('?');setStatus(late?`A moment too late — he'd already stopped. Watch for the next one.`:`He wasn't doing it yet. That confused him a little.`);
      void onPetStateChange(s=>withCapture(s,name,wrongMark(captureOf(s,name))));
      return;
    }
    run.current++;setPhase('marked');markedAt.current=Date.now();pulseAt.current=petPulse;
    setStatus(`Yes! Now stroke ${dogName} to reward him.`);
    const id=run.current;
    window.setTimeout(()=>{if(run.current!==id)return;run.current++;setPhase('ready');setDoing(false);doingAt.current=false;setBubble(null);
      void commit(s=>withCapture(s,name,pair(captureOf(s,name),false)),`You said it, but no stroke came — that one didn't count. Stroke him right after.`);},PET_WINDOW_MS);
  };

  // A stroke on the stage within the window completes the pairing.
  useEffect(()=>{
    if(phase!=='marked'||petPulse===pulseAt.current)return;
    run.current++;setPhase('ready');setDoing(false);doingAt.current=false;setBubble('♥');
    // A learned word performed and stroked is the trick he wanted to show you.
    const known=captureOf(petState,name).association>=LEARNED;
    void commit(s=>{const n=logCare(withCapture(s,name,pair(captureOf(s,name),true)),'train');return known?grantWish(n,'trick',Date.now()).state:n;},
      known?`Good dog! ${dogName} loves showing you “${word}”.`:`Good catch! ${dogName} liked that.`);
    window.setTimeout(()=>setBubble(b=>b==='♥'?null:b),1400);
  },[petPulse]);// eslint-disable-line react-hooks/exhaustive-deps

  const stage=typeof document!=='undefined'?document.querySelector('.stage-frame'):null;
  return (
    <div className="capture-game" data-capture-phase={phase}>
      <div className="capture-progress" aria-label={`${word}: ${stars} of 5`}>
        <span className="label">Teach “{word}”</span>
        <span className="capture-stars" aria-hidden="true">{Array.from({length:5},(_,i)=><i key={i} data-on={i<stars}>★</i>)}</span>
        <span className="data">{c.association>=LEARNED?'Learned ✓':`${stars}/5 to learn`}</span>
      </div>
      <p className="capture-status" aria-live="polite">{unavailable??(status||`Say “${word}”, then watch ${dogName}. The moment he does it, press “${word}!” and stroke him. Too early counts as a miss.`)}</p>
      <div className="capture-actions">
        <button type="button" className={`btn ${phase==='ready'?'btn-accent':'btn-quiet border-hairline'}`} onClick={cue} disabled={!!unavailable||phase!=='ready'}>Say “{word}”</button>
        <button type="button" className={`btn ${doing?'btn-accent capture-now':'btn-quiet border-hairline'}`} onClick={mark} disabled={phase!=='offering'}>“{word}!”</button>
        {phase!=='ready'&&<button type="button" className="btn btn-quiet border-hairline" onClick={()=>{stop();setStatus('Stopped. Say the word when you are ready.');}}>Stop</button>}
      </div>
      {stage&&bubble&&createPortal(<div className="think-bubble" aria-hidden="true">{bubble}</div>,stage)}
    </div>
  );
};
