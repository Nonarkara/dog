import React, { useEffect, useState } from 'react';
import {
  Broom,
  Footprints,
  HandHeart,
  Moon,
  Pill,
  Stethoscope,
  Utensils,
  Volleyball,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';
import type { Interaction } from '../domain/pet';
import { dailyLife } from '../domain/dailyLife';
import { VitalsModal } from './VitalsModal';

export type CareAction = Interaction;

interface CommandBarProps {
  labelsVisible: boolean;
  onToggleLabels: () => void;
  dog: DogProfile;
  petState: PetState;
  isInteracting: boolean;
  pendingAction: CareAction | null;
  onInteract: (action: CareAction) => void;
  onCommunicate: (cue: string) => void;
  onBed: () => void;
  onOpenVitals?: () => void;
}

/**
 * TAMAGOTCHI PHYSICAL AFFORDANCES:
 *
 * 5 fundamental care actions + Medicine (when sick) + Bed (sleep).
 * All actions are direct, 1-tap accessible, and never hidden behind an auto-selector.
 * When the pet has an urgent need (hunger, mess, low energy), that specific action
 * carries the Tamagotchi "Attention" call highlight.
 */
const BASE_ACTIONS: { action: CareAction; label: string; icon: LucideIcon; key: string }[] = [
  { action: 'feed', label: 'Feed', icon: Utensils, key: '1' },
  { action: 'pet', label: 'Pet', icon: HandHeart, key: '2' },
  { action: 'play', label: 'Play', icon: Volleyball, key: '3' },
  { action: 'walk', label: 'Walk', icon: Footprints, key: '4' },
  { action: 'groom', label: 'Clean', icon: Broom, key: '5' },
];

function getUrgentAction(petState: PetState, poops: number): CareAction | null {
  if (poops > 0) return 'groom';
  if ((petState.needs?.hunger ?? 100) < 40) return 'feed';
  if ((petState.needs?.hygiene ?? 100) < 40) return 'groom';
  if ((petState.needs?.energy ?? 100) < 35) return 'walk';
  if (petState.trust < 35) return 'pet';
  return null;
}

const GERUND: Record<CareAction, string> = {
  pet: 'Petting',
  feed: 'Feeding',
  groom: 'Grooming',
  walk: 'Walking',
  play: 'Playing with',
  medicine: 'Giving medicine to',
  clean: 'Cleaning up after',
  settle: 'Watching',
  rewardCalm: 'Rewarding',
  scold: 'Correcting',
};

export const CommandBar: React.FC<CommandBarProps> = ({
  labelsVisible,
  onToggleLabels,
  dog,
  petState,
  isInteracting,
  pendingAction,
  onInteract,
  onBed,
  onOpenVitals,
}) => {
  const [showVitals, setShowVitals] = useState(false);
  const asleep = petState.sleep?.asleep ?? false;
  const isSick = petState.sick ?? false;
  const poops = (petState.poopCount ?? 0) + dailyLife(petState).peeCount;
  const urgent = getUrgentAction(petState, poops);

  const openVitals = onOpenVitals ?? (() => setShowVitals(true));

  // Keyboard shortcuts 1..5, 6 bed, M medicine, V vitals, ? labels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (document.querySelector('dialog[open],.dog-chooser,.control-reference,[role="dialog"]')) return;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (isSick && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        onInteract('medicine');
        return;
      }
      if (e.key === '6') {
        if (!isInteracting) {
          e.preventDefault();
          onBed();
        }
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        openVitals();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        onToggleLabels();
        return;
      }

      const hit = BASE_ACTIONS.find((a) => a.key === e.key);
      if (!hit) return;
      e.preventDefault();
      if (hit.action === 'groom' && poops > 0) {
        onInteract('clean');
      } else {
        onInteract(hit.action);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onInteract, onBed, onToggleLabels, openVitals, isInteracting, isSick, poops]);

  return (
    <>
      <div
        className={`command-bar no-print icon-commands ${labelsVisible ? 'labels-visible' : ''}`}
        role="group"
        aria-label="Care controls"
      >
        <div className="flex items-center gap-1 shrink-0">
          {BASE_ACTIONS.map(({ action, label, icon: Icon, key }) => {
            const currentAction: CareAction = action === 'groom' && poops > 0 ? 'clean' : action;
            const currentLabel = action === 'groom' && poops > 0 ? `Clean (${poops})` : label;
            const CurrentIcon = action === 'groom' && poops > 0 ? Broom : Icon;
            const busy = isInteracting && pendingAction === currentAction;
            const isAttention = urgent === action;

            return (
              <button
                key={action}
                type="button"
                onClick={() => onInteract(currentAction)}
                disabled={isInteracting}
                aria-busy={busy || undefined}
                aria-label={busy ? `${GERUND[currentAction]} ${dog.name}` : `${currentLabel} ${dog.name}`}
                title={`${currentLabel} ${dog.name} (${key})${isAttention ? ' · Attention needed' : ''}`}
                className={[
                  'btn px-2 text-[11px] whitespace-nowrap min-w-[34px] min-h-[34px] h-[34px]',
                  busy ? 'btn-accent opacity-100' : 'btn-quiet border-hairline',
                  action === 'groom' && poops > 0
                    ? 'text-amber-400 border-amber-600/60'
                    : isAttention
                      ? 'border-amber-500/80 text-amber-300'
                      : '',
                ].join(' ')}
              >
                <CurrentIcon size={20} aria-hidden="true" />
                <span className="sr-only">{busy ? GERUND[currentAction] : currentLabel}</span>
              </button>
            );
          })}

          {/* Medicine Emergency Action when Sick */}
          {isSick && (
            <button
              type="button"
              onClick={() => onInteract('medicine')}
              disabled={isInteracting}
              aria-label={`Administer medicine to ${dog.name}`}
              title="Administer medicine (M)"
              className="btn bg-rose-600 text-white hover:bg-rose-500 px-2.5 text-[11px] font-semibold whitespace-nowrap animate-pulse min-w-[34px] min-h-[34px] h-[34px]"
            >
              <Pill size={20} aria-hidden="true" />
              <span className="sr-only">Medicine</span>
            </button>
          )}
        </div>

        {/* Clinical Vitals Inspection (Tamagotchi Status Screen / Button C) */}
        <button
          type="button"
          onClick={openVitals}
          className="btn btn-quiet border-hairline px-2 text-[11px] whitespace-nowrap shrink-0 min-w-[34px] min-h-[34px] h-[34px]"
          aria-label={`Inspect ${dog.name} physique and psyche vitals`}
          title={`${dog.name} clinical vitals: physique & psyche (V)`}
        >
          <Stethoscope size={20} aria-hidden="true" />
          <span className="sr-only">Vitals</span>
        </button>

        {/* Bed control */}
        <button
          type="button"
          onClick={onBed}
          disabled={isInteracting}
          className={[
            'btn px-2 text-[11px] whitespace-nowrap shrink-0 min-w-[34px] min-h-[34px] h-[34px]',
            asleep ? 'btn-accent opacity-100' : 'btn-quiet border-hairline',
          ].join(' ')}
          aria-label={`Bedtime and wake options for ${dog.name}`}
          title={asleep ? `${dog.name} is asleep · Bedtime options` : 'Bedtime and wake options (6)'}
        >
          <Moon size={20} aria-hidden="true" />
          <span className="sr-only">{asleep ? 'Asleep' : 'Bed'}</span>
        </button>

        <span className="data text-[10px] text-faint shrink-0 hidden xl:inline">
          {Math.round(petState.trust)} trust · {Math.round(petState.discipline ?? 60)}% calm
        </span>
      </div>

      {showVitals && (
        <VitalsModal dog={dog} petState={petState} onClose={() => setShowVitals(false)} />
      )}
    </>
  );
};

export function ControlLegend({ onClose }: { onClose: () => void }) {
  return (
    <section
      id="control-reference"
      className="panel region-care control-reference h-full"
      aria-label="Control labels"
    >
      <header className="panel-head flex items-center justify-between border-b border-[var(--border-dim)] px-2 py-1">
        <h2 className="label">Control labels</h2>
        <button type="button" className="btn-quiet" aria-label="Close control labels" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="panel-body control-legend p-2 space-y-1 text-[12px]">
        {BASE_ACTIONS.map(({ action, label, icon: Icon, key }) => (
          <span key={action} className="inline-flex items-center gap-1.5 mr-3">
            <Icon size={14} aria-hidden="true" />
            {label} ({key})
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 mr-3">
          <Moon size={14} aria-hidden="true" />
          Bed (6)
        </span>
        <span className="inline-flex items-center gap-1.5 mr-3">
          <Stethoscope size={14} aria-hidden="true" />
          Vitals (V)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Pill size={14} aria-hidden="true" />
          Medicine (M)
        </span>
      </div>
    </section>
  );
}
