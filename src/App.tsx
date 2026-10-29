import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { DogProfile } from './types/dog';
import type { PetState } from './domain/types';
import { dailyLife } from './domain/dailyLife';
import type { AvatarPose, AvatarInteractionTrigger } from './components/DogAvatar3D';
import { addTogether, answerCall, tickCall } from './domain/attention';
import type { CoatPattern } from './domain/coat';
import { dogTheme, DOG_THEMES } from './data/dogThemes';
import { DEFAULT_DOGS } from './data/defaultDogs';
import {
  loadStoredDogs,
  saveDogs,
  loadActiveDogId,
  saveActiveDogId,
  calculateDogAge,
  loadPetState,
  savePetState,
} from './utils/dogCalculators';
import { CommandBar } from './components/CommandBar';
import type { CareAction } from './components/CommandBar';
import { CarePanel } from './components/CarePanel';
import { Dog, Plus, X, ChevronDown, RotateCcw, Heart, GraduationCap, BookOpen, Trees, ShieldCheck } from 'lucide-react';
import {
  createPetState,
  interact,
  communicate,
  decay,
  happiness,
  settleSleep,
  willSettle,
} from './domain/pet';

/**
 * THE COCKPIT.
 *
 * ONE SCREEN. The document does not scroll, because a Tamagotchi did not
 * scroll: the animal, the indicators and the buttons were all there, and
 * anything that came up came up as a bar.
 *
 * So this is a fixed frame with three parts and nothing else:
 *
 *   HEADER      one band — what this is, which dog, which facts.
 *   WORKSPACE   the regions. On a wide screen all five are on screen at once,
 *               which is what a dashboard is. On a narrow screen the animal is
 *               on top and one region is below it, chosen from a strip.
 *   COMMAND BAR the five things you can do to a dog, and the one thing you
 *               can say. They never leave the bottom of the frame.
 *
 * There is no page to scroll to, because there is no second page.
 */

const IllustratedDog = lazy(() => import('./components/IllustratedDog').then(m => ({ default: m.IllustratedDog })));

const DogAvatar3D = lazy(() =>
  import('./components/DogAvatar3D').then((m) => ({ default: m.DogAvatar3D }))
);
// A REAL MODEL, when the record has one attached. The drawn animal is the
// fallback, so a record with no model still gets a dog.
const RiggedAvatar = lazy(() =>
  import('./components/RiggedAvatar').then((m) => ({ default: m.RiggedAvatar }))
);
const CommonsPanel = lazy(() =>
  import('./components/CommonsPanel').then((m) => ({ default: m.CommonsPanel }))
);
const CoachPanel = lazy(() =>
  import('./components/CoachPanel').then((m) => ({ default: m.CoachPanel }))
);
const RecordPanel = lazy(() =>
  import('./components/RecordPanel').then((m) => ({ default: m.RecordPanel }))
);

/** Coat starting points for a new dog; every colour can then be changed. */
const COAT_PRESETS: { label: string; coat: { pattern: CoatPattern; base: string; light: string; dark: string; point: string } }[] = [
  { label: 'Bangkaew', coat: { pattern: 'bangkaew', base: '#ece7de', light: '#f8f6f1', dark: '#211c18', point: '#9a6c43' } },
  { label: 'Solid', coat: { pattern: 'solid', base: '#d9a441', light: '#f5e6c8', dark: '#5a3a1a', point: '#d9a441' } },
  { label: 'Saddle', coat: { pattern: 'saddle', base: '#8a4a22', light: '#f0e2d0', dark: '#2b1a0e', point: '#8a4a22' } },
  { label: 'Mask', coat: { pattern: 'mask', base: '#c98a2e', light: '#f7efe2', dark: '#2a1a10', point: '#c98a2e' } },
  { label: 'Spotted', coat: { pattern: 'spotted', base: '#f2efe8', light: '#ffffff', dark: '#1d1a17', point: '#f2efe8' } },
];

type RegionKey = 'care' | 'coach' | 'record' | 'commons';

const REGIONS: { key: RegionKey; label: string }[] = [
  { key: 'care', label: 'Care' },
  { key: 'coach', label: 'Coach' },
  { key: 'record', label: 'Record' },
  { key: 'commons', label: 'Commons' },
];

/** How long a note stays on screen before it lets the content back. */
const NOTE_TTL_MS = 7000;

