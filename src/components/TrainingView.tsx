import React, { useState, useEffect, useRef } from 'react';
import { DogProfile } from '../types/dog';
import type { PetState, BehaviourName, Behaviour, Schedule, Attempt } from '../domain/types';
import { getBehaviour, performChance } from '../domain/pet';
import {
  recordRep,
  timingVerdict,
  readinessToAdvance,
  nextApproximation,
} from '../domain/training';
import { BEHAVIOURS, SCHEDULES } from '../domain/types';
import { ArrowRight } from 'lucide-react';

type RepStatus = 'idle' | 'recording' | 'result';

/** THE TRAINING DECK.
 *
 * This is where you learn to teach your dog. The screen is built around one
 * question at a time: what did the dog do, did you mark it, and was it paid
 * for? Every answer moves the behaviour's strength up or down, and the app
 * tells you why in plain words.
 *
 * Psychology, subtly:
 *   - Operant conditioning: a behaviour changes because of what happens AFTER
 *     it. The reward must follow the marker within half a second.
 *   - Classical conditioning: say a cue, then act. Expo learns the cue means
 *     something.
 *   - Extinction burst: when rewards stop, the behaviour gets worse before it
 *     gets better. The app names this so you don't read it as stubbornness.
 *   - Readiness to advance: the app tells you when to make rewards harder to
 *     predict, based on the dog's actual strength — not your feeling.
 */
interface TrainingViewProps {
  dog: DogProfile;
  petState: PetState;
  onPetStateChange: (state: PetState) => void;
  onInteract: (action: 'pet' | 'feed' | 'play' | 'groom' | 'walk') => void;
}

