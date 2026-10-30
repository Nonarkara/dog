import {TrainingTips} from './TrainingTips';
import type {CommitPet} from '../utils/progressStore';
/**
 * THE PRACTICE FIELD.
 *
 * Train the Expo on the stage the way you would train the one on the floor:
 * cue once, wait, mark the instant he finishes, treat. He decides for
 * himself whether to respond, and how fast; you are scored on what you did.
 * Every lesson ends with how to do the same thing with the real dog.
 *
 * One key runs the whole trial: SPACE gives the cue, marks, treats, and
 * moves on — so the timing being trained is the timing of one finger.
 */

import React, { useEffect, useRef, useState } from 'react';
import { DogProfile } from '../types/dog';
import type { BehaviourName, PetState } from '../domain/types';
import { BEHAVIOURS } from '../domain/types';
import { clamp, getBehaviour, pronouns, readiness } from '../domain/pet';
import { primaryCue } from '../domain/training';
import {
  POSE_FOR,
  REAL_DOG,
  STAGES,
  TREAT_WINDOW_MS,
  WAIT_MS,
  dogResponds,
  newLesson,
  scoreTrial,
  practiceSession,
  endPracticeSession,
  sessionAdvice,
  type Lesson,
  type TrialInput,
} from '../domain/lesson';
import type {PerformPose} from './trainingMotion';
import {calmNeed} from '../domain/calm';
import { sound } from '../utils/proceduralAudio';

type Phase = 'ready' | 'waiting' | 'marked' | 'result' | 'saving';

interface Props {
  dog: DogProfile;
  petState: PetState;
  onPetStateChange: CommitPet;
  onPose: PerformPose;
  busy?:boolean;
  requestedBehaviour?:BehaviourName;
}

const CHIP = 'min-h-0 h-[24px] px-1 py-0 text-[10px] leading-none';