/**
 * TRUE when the frame is wide enough to be a dashboard.
 *
 * The width is read from `innerWidth` rather than a media query, because a
 * media query is a statement about the LAYOUT, and what this needs to know is
 * how much room the frame has been given. They usually agree; when they do
 * not, the frame is the truth.
 */
function useWide(): boolean {
  // The dashboard needs WIDTH and HEIGHT. Five regions side by side is a
  // dashboard; five regions in a 768px-tall window are five letterboxes,
  // each one scrolling to show what it was built to show. So the switch is
  // made on the space the frame was actually given, not on the width alone.
  const read = () =>
    typeof window === 'undefined'
      ? true
      : window.innerWidth >= 1024 && window.innerHeight >= 820;
  const [wide, setWide] = useState(read);
  useEffect(() => {
    const onResize = () => setWide(read());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return wide;
}

export const App: React.FC = () => {
  const [dogs, setDogs] = useState<DogProfile[]>(() => loadStoredDogs(DEFAULT_DOGS));
  const [activeDogId, setActiveDogId] = useState<string>(() => loadActiveDogId(DEFAULT_DOGS[0].id));
  const [activeRegion, setActiveRegion] = useState<RegionKey>('care');

  // The dog's inner life — trust, arousal, personality, associations, the
  // observation log and the ledger of behaviours being taught. One state per
  // dog, so Expo, Mali and Bangal never share a memory.
  const [petState, setPetState] = useState<PetState>(() => loadPetState(activeDogId));

  const isWide = useWide();

  // Interactive 3D triggers
  /** What the practice field asked the dog's body to do. */
  const [avatarPose, setAvatarPose] = useState<AvatarPose>('stand');
  const [interactionTrigger, setInteractionTrigger] = useState<AvatarInteractionTrigger>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (actionTimer.current) clearTimeout(actionTimer.current); }, []);
  const [pendingAction, setPendingAction] = useState<CareAction | null>(null);

  // The note — what the dog just did, said once, under the animal.
  const [note, setNote] = useState<{ text: string; id: number } | null>(null);
  const noteTimer = useRef<number | null>(null);

  const [isDogMenuOpen, setIsDogMenuOpen] = useState(false);
  const [isAddDogOpen, setIsAddDogOpen] = useState(false);

  const [newDogName, setNewDogName] = useState('');
  const [newDogBreed, setNewDogBreed] = useState('');
  const [newDogBirth, setNewDogBirth] = useState('2023-01-01');
  const [newDogSex, setNewDogSex] = useState<'male' | 'female'>('male');
  const [newDogCoat, setNewDogCoat] = useState(COAT_PRESETS[1].coat);

  const currentDog = dogs.find((d) => d.id === activeDogId) || dogs[0];
  // While a new dog is being enrolled, the stage shows the coat being chosen.
  const previewDog: DogProfile = {
    ...currentDog,
    id: 'preview',
    name: newDogName.trim() || 'New dog',
    breed: newDogBreed.trim() || 'Your dog',
    avatarConfig: {
      ...currentDog.avatarConfig,
      pattern: newDogCoat.pattern,
      baseColor: newDogCoat.base,
      secondaryColor: newDogCoat.light,
      maskColor: newDogCoat.dark,
      pointColor: newDogCoat.point,
      furFluff: 0.6,
      customModelUrl: undefined,
    },
  };
  const age = calculateDogAge(currentDog.birthDate, currentDog.weightKg);
  const subject = { name: currentDog.name, sex: currentDog.sex } as const;

  // Switch identity and state in one React batch, before the save effect runs.
  const selectDog = (id: string) => {
    if (actionTimer.current) clearTimeout(actionTimer.current);
    setActiveDogId(id);
    setPetState(loadPetState(id));
    setInteractionTrigger(null);
    setIsInteracting(false);
    setPendingAction(null);
    setAvatarPose('stand');
    setNote(null);
  };

  useEffect(() => {
    savePetState(activeDogId, petState);
  }, [petState, activeDogId]);

  useEffect(() => {
    saveDogs(dogs);
  }, [dogs]);

  useEffect(() => {
    saveActiveDogId(activeDogId);
  }, [activeDogId]);

  /**
   * THE DRIFT.
   *
   * One model governs the needs, and it is the model's own: the dog drifts
   * whether anyone is watching. The old build ran a second, simpler timer
   * that subtracted a point a minute from a different copy of the same
   * numbers, and the two fought. Now there is one decay, applied here and
   * again on load, so the figures on screen are the figures for right now.
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      setPetState((prev) => {
        const drifted = decay(prev);
        // HE GOES TO BED ON HIS OWN.
        //
        // A Tamagotchi does not wait to be put down: at night, or when he is
        // spent, he finds his bed. You can wake him — and pay for it — but
        // you cannot make him stay awake.
        if (willSettle(drifted)) {
          const settled = settleSleep(drifted);
          if (settled.note) say(settled.note);
          return { ...settled.state, call: undefined };
        }
        // HE CALLS YOU. A need runs low, or nobody has been near him for a
        // while, and he asks. Ignored, the call fades on its own.
        // The Care sentence and on-stage need own automatic calls. A second
        // bottom overlay would hide the floor precisely when a puddle appears.
        const { call } = tickCall(drifted);
        return { ...drifted, call };
      });
    }, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  /**
   * TIME TOGETHER — the currency.
   *
   * Counted in 15-second slices, and only while the page is in front of you
   * and you have touched it in the last half minute. Leaving the tab open
   * overnight earns nothing.
   */
  useEffect(() => {
    let lastActive = Date.now();
    const touch = () => (lastActive = Date.now());
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const SLICE = 15;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastActive > 30_000) return;
      setPetState((prev) => ({ ...prev, together: addTogether(prev.together, SLICE) }));
    }, SLICE * 1000);
    return () => {
      window.clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, touch));
    };
  }, []);

  // A call shows in the tab title too, so it reaches you in another tab.
  useEffect(() => {
    const base = 'Canine OS — dog.nonarkara.org';
    document.title = petState.call ? `● ${currentDog.name} is calling — ${base}` : base;
  }, [petState.call, currentDog.name]);

  /** Say a note once, and then let the content back. */
  const say = (text: string) => {
    setNote({ text, id: Date.now() });
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), NOTE_TTL_MS);
  };

  useEffect(() => () => {
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
  }, []);

  /**
   * THE VISIBLE MIRROR OF THE STATE.
   *
   * The dog's record carries the meters too, and the record is what gets
   * exported. So the record follows the model — it is a copy of the truth,
   * written when the truth changes, never a second opinion about it.
   */
  const syncDisplay = (state: PetState) => {
    setDogs((prev) =>
      prev.map((d) => {
        if (d.id !== activeDogId) return d;
        return {
          ...d,
          tamagotchi: {
            ...d.tamagotchi,
            hunger: state.needs.hunger,
            energy: state.needs.energy,
            hygiene: state.needs.hygiene,
            happiness: Math.round(happiness(state)),
          },
        };
      })
    );
  };

  const handleInteract = (action: CareAction) => {
    if (isInteracting) return;
    if (action === 'play' && petState.sick) {
      say(`${currentDog.name} needs rest. The catch game can wait until recovery.`);
      return;
    }
    setIsInteracting(true);
    setPendingAction(action);
    setInteractionTrigger(action);

    // The domain model: decay, trust, arousal, personality, and the
    // classical-conditioning pairing of the last spoken cue with this outcome.
    const result = interact(petState, action, Date.now(), subject);
    const answer = answerCall(petState, action);
    const next = answer.answered
      ? { ...result.state, call: undefined, trust: Math.min(100, result.state.trust + answer.trustBonus) }
      : result.state;
    setPetState(next);
    syncDisplay(next);
    say(answer.answered ? `${result.note} You came when ${subject.sex === 'female' ? 'she' : 'he'} called. Trust +${answer.trustBonus}.` : result.note);

    actionTimer.current = setTimeout(() => {
      setIsInteracting(false);
      setPendingAction(null);
      setInteractionTrigger(null);
    }, 2000);
  };

  const handleMiniGameComplete = (won: boolean, kind: 'catch'|'find-treat' = 'catch') => {
    if(kind==='find-treat'){
      if(petState.sick||petState.sleep?.asleep)return;
      const now=Date.now(),base=decay(petState,now);
      if(base.sick||base.sleep?.asleep){setPetState(base);syncDisplay(base);say(`${currentDog.name} needs rest. We can play again later.`);return;}
      const next:PetState={...base,needs:{...base.needs,energy:Math.max(0,base.needs.energy-4)},trust:Math.min(100,base.trust+(won?3:1)),arousal:Math.min(80,base.arousal+6),life:{...dailyLife(base),boredom:Math.max(0,dailyLife(base).boredom-50)},lastCareAt:now,call:['lonely','bored'].includes(base.call?.reason||'')?undefined:base.call,updatedAt:now};
      setPetState(next);syncDisplay(next);
      setDogs(prev=>prev.map(d=>d.id===activeDogId?{...d,tamagotchi:{...d.tamagotchi,lastPlayed:now}}:d));
      say(won?`${currentDog.name} found the treats. Clever nose! Trust +3.`:`A little sniffing practice together. Trust +1.`);
      return;
    }
    if (won) {
      setPetState((prev) => ({
        ...prev,
        arousal: Math.max(20, Math.min(80, prev.arousal + 15)),
        trust: Math.min(100, prev.trust + 5),
        weightKg: Math.max(15, (prev.weightKg ?? 24.8) - 0.1),
      }));
      say(`Agility catch victory! ${currentDog.name} caught the balls with joyful barks. Trust +5!`);
    } else {
      say(`Good effort! ${currentDog.name} burned energy and enjoyed the practice.`);
    }
  };

  const handleCommunicate = (cue: string) => {
    const result = communicate(petState, cue, Date.now(), subject);
    setPetState(result.state);
    syncDisplay(result.state);
    say(result.note);

    // A recognised cue triggers a visible reaction in the scene.
    if (result.note.includes('knows')) {
      setInteractionTrigger('communicate');
      setIsInteracting(true);
      actionTimer.current = setTimeout(() => {
        setIsInteracting(false);
        setInteractionTrigger(null);
      }, 2000);
    }
  };

  /**
   * PUT HIM TO BED.
   *
   * Sometimes he will not go down — he is too wound up, or he has been woken
   * too many times tonight. The control says so rather than failing quietly,
   * because "he will not settle" is something you can act on.
   */
  const handleBed = () => {
    const result = settleSleep(petState, Date.now(), subject);
    if (result.state !== petState) {
      setPetState(result.state);
      syncDisplay(result.state);
    }
    say(result.note);
  };

  const handleUpdateCurrentDog = (updated: DogProfile) => {
    setDogs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleAddPhotoToDog = (url: string, angle: 'front' | 'side' | 'closeup' | 'body') => {
    handleUpdateCurrentDog({
      ...currentDog,
      photos: [
        ...currentDog.photos,
        {
          id: `photo-${Date.now()}`,
          url,
          angle,
          dateTaken: new Date().toISOString().split('T')[0],
          notes: `User uploaded ${angle} view`,
        },
      ],
    });
    say('Photo stored on the record.');
  };

  const handleCreateNewDog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDogName.trim()) return;

    const newDog: DogProfile = {
      id: `dog-${Date.now()}`,
      name: newDogName.trim(),
      callName: newDogName.trim(),
      breed: newDogBreed.trim() || 'Mixed Breed',
      birthDate: newDogBirth || '2023-01-01',
      sex: newDogSex,
      isNeutered: true,
      microchipId: `TH-${Math.floor(10000000 + Math.random() * 90000000)}`,
      weightKg: 20,
      coatColor: `${COAT_PRESETS.find((c) => c.coat.pattern === newDogCoat.pattern)?.label ?? 'Custom'} coat`,
      distinctiveMarks: ['Healthy coat', 'Bright eyes'],
      personalityTraits: ['Playful', 'Alert'],
      favoriteFood: 'Fresh meats & kibble',
      favoriteToy: 'Chew rope',
      quirks: ['Loves outdoor walks'],
      primaryVetClinic: 'Thonglor Pet Hospital',
      emergencyPhone: '+66 2 712 6301',
      primaryPhotoUrl: currentDog.primaryPhotoUrl,
      photos: [],
      vaccinations: [],
      parasiteControl: [],
      medicalHistory: [],
      tamagotchi: {
        hunger: 80,
        happiness: 85,
        energy: 80,
        hygiene: 80,
        lastFed: Date.now(),
        lastPlayed: Date.now(),
        lastWalked: Date.now(),
        lastGroomed: Date.now(),
      },
      metaverseTribe: 'The Roaming Pack',
      metaverseBio: 'Ready to explore the canine commons.',
      avatarConfig: {
        pattern: newDogCoat.pattern,
        baseColor: newDogCoat.base,
        secondaryColor: newDogCoat.light,
        maskColor: newDogCoat.dark,
        pointColor: newDogCoat.point,
        furFluff: 0.6,
        earShape: 'pricked',
        tailShape: 'curl',
      },
    };

    setDogs((prev) => [...prev, newDog]);
    selectDog(newDog.id);
    setPetState(createPetState());
    setIsAddDogOpen(false);
    setNewDogName('');
    setNewDogBreed('');
    say(`${newDog.name.trim()} is enrolled.`);
  };

  const resetToFactoryDefaults = () => {
    if (window.confirm('Reset all dog profiles to the factory defaults?')) {
      setDogs(DEFAULT_DOGS);
      selectDog(DEFAULT_DOGS[0].id);
      setPetState(createPetState());
      say('Profiles reset to the factory defaults.');
    }
  };

  /**
   * THE REGIONS.
   *
   * On a wide screen every region is on screen, because that is what a
   * dashboard is. On a narrow screen the animal is on top and one region sits
   * below it — chosen from the strip, not by scrolling to it.
   */
  const renderRegion = (key: RegionKey) => {
    switch (key) {
      case 'care':
        return <CarePanel dog={currentDog} petState={petState} />;
      case 'coach':
        return (
          <Suspense fallback={<RegionLoading label="Coach" />}>
            <CoachPanel
              dog={currentDog}
              petState={petState}
              onPetStateChange={setPetState}
              onPose={setAvatarPose}
            />
          </Suspense>
        );
      case 'record':
        return (
          <Suspense fallback={<RegionLoading label="Record" />}>
            <RecordPanel
              dog={currentDog}
              onUpdateDog={handleUpdateCurrentDog}
              onAddPhoto={handleAddPhotoToDog}
            />
          </Suspense>
        );
      case 'commons':
        return (
          <Suspense fallback={<RegionLoading label="Commons" />}>
            <CommonsPanel myDog={currentDog} />
          </Suspense>
        );
    }
  };

  return (
    <div className="cockpit" style={dogTheme(currentDog.id)} data-dog-theme={currentDog.id} data-vw={typeof window === 'undefined' ? 0 : window.innerWidth}>
      {/* ---- one band of chrome -------------------------------------------- */}
      <header className="border-hairline-b bg-surface shrink-0 no-print">
        <div className="h-11 px-2 sm:px-3 flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline font-display text-[15px] text-white shrink-0">
            Dog days
          </span>

          {/* Which dog. The dog is the subject of the app, so the switcher sits
              near the front of the band, where the eye lands first.

              It is a DISCLOSURE, not a row of buttons: a row grows with the
              number of dogs, and the header is a fixed band. A row of chips
              that outgrows the band pushes the whole page sideways, and a
              sideways-scrolling page is the one failure no layout can excuse.
              The disclosure shows the dog you are with; the list is the set. */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsDogMenuOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={isDogMenuOpen}
              aria-controls="dog-switcher"
              className="btn-quiet min-h-10 px-2 text-[13px] whitespace-nowrap"
            >
              <Dog size={13} aria-hidden="true" />
              {currentDog.name}
              <ChevronDown size={13} aria-hidden="true" />
            </button>

            {isDogMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsDogMenuOpen(false)}
                  aria-hidden="true"
                />
                <ul
                  id="dog-switcher"
                  role="listbox"
                  aria-label="Dogs"
                  className="absolute left-0 top-full mt-1 z-20 min-w-[200px] border-hairline bg-elevated"
                >
                  {dogs.map((dog) => (
                    <li key={dog.id} role="none">
                      <button
                        role="option"
                        aria-selected={dog.id === activeDogId}
                        onClick={() => {
                          selectDog(dog.id);
                          setIsDogMenuOpen(false);
                        }}
                        className={`w-full min-h-10 px-3 text-left text-[13px] ${
                          dog.id === activeDogId ? 'text-accent' : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        {dog.name}
                        <span className="block text-[11px] text-faint">{dog.breed}</span>
                      </button>
                    </li>
                  ))}
                  <li role="none" className="border-hairline-t">
                    <button
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        setIsDogMenuOpen(false);
                        setIsAddDogOpen(true);
                      }}
                      className="w-full min-h-10 px-3 text-left text-[13px] text-zinc-300 hover:text-white"
                    >
                      <Plus size={13} className="inline mr-1 -mt-0.5" aria-hidden="true" />
                      Enroll another dog
                    </button>
                  </li>
                </ul>
              </>
            )}
          </div>

          {/* The facts about the dog you are with. */}
          <p className="min-w-0 flex-1 truncate text-[12px] text-zinc-400">
            <span className="text-zinc-300">{currentDog.breed}</span>
            <span className="text-zinc-600"> / </span>
            <span className="data">{age.formattedCalendarAge}</span>
            <span className="text-zinc-600"> / </span>
            <span className="data">{currentDog.birthDate ? `${age.dogYears} dog years` : 'Virtual companion'}</span>
          </p>

          <span title="Saved on this device" className="hidden lg:inline text-[11px] text-faint shrink-0">
            {DOG_THEMES[currentDog.id]?.name || 'Your companion'}
          </span>

          <button
            onClick={resetToFactoryDefaults}
            className="btn-quiet min-h-10 px-2 shrink-0"
            aria-label="Reset all dog profiles to the factory defaults"
            title="Reset profiles to defaults"
          >
            <RotateCcw size={13} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ---- the regions ----------------------------------------------------- */}
      <main
        className={`cockpit-workspace ${
          isWide ? 'cockpit-workspace--wide' : 'cockpit-workspace--tall'
        }`}
      >
        {/* The animal. The biggest region on the screen, and the one the
            reader came for. */}
        <section className="panel region-stage" aria-label={`${currentDog.name}, live avatar`}>
          {/* The page's heading. The dog's name is VISIBLE in the header band —
              but there it is a control, a disclosure you open to change dogs.
              A control is not a heading, so the document still needs one: this
              is the same name, said once, as the subject of the page. It is
              hidden because it is already on the screen; it is not hidden
              because it is unimportant. */}
          <h1 className="sr-only">
            {currentDog.name}, {currentDog.breed}
          </h1>
          <div className="panel-body">
            <div className="stage-frame" data-feedback={!!note}>
              <div className="stage-canvas">
              <Suspense fallback={<StageLoading name={currentDog.name} />}>
                {!isAddDogOpen && currentDog.avatarConfig.customModelUrl ? (
                  <RiggedAvatar
                    dog={currentDog}
                    petState={petState}
                    url={currentDog.avatarConfig.customModelUrl}
                    interactionTrigger={interactionTrigger}
                    onInteractionEnd={() => setInteractionTrigger(null)}
                  />
                ) : (
                  <IllustratedDog
                    key={currentDog.id}
                    dog={isAddDogOpen ? previewDog : currentDog}
                    petState={petState}
                    pose={avatarPose}
                    onPet={() => handleInteract('pet')}
                    onClean={() => handleInteract('clean')}
                    onCare={handleInteract}
                    onBed={handleBed}
                    onMiniGameComplete={handleMiniGameComplete}
                    interactionTrigger={interactionTrigger}
                    fallback={
                      <DogAvatar3D
                        key={currentDog.id}
                        dog={isAddDogOpen ? previewDog : currentDog}
                        petState={petState}
                        pose={avatarPose}
                        onPet={() => handleInteract('pet')}
                        onClean={() => handleInteract('clean')}
                        onMiniGameComplete={handleMiniGameComplete}
                        interactionTrigger={interactionTrigger}
                        onInteractionEnd={() => setInteractionTrigger(null)}
                      />
                    }
                    onInteractionEnd={() => setInteractionTrigger(null)}
                  />
                )}
              </Suspense>
            </div>

            {/* Feedback has its own row: never place text over the dog. */}
            <div className="stage-note-slot" data-open={!!note}>
            {note && (
              <div className="bar bar--note" role="status" key={note.id}>
                <p className="text-[12px] leading-snug text-zinc-100 flex-1 min-w-0 truncate" title={note.text}>
                  {note.text}
                </p>
                <button
                  onClick={() => setNote(null)}
                  className="btn-quiet px-1.5 shrink-0"
                  aria-label="Dismiss"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            )}
            </div>
            </div>
          </div>
        </section>

        {isWide ? (
          <>
            {renderRegion('care')}
            {renderRegion('coach')}
            {renderRegion('commons')}
            {renderRegion('record')}
          </>
        ) : (
          <>
            {/* Which region, on a screen that can only show one. */}
            <div role="tablist" aria-label="Regions" className="flex border-hairline bg-surface">
              {REGIONS.map((r) => {
                const active = r.key === activeRegion;
                return (
                  <button
                    key={r.key}
                    role="tab"
                    type="button"
                    aria-label={r.label}
                    title={r.label}
                    aria-selected={active}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setActiveRegion(r.key)}
                    className={`flex-1 min-h-9 px-1 text-[11px] border-hairline-r last:border-hairline-r-0 ${
                      active ? 'bg-zinc-900 text-accent font-semibold' : 'text-zinc-400'
                    }`}
                  >
                    {React.createElement(({care:Heart,coach:GraduationCap,record:BookOpen,commons:Trees})[r.key],{size:20,'aria-hidden':true})}
                    <span className="sr-only">{r.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="region-frame">{renderRegion(activeRegion)}</div>
          </>
        )}

        {/* ---- enroll a dog, as a bar ---------------------------------------
            It lives INSIDE the workspace, so it sits on top of the content
            and directly above the command bar — never over the controls, and
            never over the whole screen. */}
        {isAddDogOpen && (
          <form
            onSubmit={handleCreateNewDog}
            className="bar bar--stack max-w-2xl"
            role="dialog"
            aria-label="Enroll a new dog"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="label shrink-0">Enroll a dog</span>
              <input
                type="text"
                value={newDogName}
                onChange={(e) => setNewDogName(e.target.value)}
                placeholder="Name"
                aria-label="Dog name"
                className="flex-1 min-w-0 px-2 py-1 text-xs"
                required
                autoFocus
              />
              <input
                type="text"
                value={newDogBreed}
                onChange={(e) => setNewDogBreed(e.target.value)}
                placeholder="Breed"
                aria-label="Breed"
                className="flex-1 min-w-0 px-2 py-1 text-xs"
                required
              />
              <input
                type="date"
                value={newDogBirth}
                onChange={(e) => setNewDogBirth(e.target.value)}
                aria-label="Birth date"
                className="px-2 py-1 text-xs shrink-0"
                required
              />
              <select
                value={newDogSex}
                onChange={(e) => setNewDogSex(e.target.value as 'male' | 'female')}
                aria-label="Sex"
                className="px-2 py-1 text-xs shrink-0"
              >
                <option value="male">He</option>
                <option value="female">She</option>
              </select>
            </div>
            {/* The coat, previewed on the stage as you choose it. */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="label shrink-0">Coat</span>
              {COAT_PRESETS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setNewDogCoat(c.coat)}
                  aria-pressed={newDogCoat.pattern === c.coat.pattern}
                  className={`btn min-h-0 h-[24px] px-2 py-0 text-[10px] ${
                    newDogCoat.pattern === c.coat.pattern ? 'btn-accent' : 'btn-quiet border-hairline'
                  }`}
                >
                  {c.label}
                </button>
              ))}
              {(['base', 'light', 'dark', 'point'] as const).map((k) => (
                <label key={k} className="flex items-center gap-1 text-[10px] text-zinc-400">
                  {k === 'base' ? 'Main' : k === 'light' ? 'Light' : k === 'dark' ? 'Dark' : 'Tan'}
                  <input
                    type="color"
                    value={newDogCoat[k]}
                    onChange={(e) => setNewDogCoat({ ...newDogCoat, [k]: e.target.value })}
                    className="h-[24px] w-[28px] p-0 border-hairline bg-transparent"
                  />
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddDogOpen(false)}
                className="btn btn-quiet text-[11px]"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-accent text-[11px]">
                Create profile
              </button>
            </div>
          </form>
        )}
      </main>

      {/* ---- the controls ---------------------------------------------------- */}
      <CommandBar
        dog={currentDog}
        petState={petState}
        isInteracting={isInteracting}
        pendingAction={pendingAction}
        onInteract={handleInteract}
        onCommunicate={handleCommunicate}
        onBed={handleBed}
      />
    </div>
  );
};

/** A region that has not arrived yet. A quiet plate, not a hole. */
const RegionLoading: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex-1 min-h-0 flex items-center justify-center bg-zinc-950">
    <span className="label">{label} — loading</span>
  </div>
);

/** The scene has not arrived yet. */
const StageLoading: React.FC<{ name: string }> = ({ name }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-black">
    <span className="label">{name} — loading</span>
  </div>
);
