import React, { useEffect, useRef } from 'react';
import { X, Brain, HeartPulse, Stethoscope } from 'lucide-react';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';
import { computeCanineVitals } from '../domain/canineVitals';
import { recordSources } from '../utils/recordProvenance';

interface VitalsModalProps {
  dog: DogProfile;
  petState: PetState;
  onClose: () => void;
}

export const VitalsModal: React.FC<VitalsModalProps> = ({ dog, petState, onClose }) => {
  const { physique, psyche } = computeCanineVitals(dog, petState);
  const exampleWeight = recordSources(dog).fields.includes('weightKg');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    dialog?.showModal();
    closeRef.current?.focus();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[calc(100%_-_24px)] max-w-lg max-h-[92dvh] overflow-hidden bg-transparent p-0 backdrop:bg-black/60"
      aria-labelledby="vitals-title"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-lg bg-[var(--bg-surface)] text-[var(--text-main)] border-hairline overflow-hidden flex flex-col max-h-[92dvh]">
        <header className="panel-head flex items-center justify-between border-b border-[var(--border-dim)] px-3 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <Stethoscope size={16} className="text-accent" aria-hidden="true" />
            <h2 id="vitals-title" className="label text-[13px]">
              {dog.name} · Game vitals
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn-quiet p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close game vitals"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="panel-body p-3 overflow-y-auto space-y-4 text-[13px] leading-relaxed">
          {/* Summary line */}
          <p className="text-[12px] text-faint pb-1 border-b border-[var(--border-dim)]">
            Game readings. Profile weight comes from the dog's record.
          </p>

          {/* Section 1: Physique */}
          <section aria-labelledby="heading-physique" className="space-y-2">
            <div className="flex items-center gap-1.5 text-accent font-medium text-[12px]">
              <HeartPulse size={14} aria-hidden="true" />
              <h3 id="heading-physique">Body</h3>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[var(--border-dim)] p-2 bg-[var(--bg-main)]">
              <div>
                <dt className="text-[11px] text-faint">Bladder fullness</dt>
                <dd className="data font-medium text-[14px]">{physique.bladderPercent}%</dd>
                {physique.bladderPercent >= 70 && <dd className="text-[11px] text-faint mt-0.5">Time to go out.</dd>}
              </div>

              <div>
                <dt className="text-[11px] text-faint">Profile weight</dt>
                <dd className="data font-medium text-[14px]">{physique.weightKg === null ? 'Unknown' : `${physique.weightKg.toFixed(1)} kg`}</dd>
                {physique.weightKg !== null && <dd className="text-[11px] text-faint mt-0.5">{exampleWeight ? 'Starter example' : 'From the dog’s record'}</dd>}
              </div>

              <div>
                <dt className="text-[11px] text-faint">Digestion timer</dt>
                <dd className="data font-medium text-[14px]">{physique.digestionMinutes}/90 min</dd>
              </div>
            </dl>
          </section>

          {/* Section 2: Psyche */}
          <section aria-labelledby="heading-psyche" className="space-y-2">
            <div className="flex items-center gap-1.5 text-accent font-medium text-[12px]">
              <Brain size={14} aria-hidden="true" />
              <h3 id="heading-psyche">Mood and learning</h3>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[var(--border-dim)] p-2 bg-[var(--bg-main)]">
              <div>
                <dt className="text-[11px] text-faint">Excitement and calm practice</dt>
                <dd className="data font-medium text-[14px]">
                  {psyche.sympatheticTone}% · {psyche.parasympatheticTone}%
                </dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Ready to practise</dt>
                <dd className="data font-medium text-[14px]">
                  {psyche.cognitiveReadiness}%
                </dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Character</dt>
                <dd className="data font-medium text-[14px]">{psyche.attachmentStyle}</dd>
                <dd className="text-[11px] text-faint mt-0.5">Trust {psyche.trustScore}%</dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Contentment from activity</dt>
                <dd className="data font-medium text-[14px]">{psyche.sensorySatietyPercent}%</dd>
                <dd className="text-[11px] text-faint mt-0.5">
                  {psyche.conditionedCuesCount} reinforced cue{psyche.conditionedCuesCount === 1 ? '' : 's'} on record
                </dd>
              </div>
            </dl>
          </section>
          <details className="border-hairline-t pt-2">
            <summary className="cursor-pointer">Simulated pulse, breathing and temperature</summary>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <div><dt>Pulse</dt><dd className="data">{physique.heartRateBpm} bpm</dd></div>
              <div><dt>Breathing</dt><dd className="data">{physique.respiratoryRate} breaths/min</dd></div>
              <div><dt>Temperature</dt><dd className="data">{physique.temperatureC}°C · {physique.temperatureF}°F</dd></div>
              <div><dt>Fullness-based condition score</dt><dd className="data">{physique.bcsScore}/9</dd></div>
            </dl>
          </details>
        </div>

        <footer className="panel-foot border-t border-[var(--border-dim)] px-3 py-2 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-quiet border-hairline px-3 py-1 text-[12px]"
          >
            Done
          </button>
        </footer>
      </div>
    </dialog>
  );
};
