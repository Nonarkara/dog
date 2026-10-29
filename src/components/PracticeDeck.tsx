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
  sessionAdvice,
  type Lesson,
  type TrialInput,
} from '../domain/lesson';
import type { AvatarPose } from './DogAvatar3D';
import { sound } from '../utils/proceduralAudio';

type Phase = 'ready' | 'waiting' | 'marked' | 'result' | 'saving';

interface Props {
  dog: DogProfile;
  petState: PetState;
  onPetStateChange: CommitPet;
  onPose: (pose: AvatarPose) => void;
}

const CHIP = 'min-h-0 h-[22px] px-1.5 py-0 text-[10px] leading-none';

export const PracticeDeck: React.FC<Props> = ({ dog, petState, onPetStateChange, onPose }) => {
  const [name, setName] = useState<BehaviourName>('sit');
  const [phase, setPhase] = useState<Phase>('ready');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<{ verdict: string; tip: string; score: number; advice: string | null } | null>(null);
  const [cueCount, setCueCount] = useState(0);

  const stateRef = useRef(petState);
  const saving=useRef(false),epoch=useRef(0),mounted=useRef(true);
  const [isSaving,setIsSaving]=useState(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  stateRef.current = petState;
  const trial = useRef<{ cueAt: number; responds: boolean; doneAt: number; markAt?: number; count: number }>({
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

  const finish = async (input: Omit<TrialInput, 'cueCount'>, prefix = '') => {
    if(saving.current)return;
    saving.current=true;setIsSaving(true);setPhase('saving');
    const count=trial.current.count,submittedEpoch=epoch.current;
    clearTimers();
    let r!:ReturnType<typeof scoreTrial>;
    const next=await onPetStateChange(latest=>{
      r=scoreTrial(latest.lessons?.[name]??newLesson(),{...input,cueCount:count});
      return {...latest,trust:clamp(latest.trust+r.trustDelta),lessons:{...latest.lessons,[name]:r.lesson}};
    });
    saving.current=false;setIsSaving(false);
    if(!mounted.current||epoch.current!==submittedEpoch)return;
    if(!next){setPhase('ready');setStatus('Practice was not saved. Please try again.');onPose('stand');return;}
    stateRef.current=next;
    setResult({ verdict: prefix + r.verdict, tip: r.tip, score: r.score, advice: sessionAdvice(r.lesson, r.score) });
    setPhase('result');
    if (!input.responded) onPose('stand');
  };

  const cue = () => {
    if(saving.current)return;
    if (asleep) return;
    if (phase === 'waiting') {
      trial.current.count += 1;
      setCueCount(trial.current.count);
      return;
    }
    if (phase !== 'ready') return;
    const now = performance.now();
    const roll = dogResponds(lesson, readiness(stateRef.current));
    trial.current = { cueAt: now, responds: roll.responds, doneAt: roll.responds ? now + roll.latencyMs + 500 : Infinity, count: 1 };
    setCueCount(1);
    setPhase('waiting');
    setStatus(`${dog.name} is thinking…`);
    if (roll.responds) {
      later(() => {
        onPose(POSE_FOR[name]);
        setStatus(`${dog.name} is moving into it…`);
      }, roll.latencyMs);
      later(() => setStatus(`Done — mark it now!`), roll.latencyMs + 500);
      // Never marked: he did it and nothing told him so.
      later(() => finish({ responded: true }), roll.latencyMs + 500 + 1500);
    } else {
      later(() => setStatus(`${dog.name} sniffs the floor. Wait — don't repeat it.`), 1200);
      later(() => finish({ responded: false }), WAIT_MS);
    }
  };

  const mark = () => {
    if(saving.current)return;
    if (phase !== 'waiting') return;
    const now = performance.now();
    if (!trial.current.responds) {
      finish({ responded: false }, 'You marked, but he had not done anything. ');
      return;
    }
    trial.current.markAt = now;
    if (now < trial.current.doneAt) {
      finish({ responded: true, markDelayMs: now - trial.current.doneAt });
      return;
    }
    clearTimers();
    setPhase('marked');
    setStatus('Marked. Now the treat.');
    later(() => finish({ responded: true, markDelayMs: now - trial.current.doneAt }), TREAT_WINDOW_MS + 600);
  };

  const treat = () => {
    if(saving.current)return;
    sound.eatCrunch();
    if (phase === 'marked' && trial.current.markAt !== undefined) {
      finish({
        responded: true,
        markDelayMs: trial.current.markAt - trial.current.doneAt,
        treatDelayMs: performance.now() - trial.current.markAt,
      });
    } else if (phase === 'waiting') {
      finish({ responded: trial.current.responds && performance.now() >= trial.current.doneAt }, 'A treat with no marker first. ');
    }
  };

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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
          <span className="data text-[11px] text-zinc-300" title="How solid this stage is; five clean reps in a row at 80% moves you on">
            {Math.round(lesson.skill * 100)}% · {lesson.streak} in a row
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400">{stage.how}</p>
      </div>

      <div className="shrink-0 border-hairline-t px-2 py-1.5">
        <p className="min-h-[16px] text-[12px] leading-snug text-zinc-100" aria-live="polite">
          {asleep
            ? `${dog.name} is asleep. Training waits until ${p.subj} wakes.`
            : phase === 'result' && result
              ? result.verdict
              : status || 'Cue once, wait, mark the moment, treat. Space bar does all four.'}
        </p>
        <div className="mt-1.5 flex gap-1.5">
          {phase === 'result' ? (
            <button type="button" onClick={reset} className="btn btn-accent flex-1 text-[12px]">
              Next trial
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={cue}
                disabled={asleep || phase === 'marked'||isSaving}
                className={`btn flex-1 text-[12px] ${phase === 'ready' ? 'btn-accent' : 'btn-quiet border-hairline'}`}
                title={phase === 'waiting' ? 'Giving the cue again costs you' : 'Give the cue once'}
              >
                {cueLabel}
                {cueCount > 1 ? ` ×${cueCount}` : ''}
              </button>
              <button
                type="button"
                onClick={mark}
                disabled={phase !== 'waiting'||isSaving}
                className={`btn flex-1 text-[12px] ${phase === 'waiting' ? 'btn-accent' : 'btn-quiet border-hairline'}`}
              >
                Yes! (mark)
              </button>
              <button
                type="button"
                onClick={treat}
                disabled={isSaving||(phase !== 'marked' && phase !== 'waiting')}
                className={`btn flex-1 text-[12px] ${phase === 'marked' ? 'btn-accent' : 'btn-quiet border-hairline'}`}
              >
                Treat
              </button>
            </>
          )}
        </div>
        {phase === 'result' && result && (
          <p className="mt-1 text-[11px] leading-snug text-zinc-300">
            {result.tip}
            {result.advice ? ` ${result.advice}` : ''}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden border-hairline-t px-2 py-1.5">
        <p className="label">With the real {dog.name}</p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-300">{real.lure}</p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400">Common mistake: {real.mistake}</p>
        <p className="mt-1 text-[10px] leading-snug text-faint">
          Reward-based method: Pryor, Don&apos;t Shoot the Dog · Dunbar, lure-reward · AVSAB 2021
        </p>
      </div>
    </div>
  );
};