export const PracticeDeck: React.FC<Props> = ({ dog, petState, onPetStateChange, onPose,busy,requestedBehaviour }) => {
  const [name, setName] = useState<BehaviourName>(requestedBehaviour??'sit');
  useEffect(()=>{if(requestedBehaviour)setName(requestedBehaviour);},[requestedBehaviour]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{ verdict: string; tip: string; score: number; advice: string | null } | null>(null);
  const [cueCount, setCueCount] = useState(0);

  const stateRef = useRef(petState);
  const saving=useRef(false),epoch=useRef(0),mounted=useRef(true);
  const [isSaving,setIsSaving]=useState(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  stateRef.current = petState;
  const trial = useRef<{ cueAt: number; responds: boolean; doneAt: number; markAt?: number; count: number; finished?:boolean; early?:boolean }>({
    cueAt: 0,
    responds: false,
    doneAt: Infinity,
    count: 0,
  });
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const lesson: Lesson = petState.lessons?.[name] ?? newLesson();
  const stage = STAGES[lesson.stage];
  const word = primaryCue(getBehaviour(petState, name)) || BEHAVIOURS.find((b) => b.name === name)?.cue || name;
  const label = BEHAVIOURS.find((b) => b.name === name)?.label ?? name;
  const p = pronouns({ name: dog.name, sex: dog.sex });
  const asleep = petState.sleep?.asleep ?? false;
  const unavailable=calmNeed(petState,'training')||(busy?'Finish caring first.':null);
  const cueLabel = lesson.stage === 0 ? 'Lure' : lesson.stage === 1 ? 'Signal' : `“${word}”`;

  const reset = () => {
    epoch.current++;
    clearTimers();
    setPhase('ready');
    setResult(null);
    setCueCount(0);
    setStatus('');
    onPose('stand');
  };

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  useEffect(
    () => () => {
      clearTimers();
      onPose('stand');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const finish = async (input: Omit<TrialInput, 'cueCount'>, prefix = '',offered=false) => {
    if(saving.current)return;
    saving.current=true;trial.current.finished=true;setIsSaving(true);setPhase('saving');
    const count=trial.current.count,submittedEpoch=epoch.current;
    clearTimers();
    let r:ReturnType<typeof scoreTrial>|null=null;
    const next=await onPetStateChange(latest=>{
      if(calmNeed(latest,'training'))return latest;
      r=scoreTrial(latest.lessons?.[name]??newLesson(),{...input,cueCount:count});
      return {...latest,trust:clamp(latest.trust+r.trustDelta),lessons:{...latest.lessons,[name]:r.lesson}};
    });
    saving.current=false;setIsSaving(false);
    if(!mounted.current||epoch.current!==submittedEpoch)return;
    if(!next||!r){setPhase('ready');setStatus(!next?'Practice was not saved. Please try again.':'Care first; this trial was paused.');void onPose('stand');return;}
    const scored=r as ReturnType<typeof scoreTrial>;
    stateRef.current=next;
    setResult({ verdict: prefix + scored.verdict, tip: scored.tip, score: scored.score, advice: sessionAdvice({...scored.lesson,...practiceSession(next.lessons)}, scored.score) });
    setPhase('result');
    // Deliver stay/wait rewards in position, as the real-dog instructions teach.
    if(offered&&!['sit','stay','wait'].includes(name))void onPose('reward');else if(!input.responded)void onPose('stand');
  };

  const takeBreak=async()=>{
    if(saving.current||!['ready','result'].includes(phase))return;
    saving.current=true;setIsSaving(true);setPhase('saving');
    const currentEpoch=++epoch.current;
    clearTimers();void onPose('stand');
    const next=await onPetStateChange(endPracticeSession);
    saving.current=false;setIsSaving(false);
    if(!mounted.current||epoch.current!==currentEpoch)return;
    setPhase('ready');setResult(null);setCueCount(0);
    if(next){stateRef.current=next;setStatus('Practice paused. Skills saved. Take a break together.');}
    else setStatus('The break was not saved. Please try again.');
  };

  const cue = () => {
    if(saving.current)return;
    if (unavailable) return;
    if (phase === 'waiting') {
      trial.current.count += 1;
      setCueCount(trial.current.count);
      return;
    }
    if (phase !== 'ready') return;
    const now = performance.now();
    const roll = dogResponds(lesson, readiness(stateRef.current));
    trial.current = { cueAt: now, responds: roll.responds, doneAt: Infinity, count: 1 };
    setCueCount(1);
    setPhase('waiting');
    setStatus(`${dog.name} is thinking…`);
    if (roll.responds) {
      const currentTrial=trial.current,currentEpoch=epoch.current;
      later(async () => {
        setStatus(`${dog.name} is moving into it…`);
        const at=await onPose(POSE_FOR[name]);
        if(!mounted.current||currentEpoch!==epoch.current||trial.current!==currentTrial||currentTrial.finished||currentTrial.markAt!==undefined)return;
        if(at===null){clearTimers();setPhase('ready');setStatus('No completed stage action. Try again with an animated companion.');return;}
        currentTrial.doneAt=at;
        setStatus('Done — mark it now!');
        later(()=>finish({responded:true}),1500);
      },roll.latencyMs);
    } else {
      later(() => setStatus(`${dog.name} sniffs the floor. Wait — don't repeat it.`), 1200);
      later(() => finish({ responded: false }), WAIT_MS);
    }
  };

  const mark = () => {
    if(saving.current||phase!=='waiting')return;
    const now=performance.now();
    trial.current.markAt=now;
    trial.current.early=!Number.isFinite(trial.current.doneAt)||now<trial.current.doneAt;
    clearTimers();sound.markerClick();setPhase('marked');
    setStatus(trial.current.early?'Early marker — still follow it with a reward.':'Marked. Now the treat.');
    later(()=>finish({responded:trial.current.responds,markedBeforeCompletion:trial.current.early,markDelayMs:trial.current.early?undefined:now-trial.current.doneAt}),TREAT_WINDOW_MS+600);
  };

  const treat = () => {
    if(saving.current)return;
    if(phase==='marked'&&trial.current.markAt!==undefined){
      sound.eatCrunch();
      void finish({responded:trial.current.responds,markedBeforeCompletion:trial.current.early,
        markDelayMs:trial.current.early?undefined:trial.current.markAt-trial.current.doneAt,
        treatDelayMs:performance.now()-trial.current.markAt},'',true);
    }else if(phase==='waiting'){
      sound.eatCrunch();
      void finish({responded:Number.isFinite(trial.current.doneAt),prematureReward:!Number.isFinite(trial.current.doneAt)},'A treat with no marker first. ',true);
    }
  };

  useEffect(()=>{
    if(!unavailable||!['waiting','marked'].includes(phase))return;
    epoch.current++;trial.current.finished=true;clearTimers();void onPose('stand');setPhase('ready');setStatus(`${unavailable} Practice paused.`);
  },[unavailable,phase,onPose]);
  useEffect(()=>{
    const hidden=()=>{if(document.hidden&&!saving.current){epoch.current++;trial.current.finished=true;clearTimers();void onPose('stand');setPhase('ready');setStatus('Practice paused while the page was away.');}};
    document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);
  },[onPose]);

  // One key for the whole trial.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if(document.querySelector('.dog-chooser,.control-reference'))return;
      if (e.key !== ' ' || (e.target as HTMLElement)?.closest('input, textarea, select, button, a, [role="button"], [role="tab"], [role="option"]')) return;
      e.preventDefault();
      if(saving.current)return;
      if (phase === 'ready') cue();
      else if (phase === 'waiting') mark();
      else if (phase === 'marked') treat();
      else reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const real = REAL_DOG[name];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" data-practice-phase={phase} data-practice-behaviour={name}>
      <div className="flex shrink-0 flex-wrap items-center gap-1 px-2 py-1.5">
        {BEHAVIOURS.map((b) => (
          <button
            key={b.name}
            type="button"
            onClick={() => setName(b.name)}
            aria-pressed={b.name === name}
            className={`btn ${CHIP} ${b.name === name ? 'btn-accent' : 'btn-quiet border-hairline'}`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="shrink-0 border-hairline-t px-2 py-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="label">
            {label} · stage {lesson.stage + 1}/5 · {stage.label}
          </span>
          <span className="data text-[11px] text-zinc-300" title="Virtual practice skill; five clean reps at 80% unlock the next game stage">
            {Math.round(lesson.skill * 100)}% · {lesson.streak} in a row
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400">{stage.how}</p>
      </div>

      <div className="shrink-0 border-hairline-t px-2 py-1.5">
        <p className="min-h-[16px] text-[12px] leading-snug text-zinc-100" aria-live="polite">
          {unavailable
            ? unavailable
            : phase === 'result' && result
              ? result.verdict
              : status || 'Cue once, wait, mark the moment, treat. Space bar does all four.'}
        </p>
        <div className="mt-1.5 flex gap-1.5 flex-wrap">
          {phase === 'result' ? (
            <button type="button" onClick={reset} className="btn btn-accent flex-1 text-[12px]">
              Next trial
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={cue}
                disabled={!!unavailable || phase === 'marked'||isSaving}
                className={`btn flex-1 text-[12px] ${phase === 'ready' ? 'btn-accent' : 'btn-quiet border-hairline'}`}
                title={phase === 'waiting' ? 'Giving the cue again costs you' : 'Give the cue once'}
              >
                {cueLabel}
                {cueCount > 1 ? ` ×${cueCount}` : ''}
              </button>
              <button
                type="button"
                onClick={mark}
                disabled={!!unavailable||phase !== 'waiting'||isSaving}
                className={`btn flex-1 text-[12px] ${phase === 'waiting' ? 'btn-accent' : 'btn-quiet border-hairline'}`}
              >
                Yes! (mark)
              </button>
              <button
                type="button"
                onClick={treat}
                disabled={!!unavailable||isSaving||(phase !== 'marked' && phase !== 'waiting')}
                className={`btn flex-1 text-[12px] ${phase === 'marked' ? 'btn-accent' : 'btn-quiet border-hairline'}`}
              >
                Treat
              </button>
            </>
          )}
          {['ready','result'].includes(phase)&&practiceSession(petState.lessons).sessionTrials>0&&<button type="button" onClick={takeBreak} disabled={isSaving} className="btn btn-quiet border-hairline text-[12px]" title="End this dog's practice session while keeping learned skills">Take a break</button>}
        </div>
        {phase === 'result' && result && (
          <p className="mt-1 text-[11px] leading-snug text-zinc-300">
            {result.tip}
            {result.advice ? ` ${result.advice}` : ''}
          </p>
        )}
      </div>

      <details className="practice-real-notes border-hairline-t px-2 py-1.5">
        <summary className="label">With the real {dog.name} · notes</summary>
        <p className="mt-1 text-[11px] leading-snug text-zinc-300">{real.lure}</p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400">Common mistake: {real.mistake}</p>
        <p className="mt-1 text-[10px] leading-snug text-faint">
          Reward-based method: Pryor, Don&apos;t Shoot the Dog · Dunbar, lure-reward · AVSAB 2021
        </p>
      </details>
      <TrainingTips state={petState}/>
    </div>
  );
};
