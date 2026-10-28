import React, { useEffect, useRef, useState } from 'react';
import { DogProfile } from '../types/dog';
import { Utensils, Brush, Footprints, HandMetal, Volleyball, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Action = 'pet' | 'feed' | 'play' | 'groom' | 'walk';

interface TamagotchiControlsProps {
  dog: DogProfile;
  onInteract: (action: Action) => void;
  isInteracting: boolean;
}

// Two columns, not four: this panel sits in a ~460px column, and four stats
// across it collide the label with its own value.
const STATS: { key: 'hunger' | 'happiness' | 'energy' | 'hygiene'; label: string }[] = [
  { key: 'hunger', label: 'Hunger' },
  { key: 'happiness', label: 'Happiness' },
  { key: 'energy', label: 'Energy' },
  { key: 'hygiene', label: 'Hygiene' },
];

const LOW_THRESHOLD = 30;

const GERUND: Record<Action, string> = {
  pet: 'Petting',
  feed: 'Feeding',
  play: 'Playing',
  groom: 'Grooming',
  walk: 'Walking',
};

export const TamagotchiControls: React.FC<TamagotchiControlsProps> = ({
  dog,
  onInteract,
  isInteracting,
}) => {
  const stats = dog.tamagotchi;

  // The parent says that something is happening but not what. Keeping the
  // action here is what lets the pressed control show its own busy state.
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const wasInteracting = useRef(isInteracting);

  useEffect(() => {
    if (wasInteracting.current && !isInteracting && pendingAction) {
      setAnnouncement(`${GERUND[pendingAction]} ${dog.name} complete.`);
    }
    wasInteracting.current = isInteracting;
    if (!isInteracting) setPendingAction(null);
  }, [isInteracting, pendingAction, dog.name]);

  const run = (action: Action) => {
    if (isInteracting) return;
    setPendingAction(action);
    setAnnouncement(`${GERUND[action]} ${dog.name}`);
    onInteract(action);
  };

  const renderAction = (action: Action, Icon: LucideIcon, label: string, primary = false) => {
    const busy = isInteracting && pendingAction === action;
    const text = busy ? `${GERUND[action]}…` : label;
    return (
      <button
        type="button"
        onClick={() => run(action)}
        disabled={isInteracting}
        aria-busy={busy || undefined}
        aria-label={busy ? `${GERUND[action]} ${dog.name}` : `${label} ${dog.name}`}
        className={[
          'btn',
          primary ? 'btn-accent w-full' : 'btn-quiet border-hairline hover:border-accent',
          // The disabled state is kept for every control, but the one that is
          // working stays at full opacity so the row does not read as dead.
          busy ? 'opacity-100' : '',
        ].join(' ')}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
        {text}
      </button>
    );
  };

  return (
    <div className="@container border-hairline bg-zinc-950 p-3 space-y-3">
      <header className="space-y-1 border-hairline-b pb-2.5">
        <h2 className="font-display text-[15px] leading-none text-zinc-100">Pet care deck</h2>
        {/* No live dot: there is no server. The values live on this device and
            decay on a local timer, so the line says exactly that. */}
        <p className="text-[11px] leading-snug text-faint">
          {dog.name}&apos;s care stats, kept on this device. Hunger, energy and hygiene drift down
          on their own.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {STATS.map(({ key, label }) => {
          const value = stats[key];
          const isLow = value < LOW_THRESHOLD;
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="label">{label}</span>
                {/* The low state is named, not only coloured. */}
                {isLow && <span className="label text-rose-400">Low</span>}
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className={`data text-[20px] leading-none ${isLow ? 'text-rose-400' : 'text-zinc-100'}`}
                >
                  {value}
                </span>
                <span className="data text-[11px] leading-none text-faint">%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${label}, ${value} percent${isLow ? ', low' : ''}`}
                className="h-1 w-full overflow-hidden bg-zinc-900"
              >
                <div
                  className={`h-full ${isLow ? 'bg-rose-500' : 'bg-accent'}`}
                  style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-hairline-t pt-3">
        {renderAction('pet', HandMetal, 'Pet', true)}
        {/* The four secondary actions sit 2x2 until the column is wide enough
            to hold four of them side by side without crowding. */}
        <div className="grid grid-cols-2 gap-2 @min-[420px]:grid-cols-4">
          {renderAction('feed', Utensils, 'Feed')}
          {renderAction('play', Volleyball, 'Play')}
          {renderAction('walk', Footprints, 'Walk')}
          {renderAction('groom', Brush, 'Groom')}
        </div>
      </div>

      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
};