export const TrainingView: React.FC<TrainingViewProps> = ({
  dog,
  petState,
  onPetStateChange,
  onInteract,
}) => {
  const [behaviourName, setBehaviourName] = useState<BehaviourName>('sit');
  const [cueWord, setCueWord] = useState('');
  const [repStatus, setRepStatus] = useState<RepStatus>('idle');
  const [lastResult, setLastResult] = useState<{ strength: number; delta: number; explanation: string; trustDelta: number } | null>(null);

  // Rep recording form state
  const [performed, setPerformed] = useState(false);
  const [marked, setMarked] = useState(false);
  const [delayMs, setDelayMs] = useState(100);
  const [real, setReal] = useState(true);

  const behaviour = getBehaviour(petState, behaviourName);
  const schedule = behaviour.schedule;

  // When the behaviour changes, reset the form and cue word to that behaviour's cue.
  useEffect(() => {
    setCueWord(behaviour.cues[0] || '');
    setPerformed(false);
    setMarked(false);
    setDelayMs(100);
    setRepStatus('idle');
    setLastResult(null);
  }, [behaviourName, behaviour.cues]);

  const handleRecordRep = () => {
    const input = {
      behaviour: behaviourName,
      real,
      performed,
      marked,
      delayMs: marked ? delayMs : undefined,
      at: new Date().toISOString(),
    };

    const result = recordRep(petState, input);
    onPetStateChange(result.state);

    setLastResult({
      strength: result.outcome.behaviour.strength,
      delta: result.outcome.delta,
      explanation: result.outcome.explanation,
      trustDelta: result.trustDelta,
    });
    setRepStatus('result');
  };

  const handleNewRep = () => {
    setRepStatus('idle');
    setPerformed(false);
    setMarked(false);
    setDelayMs(100);
    setReal(true);
    setLastResult(null);
  };

  const readiness = readinessToAdvance(behaviour);
  const approximation = nextApproximation(behaviourName);
  const chance = performChance(petState, behaviour);

  return (
    <div className="space-y-4">
      {/* ---- header: which behaviour ------------------------------------- */}
      <div className="border-hairline bg-surface p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-base text-white">{dog.name}</h2>
            <span className="label text-xs uppercase tracking-wider">training</span>
          </div>
          <p className="text-[11px] text-faint mt-0.5">
            Teach {BEHAVIOURS.find((b) => b.name === behaviourName)?.label}. Strength {Math.round(behaviour.strength * 100)}% ·
            {chance > 0 ? `${Math.round(chance * 100)}% chance of performing when cued` : 'Not trained yet'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            onClick={() => setBehaviourName('sit')}
            className={`btn ${behaviourName === 'sit' ? 'btn-accent' : 'btn-quiet border-hairline'} text-[10px] px-2.5 shrink-0`}
          >
            Sit
          </button>
          <button
            onClick={() => setBehaviourName('down')}
            className={`btn ${behaviourName === 'down' ? 'btn-accent' : 'btn-quiet border-hairline'} text-[10px] px-2.5 shrink-0`}
          >
            Down
          </button>
          <button
            onClick={() => setBehaviourName('stay')}
            className={`btn ${behaviourName === 'stay' ? 'btn-accent' : 'btn-quiet border-hairline'} text-[10px] px-2.5 shrink-0`}
          >
            Stay
          </button>
          <button
            onClick={() => setBehaviourName('come')}
            className={`btn ${behaviourName === 'come' ? 'btn-accent' : 'btn-quiet border-hairline'} text-[10px] px-2.5 shrink-0`}
          >
            Come
          </button>
        </div>
      </div>

      {/* ---- cue word ------------------------------------------------------ */}
      <div className="border-hairline bg-surface p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div>
          <label className="label block mb-1">Cue word</label>
          <input
            type="text"
            value={cueWord}
            onChange={(e) => setCueWord(e.target.value)}
            placeholder="e.g. sit"
            className="w-full border-hairline bg-black px-2 py-1.5 text-xs text-zinc-100"
          />
          <p className="text-[10px] text-faint mt-1">
            The word {dog.name} learns to answer. Say it, then act — classical conditioning.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <span className="label">Schedule</span>
          <span className={`font-mono text-xs ${schedule === 'continuous' ? 'text-zinc-200' : 'text-accent'}`}>
            {SCHEDULES.find((s) => s.id === schedule)?.label}
          </span>
        </div>
      </div>

      {/* ---- what to mark now --------------------------------------------- */}
      <div className="border-hairline bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="label">What to mark right now</span>
          <span className="font-mono text-xs text-accent">
            {Math.round(behaviour.strength * 100)}% strength
          </span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">{approximation}</p>
        <p className="text-[10px] text-faint mt-2">
          Mark the smallest step toward the full behaviour, not the behaviour itself.
          {readiness.advance ? ` {readiness.reason}` : ''}
        </p>
      </div>

      {/* ---- record a rep -------------------------------------------------- */}
      <div className="border-hairline bg-surface p-3">
        <h3 className="font-display text-sm text-white mb-3">Record a rep</h3>

        {repStatus === 'idle' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={performed}
                  onChange={() => setPerformed(true)}
                  className="w-4 h-4 accent-accent border-hairline"
                />
                <span className="text-xs text-zinc-200">Dog performed it</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!performed}
                  onChange={() => setPerformed(false)}
                  className="w-4 h-4 accent-accent border-hairline"
                />
                <span className="text-xs text-zinc-500">Dog didn't perform</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={marked}
                  onChange={() => setMarked(true)}
                  className="w-4 h-4 accent-accent border-hairline"
                />
                <span className="text-xs text-zinc-200">You marked it (clicker/word)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!marked}
                  onChange={() => setMarked(false)}
                  className="w-4 h-4 accent-accent border-hairline"
                />
                <span className="text-xs text-zinc-500">Not marked</span>
              </label>
            </div>

            {marked && (
              <div className="space-y-1">
                <label className="label block mb-1">Marker delay (ms)</label>
                <input
                  type="number"
                  value={delayMs}
                  onChange={(e) => setDelayMs(Math.max(0, Math.min(2000, parseInt(e.target.value) || 0)))}
                  className="w-full border-hairline bg-black px-2 py-1.5 text-xs text-zinc-100"
                />
                <span className="text-[10px] text-faint">
                  {timingVerdict(delayMs)}
                  {delayMs > 500 && ' — too late, the dog won\'t connect it'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={real}
                  onChange={() => setReal(true)}
                  className="w-4 h-4 accent-accent border-hairline"
                />
                <span className="text-xs text-zinc-200">Happened with the real dog</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!real}
                  onChange={() => setReal(false)}
                  className="w-4 h-4 accent-accent border-hairline"
                />
                <span className="text-xs text-zinc-500">Rehearsal in the app</span>
              </label>
            </div>

            <p className="text-[10px] text-faint">
              A rehearsal teaches you the timing — it does NOT move the behaviour's strength.
              Only a rep with the real animal counts.
            </p>

            <button
              onClick={handleRecordRep}
              className="btn btn-accent w-full text-xs"
            >
              Record rep
            </button>
          </div>
        )}

        {repStatus === 'result' && lastResult && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="label text-xs uppercase">Strength</span>
              <span className={`font-mono text-[18px] ${lastResult.delta >= 0 ? 'text-accent' : 'text-rose-400'}`}>
                {Math.round(lastResult.strength * 100)}%
                {lastResult.delta !== 0 && (
                  <span className={`text-xs ${lastResult.delta >= 0 ? 'text-accent' : 'text-rose-400'}`}>
                    {lastResult.delta > 0 ? '+' : ''}{Math.round(lastResult.delta * 100)}%
                  </span>
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">{lastResult.explanation}</p>
            {lastResult.trustDelta !== 0 && (
              <p className="text-[10px] text-faint">
                Trust {lastResult.trustDelta > 0 ? 'up' : 'down'}{' · '}
              </p>
            )}
            <button
              onClick={handleNewRep}
              className="btn btn-quiet border-hairline w-full text-xs"
            >
              Record another rep <ArrowRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ---- readiness to advance ---------------------------------------- */}
      <div className="border-hairline bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="label">Coach says</span>
          <span className={`font-mono text-xs ${readiness.advance ? 'text-accent' : 'text-zinc-300'}`}>
            {readiness.advance ? 'Ready to advance' : 'Keep going'}
          </span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">{readiness.reason}</p>
      </div>

      {/* ---- history ------------------------------------------------------- */}
      <div className="border-hairline bg-surface p-3">
        <h3 className="font-display text-sm text-white mb-2">Last attempts</h3>
        {behaviour.history.length === 0 ? (
          <p className="text-[11px] text-faint">No attempts recorded yet. Record the first rep above.</p>
        ) : (
          <div className="space-y-1">
            {behaviour.history.slice(-6).reverse().map((attempt, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 border-hairline-b py-1 last:border-hairline-b-0">
                <span className="text-[10px] text-zinc-500">
                  {attempt.real ? 'Real' : 'Rehearsal'} · {attempt.marked ? 'Marked' : 'Unmarked'}
                </span>
                <span className={`text-[10px] font-mono ${
                  attempt.performed && attempt.marked ? 'text-accent' : attempt.performed ? 'text-zinc-300' : 'text-rose-400'
                }`}>
                  {attempt.performed ? 'Performed' : 'No perform'} · {attempt.delayMs ? attempt.delayMs + 'ms' : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
