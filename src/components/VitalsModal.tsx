import React, { useEffect, useRef } from 'react';
import { X, Activity, Brain, HeartPulse, Scale, ShieldCheck, Stethoscope } from 'lucide-react';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';
import { computeCanineVitals } from '../domain/canineVitals';

interface VitalsModalProps {
  dog: DogProfile;
  petState: PetState;
  onClose: () => void;
}

/**
 * CLINICAL VITALS: PHYSIQUE & PSYCHE.
 *
 * Modeled on real-world WSAVA veterinary assessment and canine cognitive ethology.
 * Every metric is computed deterministically from living state.
 * Ruled clinical rows, tabular data, single accent, zero decorative slop.
 */
export const VitalsModal: React.FC<VitalsModalProps> = ({ dog, petState, onClose }) => {
  const { physique, psyche } = computeCanineVitals(dog, petState);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Keyboard users must be able to leave the dossier with Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Move focus into the dialog so screen readers announce it.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vitals-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel w-full max-w-lg bg-[var(--bg-surface)] text-[var(--text-main)] border-hairline overflow-hidden flex flex-col max-h-[92dvh]">
        <header className="panel-head flex items-center justify-between border-b border-[var(--border-dim)] px-3 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <Stethoscope size={16} className="text-accent" aria-hidden="true" />
            <h2 id="vitals-title" className="label text-[13px] tracking-wider uppercase">
              {dog.name} · Clinical Vitals
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn-quiet p-1 min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Close clinical vitals"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="panel-body p-3 overflow-y-auto space-y-4 text-[13px] leading-relaxed">
          {/* Summary line */}
          <p className="text-[12px] text-faint pb-1 border-b border-[var(--border-dim)]">
            Computed from living metabolic transit and conditioning records. WSAVA reference ranges.
          </p>

          {/* Section 1: Physique */}
          <section aria-labelledby="heading-physique" className="space-y-2">
            <div className="flex items-center gap-1.5 text-accent font-medium text-[12px] uppercase tracking-wider">
              <HeartPulse size={14} aria-hidden="true" />
              <h3 id="heading-physique">Physique · Metabolic & Physical Health</h3>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[var(--border-dim)] p-2 bg-[var(--bg-main)]">
              <div>
                <dt className="text-[11px] text-faint">Body Condition (WSAVA 1–9)</dt>
                <dd className="data font-medium text-[14px]">
                  Score {physique.bcsScore}/9 · {physique.bcsLabel}
                </dd>
                <dd className="text-[11px] text-faint mt-0.5">{physique.bcsDetail}</dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Weight & Tissue</dt>
                <dd className="data font-medium text-[14px]">{physique.weightKg.toFixed(1)} kg</dd>
                <dd className="text-[11px] text-faint mt-0.5">{dog.breed} breed frame</dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Resting Heart Rate</dt>
                <dd className="data font-medium text-[14px]">{physique.heartRateBpm} bpm</dd>
                <dd className="text-[11px] text-faint mt-0.5">{physique.heartRateState}</dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Respiration</dt>
                <dd className="data font-medium text-[14px]">{physique.respiratoryRate} br/min</dd>
                <dd className="text-[11px] text-faint mt-0.5">{physique.respiratoryState}</dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Body Temperature</dt>
                <dd className="data font-medium text-[14px]">
                  {physique.temperatureC}°C · {physique.temperatureF}°F
                </dd>
                <dd className="text-[11px] text-faint mt-0.5">{physique.temperatureState}</dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Digestive Transit</dt>
                <dd className="data font-medium text-[14px]">{physique.digestionMinutes}/90 min</dd>
                <dd className="text-[11px] text-faint mt-0.5">{physique.giStatus}</dd>
              </div>
            </dl>
          </section>

          {/* Section 2: Psyche */}
          <section aria-labelledby="heading-psyche" className="space-y-2">
            <div className="flex items-center gap-1.5 text-accent font-medium text-[12px] uppercase tracking-wider">
              <Brain size={14} aria-hidden="true" />
              <h3 id="heading-psyche">Psyche · Autonomic Tone & Ethology</h3>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[var(--border-dim)] p-2 bg-[var(--bg-main)]">
              <div>
                <dt className="text-[11px] text-faint">Autonomic Balance</dt>
                <dd className="data font-medium text-[14px]">
                  Arousal {psyche.sympatheticTone}% · Vagal {psyche.parasympatheticTone}%
                </dd>
                <dd className="text-[11px] text-faint mt-0.5">{psyche.autonomicState}</dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Rescorla-Wagner Learning Index</dt>
                <dd className="data font-medium text-[14px]">
                  {psyche.cognitiveReadiness}% Cognitive Readiness
                </dd>
                <dd className="text-[11px] text-faint mt-0.5">{psyche.cognitiveDetail}</dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Attachment & Character</dt>
                <dd className="data font-medium text-[14px]">{psyche.attachmentStyle}</dd>
                <dd className="text-[11px] text-faint mt-0.5">Trust stability {psyche.trustScore}%</dd>
              </div>

              <div>
                <dt className="text-[11px] text-faint">Sensory & Mental Satiety</dt>
                <dd className="data font-medium text-[14px]">{psyche.sensorySatietyPercent}%</dd>
                <dd className="text-[11px] text-faint mt-0.5">
                  {psyche.conditionedCuesCount} reinforced cue{psyche.conditionedCuesCount === 1 ? '' : 's'} on record
                </dd>
              </div>
            </dl>
          </section>
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
    </div>
  );
};
