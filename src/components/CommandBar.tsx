import { dailyLife } from '../domain/dailyLife';
import React, { useEffect, useRef, useState } from 'react';
import { Utensils, Brush, Footprints, HandHeart, Volleyball, Moon, Pill, Sparkles, AlertTriangle, Send, ShieldAlert, CircleHelp, Battery, Smile, Heart, Activity, GraduationCap, BookOpen, Trees, Hand, ChevronsDown, Music2, Wind, Bone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';

export type CareAction = 'pet' | 'feed' | 'play' | 'groom' | 'walk' | 'clean' | 'medicine' | 'scold';

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
 * SAY, and the one thing they can do to STOP.
 */
const BASE_ACTIONS: { action: CareAction; label: string; icon: LucideIcon; key: string }[] = [
  { action: 'pet', label: 'Pet', icon: HandHeart, key: '1' },
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
  clean: 'Cleaning',
  medicine: 'Dosing',
  scold: 'Scolding',
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
  const [labelsVisible,setLabelsVisible]=useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const asleep = petState.sleep?.asleep ?? false;
  const isSick = petState.sick ?? false;
  const poops = (petState.poopCount ?? 0)+dailyLife(petState).peeCount;
  const isTantrum = petState.call?.reason === 'tantrum';

  const sendCue = () => {
    const cue = cueText.trim();
    if (!cue || isInteracting) return;
    onCommunicate(cue);
    setCueText('');
    inputRef.current?.focus();
  };

  // Keyboard shortcuts 1..5, plus 'M' for medicine if sick
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isSick && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        onInteract('medicine');
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
  }, [onInteract, isSick, poops]);

  return (
    <div className={`command-bar no-print icon-commands ${labelsVisible?'labels-visible':''}`} role="group" aria-label="Care controls">
      <div className="flex items-center gap-1 shrink-0">
        {BASE_ACTIONS.map(({ action, label, icon: Icon, key }) => {
          // Dynamic clean adaptation if stage has waste
          const currentAction: CareAction = action === 'groom' && poops > 0 ? 'clean' : action;
          const currentLabel = action === 'groom' && poops > 0 ? `Clean (${poops})` : label;
          const CurrentIcon = action === 'groom' && poops > 0 ? Sparkles : Icon;
          const busy = isInteracting && pendingAction === currentAction;

          return (
            <button
              key={action}
              type="button"
              onClick={() => onInteract(currentAction)}
              disabled={isInteracting}
              aria-busy={busy || undefined}
              aria-label={busy ? `${GERUND[currentAction]} ${dog.name}` : `${currentLabel} ${dog.name}`}
              title={`${currentLabel} ${dog.name} (${key})`}
              className={[
                'btn px-2 text-[11px] whitespace-nowrap',
                busy ? 'btn-accent opacity-100' : 'btn-quiet border-hairline',
                action === 'groom' && poops > 0 ? 'text-amber-400 border-amber-600/40' : '',
              ].join(' ')}
            >
              <CurrentIcon size={21} aria-hidden="true" />
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
            className="btn bg-rose-600 text-white hover:bg-rose-500 px-2.5 text-[11px] font-semibold whitespace-nowrap animate-pulse"
          >
            <Pill size={21} aria-hidden="true" /><span className="sr-only">Medicine</span>
          </button>
        )}
      </div>

<button type="button" className="btn-quiet" aria-label="Show control labels" aria-pressed={labelsVisible} title="Control labels" onClick={()=>setLabelsVisible(v=>!v)}><CircleHelp size={20} aria-hidden="true"/></button>
      {labelsVisible&&<div className="control-legend flex flex-wrap gap-x-3 gap-y-1 basis-full" aria-label="Control legend">{BASE_ACTIONS.map(({action,label,icon:Icon})=><span key={action} className="inline-flex items-center gap-1"><Icon size={14} aria-hidden="true"/>{label}</span>)}<span className="inline-flex items-center gap-1"><Moon size={14} aria-hidden="true"/>Bed</span>{[[Utensils,'Fullness'],[Battery,'Energy'],[Sparkles,'Hygiene'],[Smile,'Happiness'],[Heart,'Trust'],[Activity,'Excitement'],[Heart,'Care'],[GraduationCap,'Coach'],[BookOpen,'Record'],[Trees,'Commons'],[Hand,'High five'],[ChevronsDown,'Play bow'],[Music2,'Happy wiggle'],[Wind,'Zoomies'],[Bone,'Find the treat']].map(([Icon,label])=><span key={String(label)} className="inline-flex items-center gap-1">{React.createElement(Icon as typeof Heart,{size:14,'aria-hidden':true})}{String(label)}</span>)}</div>}
      {/* Cue field or Tantrum Scold action */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 order-last basis-full sm:order-none sm:basis-auto">
        {isTantrum ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="label text-rose-400 truncate flex items-center gap-1">
              <AlertTriangle size={12} />
              Misbehaving
            </span>
            <button
              type="button"
              onClick={() => onInteract('scold')}
              disabled={isInteracting}
              className="btn btn-accent text-[11px] px-2.5 py-1 whitespace-nowrap font-semibold"
              title="Discipline: firm 'No!' to curb tantrums"
            >
              <ShieldAlert size={21} aria-hidden="true"/><span className="sr-only">Scold ("No!")</span>
            </button>
          </div>
        ) : (
          <>
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
              <Send size={19} aria-hidden="true"/><span className="sr-only">Say</span>
            </button>
          </>
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
        aria-label={asleep ? `${dog.name} is asleep` : `Put ${dog.name} to bed`}
        title={asleep ? `${dog.name} is asleep` : 'Put him to bed (6)'}
      >
        <Moon size={21} aria-hidden="true" /><span className="sr-only">{asleep ? 'Asleep' : 'Bed'}</span>
      </button>

      <span className="data text-[10px] text-faint shrink-0 hidden xl:inline">
        {Math.round(petState.trust)} trust · {Math.round(petState.discipline ?? 60)}% disc
      </span>
    </div>
  );
};
