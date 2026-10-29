import type {CommitPet} from '../utils/progressStore';
/**
 * THE COACH PANEL.
 *
 * The training deck, and the only region in the app where the instrument
 * points at the OWNER instead of the dog. Everything else in Canine OS watches
 * the animal; this one watches the hand.
 *
 * What it does that the old training view did not:
 *
 *   - ALL EIGHT behaviours are reachable, not four of them.
 *   - The marker delay is MEASURED, not typed. "HE DID IT" arms a timer,
 *     "MARKED" stops it, and the number that comes out is the number the
 *     owner actually managed. The old panel asked the owner to type a delay
 *     in milliseconds, which meant the timing coach never measured anything.
 *   - The cue word is stored on the behaviour and travels with it, so the
 *     panel always shows the word the dog answers to.
 *   - The observation log can actually be written to, so the personality
 *     model describes THIS dog instead of the factory defaults.
 *
 * THE LAW: one screen, nothing scrolls. Every row below is sized to fit the
 * region it was given. The only thing permitted to scroll is the attempt
 * history, and only because the model keeps forty of them.
 */

import React, { useEffect, useRef, useState } from 'react';
import { DogProfile } from '../types/dog';
import type { BehaviourName, ObservationTag, Personality, PetState, Schedule } from '../domain/types';
import { BEHAVIOURS, OBSERVATION_LABELS, OBSERVATION_TAGS, SCHEDULES } from '../domain/types';
import { getBehaviour, observe, performChance, readiness } from '../domain/pet';
import {
  nextApproximation,
  primaryCue,
  readinessToAdvance,
  recordRep,
  scheduleEffect,
  setCue,
  timingVerdict,
} from '../domain/training';
import { PracticeDeck } from './PracticeDeck';
import type {PerformPose} from './trainingMotion';

export interface CoachPanelProps {
  dog: DogProfile;
  petState: PetState;
  onPetStateChange: CommitPet;
  /** The practice field moves the dog on the stage. */
  onPose?: PerformPose;
  busy?:boolean;
}

/** Where a rep is in its life. */
type RepPhase = 'idle' | 'armed' | 'result' | 'saving';

/** What the panel shows after a rep has been applied. */
interface RepOutcome {
  strength: number;
  delta: number;
  explanation: string;
  trustDelta: number;
  delayMs?: number;
  marked: boolean;
  performed: boolean;
  real: boolean;
}

const TRAITS: { key: keyof Personality; label: string }[] = [
  { key: 'boldness', label: 'Boldness' },
  { key: 'sociability', label: 'Sociability' },
  { key: 'foodDrive', label: 'Food drive' },
  { key: 'playDrive', label: 'Play drive' },
  { key: 'sensitivity', label: 'Sensitivity' },
];

/** A chip is a chip, not a button: small, quiet, and never taller than the row. */
const CHIP = 'min-h-0 h-[20px] px-1.5 py-0 text-[9px] leading-none';
/** The secondary rep buttons. The primary pair keeps the house button height. */
const SMALL_BTN = 'min-h-0 h-[26px] px-2 py-0 text-[10px]';
/** The tiny buttons in the head and beside the manual field. */
const TINY_BTN = 'min-h-0 h-[20px] px-1.5 py-0 text-[9px] leading-none';
/** Fields sit in a 22px row so the instrument stays an instrument. */
const FIELD = 'h-[22px] min-h-0 py-0 px-1.5 text-[10px]';

