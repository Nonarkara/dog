import React, { useEffect, useRef, useState } from 'react';
import { Utensils, Brush, Footprints, HandMetal, Volleyball, Moon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';

export type CareAction = 'pet' | 'feed' | 'play' | 'groom' | 'walk';

interface CommandBarProps {
  dog: DogProfile;
  petState: PetState;
  /** TRUE while an interaction is running; the controls wait for it. */
  isInteracting: boolean;
  /** Which interaction is running, so that one control can show it. */
  pendingAction: CareAction | null;
  onInteract: (action: CareAction) => void;
  onCommunicate: (cue: string) => void;
  /** Put him down for the night. */
  onBed: () => void;
}

/**
 * THE COMMAND BAR.
 *
 * On a Tamagotchi the buttons never left the screen — you did not go somewhere
 * else to press them, you pressed them where you were. So these never leave
 * the bottom of the frame either, whatever else is on screen.
 *
 * It carries the five things a person can DO to a dog, the one thing they can
 * SAY, and the one thing they can do to STOP. Nothing else lives here: a bar
 * that carries everything is a toolbar, and a toolbar is a second navigation
 * system.
 *
 * The number keys are the Palm Pilot gesture: the whole point of a dedicated
 * button was that you did not have to aim. They are digits because letters
 * collide — "p" is both pet and play, and a shortcut that silently does the
 * wrong thing is worse than no shortcut at all.
 */
const ACTIONS: { action: CareAction; label: string; icon: LucideIcon; key: string }[] = [
  { action: 'pet', label: 'Pet', icon: HandMetal, key: '1' },
  { action: 'feed', label: 'Feed', icon: Utensils, key: '2' },
  { action: 'play', label: 'Play', icon: Volleyball, key: '3' },
  { action: 'walk', label: 'Walk', icon: Footprints, key: '4' },
  { action: 'groom', label: 'Groom', icon: Brush, key: '5' },
];

const GERUND: Record<CareAction, string> = {
  pet: 'Petting',
  feed: 'Feeding',
  play: 'Playing',
  walk: 'Walking',
  groom: 'Grooming',
};

export const CommandBar: React.FC<CommandBarProps> = ({
  dog,
  petState,
  isInteracting,
  pendingAction,
  onInteract,
  onCommunicate,
  onBed,
}) => {
  const [cueText, setCueText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const asleep = petState.sleep?.asleep ?? false;

  const sendCue = () => {
    const cue = cueText.trim();
    if (!cue || isInteracting) return;
    onCommunicate(cue);
    setCueText('');
    inputRef.current?.focus();
  };

  // The keyboard shortcut is the Palm Pilot gesture: the whole point of a
  // dedicated button was that you did not have to aim.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const hit = ACTIONS.find((a) => a.key === e.key);
      if (!hit) return;
      e.preventDefault();
      onInteract(hit.action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onInteract]);

  return (
    <div className="command-bar no-print" role="group" aria-label="Care controls">
      <div className="flex items-center gap-1 shrink-0">
        {ACTIONS.map(({ action, label, icon: Icon, key }) => {
          const busy = isInteracting && pendingAction === action;
          return (
            <button
              key={action}
              type="button"
              onClick={() => onInteract(action)}
              disabled={isInteracting}
              aria-busy={busy || undefined}
              aria-label={busy ? `${GERUND[action]} ${dog.name}` : `${label} ${dog.name}`}
              title={`${label} ${dog.name}  (${key})`}
              className={[
                'btn px-2 text-[11px] whitespace-nowrap',
                busy ? 'btn-accent opacity-100' : 'btn-quiet border-hairline',
              ].join(' ')}
            >
              <Icon size={12} aria-hidden="true" />
              {busy ? GERUND[action] : label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <label htmlFor="cmd-cue" className="label shrink-0 hidden sm:block">
          Say
        </label>
        <input
          id="cmd-cue"
          ref={inputRef}
          type="text"
          value={cueText}
          onChange={(e) => setCueText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendCue();
            }
          }}
          placeholder={asleep ? `${dog.name} is asleep` : `Say to ${dog.name}`}
          aria-label={`Say a word to ${dog.name}`}
          className="flex-1 min-w-0 px-2 py-1 text-[12px]"
        />
        <button
          type="button"
          onClick={sendCue}
          disabled={isInteracting || !cueText.trim()}
          className="btn btn-accent text-[11px] px-2.5 shrink-0 disabled:opacity-40"
        >
          Say
        </button>
      </div>

      {/* THE BED. The one control that is about STOPPING, not doing. It is
          here because the hardest part of a Tamagotchi is knowing when to
          leave the animal alone. */}
      <button
        type="button"
        onClick={onBed}
        disabled={isInteracting}
        className={[
          'btn px-2 text-[11px] whitespace-nowrap shrink-0',
          asleep ? 'btn-accent opacity-100' : 'btn-quiet border-hairline',
        ].join(' ')}
        aria-label={asleep ? `${dog.name} is asleep` : `Put ${dog.name} to bed`}
        title={asleep ? `${dog.name} is asleep` : 'Put him to bed (6)'}
      >
        <Moon size={12} aria-hidden="true" />
        {asleep ? 'Asleep' : 'Bed'}
      </button>

      <span className="data text-[10px] text-faint shrink-0 hidden xl:inline">
        {Math.round(petState.trust)} trust, {Math.round(petState.arousal)} arousal
      </span>
    </div>
  );
};
