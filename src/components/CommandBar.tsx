import { dailyLife } from '../domain/dailyLife';
import React, { useEffect, useRef, useState } from 'react';
import { Utensils, Brush, Broom, Footprints, HandHeart, Volleyball, Moon, Pill, Sparkles, Send, Leaf, Cookie, Timer, CircleHelp, MessageCircle, Battery, Smile, Heart, Activity, GraduationCap, BookOpen, Trees, Hand, ChevronsDown, Music2, Wind, Bone, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';

import {calmNeed,calmRewardWait} from '../domain/calm';
export type CareAction = import('../domain/pet').Interaction;

interface CommandBarProps {
  labelsVisible:boolean;
  onToggleLabels:()=>void;
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
 * SAY, and the one thing they can do to STOP.
 */
const PLAY_ACTION: { action: CareAction; label: string; icon: LucideIcon; key: string } = {
  action: 'play',
  label: 'Play',
  icon: Volleyball,
  key: '2',
};

function pickPrimaryAction(petState: PetState, poops: number): { action: CareAction; label: string; icon: LucideIcon; key: string } {
  const needs = petState.needs ?? { hunger: 100, energy: 100, hygiene: 100 };
  if (poops > 0) return { action: 'clean', label: `Clean (${poops})`, icon: Broom, key: '1' };
  if ((needs.hunger ?? 100) < 40) return { action: 'feed', label: 'Feed', icon: Utensils, key: '1' };
  if ((needs.hygiene ?? 100) < 40) return { action: 'groom', label: 'Groom', icon: Brush, key: '1' };
  if ((needs.energy ?? 100) < 40) return { action: 'walk', label: 'Walk', icon: Footprints, key: '1' };
  return { action: 'pet', label: 'Pet', icon: HandHeart, key: '1' };
}

const GERUND: Record<CareAction, string> = {
  pet: 'Petting',
  feed: 'Feeding',
  play: 'Playing',
  walk: 'Walking',
  groom: 'Grooming',
  clean: 'Cleaning',
  medicine: 'Dosing',
  scold: 'Quiet time',
  settle: 'Quiet time',
  rewardCalm: 'Rewarding calm',
};

export const CommandBar: React.FC<CommandBarProps> = ({
  dog,
  petState,
  labelsVisible,
  onToggleLabels,
  isInteracting,
  pendingAction,
  onInteract,
  onCommunicate,
  onBed,
}) => {
  const asleep = petState.sleep?.asleep ?? false;
  const isSick = petState.sick ?? false;
  const poops = (petState.poopCount ?? 0)+dailyLife(petState).peeCount;
  const primary = pickPrimaryAction(petState, poops);
  const play = PLAY_ACTION;

  // Keyboard shortcuts 1 primary, 2 play, 6 bed, M medicine, ? labels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if(document.querySelector('dialog[open],.dog-chooser,.control-reference'))return;
      if (target && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isSick && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); onInteract('medicine'); return; }
      if (e.key === '6') { if (!isInteracting) { e.preventDefault(); onBed(); } return; }
      if (e.key === '?') { e.preventDefault(); onToggleLabels(); return; }
      if (e.key === '1' || e.key === '2') {
        e.preventDefault();
        const action = e.key === '1' ? primary.action : play.action;
        if (action === 'groom' && poops > 0) { onInteract('clean'); } else { onInteract(action); }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onInteract, onBed, onToggleLabels, isInteracting, isSick, poops, primary.action]);

  const renderButton = (cfg: {action: CareAction; label: string; icon: LucideIcon; key: string; accent?: boolean}) => {
    const busy = isInteracting && pendingAction === cfg.action;
    const Icon = cfg.icon;
    return (
      <button
        key={cfg.action}
        type="button"
        onClick={() => onInteract(cfg.action)}
        disabled={isInteracting}
        aria-busy={busy || undefined}
        aria-label={busy ? `${GERUND[cfg.action]} ${dog.name}` : `${cfg.label} ${dog.name}`}
        title={`${cfg.label} ${dog.name} (${cfg.key})`}
        className={[
          'btn px-2 text-[11px] whitespace-nowrap',
          busy ? 'btn-accent opacity-100' : 'btn-quiet border-hairline',
          cfg.accent ? 'text-amber-400 border-amber-600/40' : '',
        ].join(' ')}
      >
        <Icon size={21} aria-hidden="true" />
        <span className="sr-only">{busy ? GERUND[cfg.action] : cfg.label}</span>
      </button>
    );
  };

  return (
    <div className={`command-bar no-print icon-commands ${labelsVisible?'labels-visible':''}`} role="group" aria-label="Care controls">
      <div className="flex items-center gap-1 shrink-0">
        {renderButton({ ...primary, accent: primary.action === 'clean' })}
        {renderButton(play)}

        {/* Medicine Emergency Action when Sick */}
        {isSick && (
          <button
            type="button"
            onClick={() => onInteract('medicine')}
            disabled={isInteracting}
            aria-label={`Administer medicine to ${dog.name}`}
            title="Administer medicine (M)"
            className="btn bg-rose-600 text-white hover:bg-rose-500 px-2.5 text-[11px] font-semibold whitespace-nowrap animate-pulse"
          >
            <Pill size={21} aria-hidden="true" /><span className="sr-only">Medicine</span>
          </button>
        )}
      </div>

      {/* Bed control */}
      <button
        type="button"
        onClick={onBed}
        disabled={isInteracting}
        className={[
          'btn px-2 text-[11px] whitespace-nowrap shrink-0',
          asleep ? 'btn-accent opacity-100' : 'btn-quiet border-hairline',
        ].join(' ')}
        aria-label={`Bedtime and wake options for ${dog.name}`}
        title={asleep ? `${dog.name} is asleep · Bedtime options` : 'Bedtime and wake options (6)'}
      >
        <Moon size={21} aria-hidden="true" /><span className="sr-only">{asleep ? 'Asleep' : 'Bed'}</span>
      </button>
    </div>
  );
};

export function ControlLegend({onClose}:{onClose:()=>void}){
 return <section id="control-reference" className="panel region-care control-reference h-full" aria-label="Control labels">
  <header className="panel-head"><h2 className="label">Control labels</h2><button type="button" className="btn-quiet" aria-label="Close control labels" onClick={onClose}><X size={16} aria-hidden="true"/></button></header>
  <div className="panel-body control-legend">
    <span className="inline-flex items-center gap-1"><HandHeart size={14} aria-hidden="true"/>Need · 1</span>
    <span className="inline-flex items-center gap-1"><Volleyball size={14} aria-hidden="true"/>Play · 2</span>
    <span className="inline-flex items-center gap-1"><Moon size={14} aria-hidden="true"/>Bed · 6</span>
    <span className="inline-flex items-center gap-1"><Pill size={14} aria-hidden="true"/>Medicine · M</span>
  </div>
 </section>;
}