const clock = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const signed = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '-' : ''}${Math.abs(value).toFixed(2)}`;

export const CoachPanel: React.FC<CoachPanelProps> = ({ dog, petState, onPetStateChange, onPose,busy }) => {
  /** PRACTICE trains the dog on the stage; LOG records reps with the real one. */
  const [mode, setMode] = useState<'practice' | 'log'>('practice');
  const [behaviourName, setBehaviourName] = useState<BehaviourName>('sit');
  const [cueText, setCueText] = useState('');
  const [phase, setPhase] = useState<RepPhase>('idle');
  const [real, setReal] = useState(true);
  const [manualDelay, setManualDelay] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [outcome, setOutcome] = useState<RepOutcome | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [obsTag, setObsTag] = useState<ObservationTag>(OBSERVATION_TAGS[0]);

  /** When the timer was armed, in the same clock the panel measures with. */
  const armedAtRef = useRef<number | null>(null);
  /** The newest state this panel knows about, so a late write never rolls
   *  back a rep that was recorded in the meantime. */
  const savingRep=useRef(false);
  const [isSavingRep,setIsSavingRep]=useState(false);
  const selectedBehaviour=useRef(behaviourName);selectedBehaviour.current=behaviourName;
  const stateRef = useRef(petState);
  stateRef.current = petState;
  const cueCommitRef = useRef<number | null>(null);
  const noteTimerRef = useRef<number | null>(null);

  const behaviour = getBehaviour(petState, behaviourName);
  const behaviourMeta = BEHAVIOURS.find((b) => b.name === behaviourName);
  const coach = readinessToAdvance(behaviour);
  const chance = performChance(petState, behaviour);
  const dogReady = readiness(petState);
  const schedule = SCHEDULES.find((s) => s.id === behaviour.schedule);
  const canonicalCue = behaviourMeta?.cue ?? '';
  const storedCues = behaviour.cues;

  /* ---- the live timer ----------------------------------------------------
   * Forty times a second is more than the eye needs; fifty milliseconds is
   * enough to feel the clock running without burning the battery.
   */
  useEffect(() => {
    if (phase !== 'armed') return undefined;
    const id = window.setInterval(() => {
      const started = armedAtRef.current;
      if (started !== null) setElapsedMs(Math.round(performance.now() - started));
    }, 50);
    return () => window.clearInterval(id);
  }, [phase]);

  /* ---- switching behaviour ------------------------------------------------
   * The cue travels with the behaviour, so the field is reloaded from the
   * behaviour that was just selected — not from the behaviour that was
   * selected before.
   */
  useEffect(() => {
    const next = getBehaviour(petState, behaviourName);
    setCueText(primaryCue(next) || BEHAVIOURS.find((b) => b.name === behaviourName)?.cue || '');
    setPhase('idle');
    setOutcome(null);
    setElapsedMs(0);
    armedAtRef.current = null;
    if (cueCommitRef.current !== null) {
      window.clearTimeout(cueCommitRef.current);
      cueCommitRef.current = null;
    }
    // Deliberately not keyed on petState: a rep must not wipe the field the
    // owner is halfway through typing in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [behaviourName]);

  useEffect(
    () => () => {
      if (noteTimerRef.current !== null) window.clearTimeout(noteTimerRef.current);
      if (cueCommitRef.current !== null) window.clearTimeout(cueCommitRef.current);
    },
    []
  );

  /* ---- the transient note -------------------------------------------------
   * Anything that comes up comes up as a bar. It says one thing and then it
   * is gone.
   */
  const showNote = (text: string): void => {
    setNote(text);
    if (noteTimerRef.current !== null) window.clearTimeout(noteTimerRef.current);
    noteTimerRef.current = window.setTimeout(() => setNote(null), 4200);
  };

  /* ---- the cue word -------------------------------------------------------
   * `setCue` APPENDS: a behaviour can answer to more than one word, and the
   * first one is the word the coach says. So a word is committed once, when
   * the edit is finished, rather than on every keystroke — typing "sit down"
   * one letter at a time would otherwise leave "s" and "si" in the dog's
   * list of words.
   */
  const commitCue = async (value: string): Promise<void> => {
    const clean = value.trim();
    if (!clean) return;
    const next=await onPetStateChange(latest=>setCue(latest,behaviourName,clean));
    if(next)stateRef.current=next;
  };

  const onCueChange = (value: string): void => {
    setCueText(value);
    if (cueCommitRef.current !== null) window.clearTimeout(cueCommitRef.current);
    cueCommitRef.current = window.setTimeout(() => commitCue(value), 700);
  };

  const onCueCommit = (): void => {
    if (cueCommitRef.current !== null) {
      window.clearTimeout(cueCommitRef.current);
      cueCommitRef.current = null;
    }
    commitCue(cueText);
  };

  /* ---- one rep, applied --------------------------------------------------- */
  const applyRep = async (input: { performed: boolean; marked: boolean; delayMs?: number }): Promise<void> => {
    if(savingRep.current)return;
    savingRep.current=true;setIsSavingRep(true);armedAtRef.current=null;setPhase('saving');
    let result!:ReturnType<typeof recordRep>;
    const saved=await onPetStateChange(latest=>{result=recordRep(latest, {
      behaviour: behaviourName,
      real,
      performed: input.performed,
      marked: input.marked,
      delayMs: input.delayMs,
      at: new Date().toISOString(),
    });return result.state;});
    savingRep.current=false;setIsSavingRep(false);
    if(!saved){setPhase('idle');showNote('Rep was not saved. Please try again.');return;}
    if(selectedBehaviour.current!==behaviourName)return;
    stateRef.current=saved;
    setOutcome({
      strength: result.outcome.behaviour.strength,
      delta: result.outcome.delta,
      explanation: result.outcome.explanation,
      trustDelta: result.trustDelta,
      delayMs: input.delayMs,
      marked: input.marked,
      performed: input.performed,
      real,
    });
    setPhase('result');
    armedAtRef.current = null;
    setElapsedMs(0);
  };

  const armTimer = (): void => {
    if(savingRep.current)return;
    armedAtRef.current = performance.now();
    setElapsedMs(0);
    setPhase('armed');
  };

  const markNow = (): void => {
    const started = armedAtRef.current;
    if (started === null) return;
    applyRep({ performed: true, marked: true, delayMs: Math.max(0, Math.round(performance.now() - started)) });
  };

  const logManual = (): void => {
    if(savingRep.current)return;
    const parsed = Number.parseInt(manualDelay, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setManualDelay('');
    applyRep({ performed: true, marked: true, delayMs: Math.min(parsed, 60000) });
  };

  const resetRep = (): void => {
    setPhase('idle');
    setOutcome(null);
    setElapsedMs(0);
    armedAtRef.current = null;
  };

  /* ---- the schedule, chosen by the owner ---------------------------------
     A schedule that cannot be chosen is a schedule that is not being taught.
     The coach's advice ends with "move to every third rep" and "make the
     reward unpredictable" — steps that only mean something if the owner can
     put the behaviour on that schedule. So the schedule is a control here,
     and changing it resets the count of reps since the last reward. */
  const setSchedule = async (next: Schedule): Promise<void> => {
    const saved=await onPetStateChange(latest=>({...latest,behaviours:{...latest.behaviours,[behaviourName]:{...getBehaviour(latest,behaviourName),schedule:next,repsSinceReinforcement:0}}}));
    if(!saved)return;
    stateRef.current=saved;
    const label=SCHEDULES.find(option=>option.id===next)?.label??next;
    showNote(`Schedule for ${dog.name}'s ${behaviourName}: ${label}. ${SCHEDULES.find(option=>option.id===next)?.note??''}`);
  };

  /* ---- one observation, logged --------------------------------------------- */
  const logObservation = async ():Promise<void> => {
    let moved:{label:string;delta:number}[]=[];
    const next=await onPetStateChange(latest=>{
      const observed=observe(latest,{tag:obsTag,at:new Date().toISOString()});
      moved=TRAITS.map(t=>({label:t.label,delta:observed.personality[t.key]-latest.personality[t.key]})).filter(t=>Math.abs(t.delta)>.0001);
      return observed;
    });
    if(!next)return;
    stateRef.current=next;
    const detail=moved.length?`, ${moved.map(t=>`${t.label} ${signed(t.delta)}`).join(', ')}`:'';
    showNote(`Logged: ${OBSERVATION_LABELS[obsTag]}${detail}`);
  };

  /* ---- the schedule's next pay ---------------------------------------------
   * `applyRep` counts the real, performed reps the same way before it asks
   * the schedule whether to pay, so the preview asks the same question of
   * the same counter.
   */
  const repsSince = behaviour.history.filter((a) => a.real && a.performed).length;
  const pay = scheduleEffect(behaviour.schedule, repsSince, 0);
  const unpredictable = behaviour.schedule === 'variableRatio' || behaviour.schedule === 'variableInterval';
  const payLine = unpredictable
    ? 'The next rep may or may not be paid. That is the point of it.'
    : pay.reinforced
      ? 'The next rep is paid.'
      : 'The next rep is not paid. It still counts as practice.';

  const recentObservations = petState.observations.slice(-2).reverse();
  const attempts = behaviour.history.slice(-12).reverse();

  return (
    <div className="panel region-coach flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      {/* ---- head: the region, the mode, the number that matters ------------ */}
      <div className="panel-head">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="font-display text-[12px] leading-none text-zinc-100">Coach</h2>
          <span className="label truncate">{behaviourMeta?.label ?? behaviourName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center">
            {(['practice', 'log'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`btn ${TINY_BTN} ${mode === m ? 'btn-accent' : 'btn-quiet border-hairline'}`}
                title={m === 'practice' ? 'Train the dog on the stage' : `Log reps with the real ${dog.name}`}
              >
                {m === 'practice' ? 'PRACTICE' : 'REAL LOG'}
              </button>
            ))}
          </div>
          {mode === 'log' && (
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setReal(true)}
              aria-pressed={real}
              className={`btn ${TINY_BTN} ${real ? 'btn-accent' : 'btn-quiet border-hairline'}`}
            >
              REAL
            </button>
            <button
              type="button"
              onClick={() => setReal(false)}
              aria-pressed={!real}
              className={`btn ${TINY_BTN} ${!real ? 'btn-accent' : 'btn-quiet border-hairline'}`}
            >
              REHEARSAL
            </button>
          </div>
          )}
          {mode === 'log' && (
          <span className="data text-[13px] leading-none text-accent" title="Game estimate from your session logs; not a measured ability">
            {Math.round(behaviour.strength * 100)}%
          </span>
          )}
        </div>
      </div>

      {mode === 'practice' ? (
        <PracticeDeck dog={dog} petState={petState} onPetStateChange={onPetStateChange} onPose={onPose ?? (async () => null)} busy={busy}/>
      ) : (
      <div className="panel-body coach-log">
        {/* ---- all eight behaviours ----------------------------------------- */}
        <div className="flex shrink-0 flex-wrap items-center gap-1 px-2 py-1.5">
          {BEHAVIOURS.map((b) => {
            const active = b.name === behaviourName;
            return (
              <button
                key={b.name}
                type="button"
                onClick={() => setBehaviourName(b.name)}
                aria-pressed={active}
                className={`btn ${CHIP} ${active ? 'btn-accent' : 'btn-quiet border-hairline'}`}
              >
                {b.label}
              </button>
            );
          })}
        </div>

        {/* ---- the marker timer --------------------------------------------- */}
        <div className="shrink-0 border-hairline-t px-2 py-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="label text-[9px]">Mark the moment</span>
            <span className="data text-[9px] text-faint">
              {behaviour.markerDelayMs > 0 ? `avg ${behaviour.markerDelayMs}ms` : 'no mark yet'}
            </span>
            <span
              className={`data text-[13px] leading-none ${
                phase === 'armed' ? 'text-accent' : outcome?.marked ? 'text-zinc-200' : 'text-zinc-500'
              }`}
            >
              {phase === 'armed'
                ? `${elapsedMs} ms`
                : outcome?.marked
                  ? `${outcome.delayMs} ms`
                  : '— ms'}
            </span>
          </div>

          {phase === 'result' && outcome ? (
            /* ---- the outcome, in the space the controls were in ------------- */
            <div className="mt-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="label text-[9px]">Log estimate</span>
                <span className="data text-[14px] leading-none text-zinc-100">
                  {Math.round(outcome.strength * 100)}%
                </span>
                <span
                  className={`data text-[11px] leading-none ${
                    outcome.delta >= 0 ? 'text-accent' : 'text-rose-400'
                  }`}
                >
                  {outcome.delta >= 0 ? '+' : ''}
                  {Math.round(outcome.delta * 100)}%
                </span>
                <span className="data text-[9px] leading-none text-faint">
                  {outcome.real ? 'REAL' : 'REHEARSAL'}
                  {outcome.trustDelta !== 0
                    ? `, trust ${outcome.trustDelta > 0 ? '+' : ''}${outcome.trustDelta}`
                    : ''}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-zinc-300">{outcome.explanation}</p>
              {outcome.marked && (
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-400">
                  {timingVerdict(outcome.delayMs)}
                </p>
              )}
              <button
                type="button"
                onClick={resetRep}
                className="btn btn-quiet border-hairline mt-1 w-full min-h-0 h-[24px] text-[10px]"
              >
                Next rep
              </button>
            </div>
          ) : (
            <>
              <div className="mt-1 flex gap-1.5">
                <button
                  type="button"
                  onClick={armTimer}
                  disabled={phase === 'armed'||isSavingRep}
                  className={`btn flex-1 text-[11px] ${
                    phase === 'armed' ? 'btn-quiet border-hairline' : 'btn-accent'
                  }`}
                >
                  He did it
                </button>
                <button
                  type="button"
                  onClick={markNow}
                  disabled={phase !== 'armed'||isSavingRep}
                  className={`btn flex-1 text-[11px] ${
                    phase === 'armed' ? 'btn-accent' : 'btn-quiet border-hairline'
                  }`}
                >
                  Marked
                </button>
              </div>

              <div className="mt-1 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => applyRep({ performed: true, marked: false })}
                  disabled={isSavingRep}
                  className={`btn btn-quiet border-hairline flex-1 ${SMALL_BTN}`}
                >
                  Not marked
                </button>
                <button
                  type="button"
                  onClick={() => applyRep({ performed: false, marked: false })}
                  disabled={isSavingRep}
                  className={`btn btn-quiet border-hairline flex-1 ${SMALL_BTN}`}
                >
                  Didn&apos;t perform
                </button>
              </div>

              <div className="mt-1 flex items-center gap-1.5">
                <label className="label shrink-0 text-[9px]" htmlFor="coach-manual-delay">
                  Manual delay
                </label>
                <input
                  id="coach-manual-delay"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={manualDelay}
                  onChange={(e) => setManualDelay(e.target.value)}
                  placeholder="ms"
                  title="For a rep you are remembering later"
                  className={`data w-[52px] shrink-0 ${FIELD}`}
                />
                <button
                  type="button"
                  onClick={logManual}
                  disabled={manualDelay.trim() === ''||isSavingRep}
                  className={`btn btn-quiet border-hairline shrink-0 ${TINY_BTN}`}
                >
                  Log
                </button>
                <span className="ml-auto truncate text-[9px] leading-none text-faint">
                  {real
                    ? 'Only your real-session logs change this estimate.'
                    : 'Rehearsal: your timing moves. The strength does not.'}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[9px] leading-none text-faint">
                Manual delay is for a rep you are remembering later.
              </p>
            </>
          )}
        </div>

        {/* ---- the cue word --------------------------------------------------- */}
        <div className="shrink-0 border-hairline-t px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <label className="label shrink-0 text-[9px]" htmlFor="coach-cue">
              Cue
            </label>
            <input
              id="coach-cue"
              type="text"
              value={cueText}
              onChange={(e) => onCueChange(e.target.value)}
              onBlur={onCueCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCueCommit();
              }}
              className={`min-w-0 flex-1 ${FIELD}`}
            />
            {storedCues.length === 0 ? (
              <span className="shrink-0 text-[9px] leading-none text-faint">not stored yet</span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 overflow-hidden">
                {storedCues.map((cue, i) => (
                  <span
                    key={cue}
                    className={`shrink-0 border-hairline px-1 text-[9px] leading-[14px] ${
                      i === 0 ? 'border-accent text-accent' : 'text-zinc-400'
                    }`}
                  >
                    {cue}
                  </span>
                ))}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[9px] leading-none text-faint">
            {storedCues[0]
              ? `The coach says "${storedCues[0]}". Say it, then act.`
              : `The word ${dog.name} will learn. Press Enter to store it.`}
          </p>
        </div>

        {/* ---- the numbers ---------------------------------------------------- */}
        <div className="shrink-0 border-hairline-t px-2 py-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="flex items-baseline gap-1">
              <span className="label text-[9px]">Chance</span>
              <span className="data text-[10px] text-zinc-200">{Math.round(chance * 100)}%</span>
            </span>
            <span className="flex items-baseline gap-1">
              <span className="label text-[9px]">Ready</span>
              <span className="data text-[10px] text-zinc-200">{Math.round(dogReady * 100)}%</span>
            </span>
            <span className="flex items-baseline gap-1">
              <label className="label text-[9px]" htmlFor="coach-schedule">
                Schedule
              </label>
              <select
                id="coach-schedule"
                value={behaviour.schedule}
                onChange={(e) => setSchedule(e.target.value as Schedule)}
                title={schedule?.note}
                className={`${FIELD} w-[104px]`}
              >
                {SCHEDULES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
            <span className="flex items-baseline gap-1">
              <span className="label text-[9px]">Reps</span>
              <span className="data text-[10px] text-zinc-200">{behaviour.performedReps ?? 0}</span>
            </span>
            <span className="flex items-baseline gap-1">
              <span className="label text-[9px]">Paid</span>
              <span className="data text-[10px] text-zinc-200">{behaviour.reps}</span>
            </span>
            <span className="flex items-baseline gap-1">
              <span className="label text-[9px]">Rehearsals</span>
              <span className="data text-[10px] text-zinc-200">{behaviour.rehearsals}</span>
            </span>
          </div>
          <p className="mt-0.5 truncate text-[9px] leading-none text-faint">{payLine}</p>
        </div>

        {/* ---- the coach ------------------------------------------------------ */}
        <div className="shrink-0 border-hairline-t px-2 py-1.5">
          <div className="flex items-baseline gap-2">
            <span
              className={`label shrink-0 text-[9px] ${coach.advance ? 'text-accent' : ''}`}
            >
              {coach.advance ? 'Advance' : 'Coach'}
            </span>
            <p className="min-w-0 flex-1 text-[10px] leading-snug text-zinc-300">{coach.reason}</p>
          </div>
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-400">
            {nextApproximation(behaviourName, { name: dog.name, sex: dog.sex })}
          </p>
        </div>

        {/* ---- what the owner saw --------------------------------------------- */}
        <div className="shrink-0 border-hairline-t px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <label className="label shrink-0 text-[9px]" htmlFor="coach-observation">
              Saw
            </label>
            <select
              id="coach-observation"
              value={obsTag}
              onChange={(e) => setObsTag(e.target.value as ObservationTag)}
              className={`min-w-0 flex-1 ${FIELD}`}
            >
              {OBSERVATION_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {OBSERVATION_LABELS[tag]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={logObservation}
              className={`btn btn-quiet border-hairline shrink-0 ${TINY_BTN}`}
            >
              Record
            </button>
          </div>

          {/* Five traits, five columns: the column count divides the item count,
              so the last one is never stranded on a row of its own. */}
          <div className="mt-1 grid grid-cols-5 gap-x-2">
            {TRAITS.map((t) => (
              <div key={t.key} className="min-w-0">
                <div className="label truncate text-[9px]">{t.label}</div>
                <div
                  className={`data text-[11px] leading-tight ${
                    petState.personality[t.key] < 0 ? 'text-zinc-400' : 'text-zinc-200'
                  }`}
                >
                  {signed(petState.personality[t.key])}
                </div>
              </div>
            ))}
          </div>

          {recentObservations.length === 0 ? (
            <p className="mt-0.5 truncate text-[9px] leading-none text-faint">
              Nothing logged yet. The traits above are the factory defaults.
            </p>
          ) : (
            <div className="mt-0.5">
              {recentObservations.map((o, i) => (
                <p key={`${o.at}-${i}`} className="truncate text-[9px] leading-[13px] text-faint">
                  {clock(o.at)}, {OBSERVATION_LABELS[o.tag]}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* ---- the attempt history -------------------------------------------- */}
        <div className="flex shrink-0 items-baseline justify-between gap-2 border-hairline-t px-2 py-1">
          <span className="label text-[9px]">Last attempts</span>
          <span className="data text-[9px] text-faint">{behaviour.history.length}</span>
        </div>

        {/* The one list in this panel that may scroll, because the model keeps
            forty of them and the region keeps what it was given. */}
        <div className={`panel-scroll px-2 ${note ? 'pb-10' : 'pb-1.5'}`}>
          {attempts.length === 0 ? (
            <p className="text-[10px] leading-snug text-faint">
              No attempts yet. Arm the timer and mark one.
            </p>
          ) : (
            <div>
              {attempts.map((a, i) => (
                <div
                  key={`${a.at}-${i}`}
                  className="flex items-baseline justify-between gap-2 border-hairline-b py-0.5 last:border-b-0"
                >
                  <span className="data text-[9px] text-faint">{clock(a.at)}</span>
                  <span
                    className={`data text-[9px] ${
                      a.performed && a.marked
                        ? 'text-accent'
                        : a.performed
                          ? 'text-zinc-300'
                          : 'text-rose-400'
                    }`}
                  >
                    {a.real ? 'REAL' : 'REHEARSAL'}{' '}
                    {a.performed ? (a.marked ? 'MARKED' : 'UNMARKED') : 'NO PERFORM'}
                    {a.delayMs !== undefined ? `, ${a.delayMs}ms` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {note && (
          <div className="bar bar--note min-w-0" role="status" aria-live="polite">
            <span className="truncate text-[10px] text-zinc-200">{note}</span>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
