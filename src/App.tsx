import React, { useState, useEffect, lazy, Suspense } from 'react';
import { DogProfile } from './types/dog';
import type { PetState } from './domain/types';
import { DEFAULT_DOGS } from './data/defaultDogs';
import { loadStoredDogs, saveDogs, loadActiveDogId, saveActiveDogId, calculateDogAge, loadPetState, savePetState } from './utils/dogCalculators';
import { TamagotchiControls } from './components/TamagotchiControls';
import { DogPassportView } from './components/DogPassportView';
import { ClinicalArchiveView } from './components/ClinicalArchiveView';
import { ReconstructionPipelineModal } from './components/ReconstructionPipelineModal';
import { TrainingView } from './components/TrainingView';
import { sound } from './utils/proceduralAudio';
import { Dog, Globe, Plus, FileSpreadsheet, Shield, X, ChevronDown, Target } from 'lucide-react';
import { createPetState, interact, communicate, associationStrength } from './domain/pet';

/**
 * THE TWO 3D SCENES ARE LOADED ON DEMAND.
 *
 * three.js is 600 kB of the bundle, and it is used for two things only: the
 * avatar in the command deck, and the park in the commons. Loading it with
 * the interface means the reader waits for a library they may never use
 * before the page says anything. Loading it when the scene is asked for means
 * the record, the passport and the care panel are on screen first.
 *
 * The stage is sized by its own aspect ratio, not by the scene inside it, so
 * the box a reader sees does not change when the scene arrives.
 */
const DogAvatar3D = lazy(() =>
  import('./components/DogAvatar3D').then((m) => ({ default: m.DogAvatar3D }))
);
const MetaversePark3D = lazy(() =>
  import('./components/MetaversePark3D').then((m) => ({ default: m.MetaversePark3D }))
);

/**
 * THE HEADER IS ONE BAND.
 *
 * It used to be three stacked rows — identity, dog switcher, mode switcher —
 * each on its own line, which made the chrome taller than the work above the
 * fold and turned the top of every page into a directory of the app. One row:
 * what this is, which dog, which view. Everything else is content.
 *
 * The one loud control in the header is the active VIEW. The active dog is
 * marked by an accent rule and colour, not by a second amber chip: two amber
 * chips at opposite ends of a row are two controls shouting across an empty
 * space, and that is exactly the failure the spatial law names.
 */

type Mode = 'command' | 'metaverse' | 'clinical' | 'training';

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: 'command', label: 'Command', icon: <Shield size={13} aria-hidden="true" /> },
  { id: 'metaverse', label: 'Commons', icon: <Globe size={13} aria-hidden="true" /> },
  { id: 'clinical', label: 'Clinical', icon: <FileSpreadsheet size={13} aria-hidden="true" /> },
  { id: 'training', label: 'Train', icon: <Target size={13} aria-hidden="true" /> },
];

export const App: React.FC = () => {
  const [dogs, setDogs] = useState<DogProfile[]>(() => loadStoredDogs(DEFAULT_DOGS));
  const [activeDogId, setActiveDogId] = useState<string>(() => loadActiveDogId(DEFAULT_DOGS[0].id));
  const [activeMode, setActiveMode] = useState<Mode>('command');

  // The dog's inner life — trust, arousal, personality, associations, and the
  // ledger of behaviours being taught. One state per dog, so Expo, Mali and
  // Bangal never share a memory. Loaded when you switch dogs, saved when it
  // changes.
  const [petState, setPetState] = useState<PetState>(() => loadPetState(activeDogId));

  useEffect(() => {
    setPetState(loadPetState(activeDogId));
  }, [activeDogId]);

  useEffect(() => {
    savePetState(activeDogId, petState);
  }, [petState, activeDogId]);

  // Interactive 3D triggers
  const [interactionTrigger, setInteractionTrigger] = useState<'pet' | 'feed' | 'play' | 'groom' | 'communicate' | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  // The last thing Expo "said" back — the reaction note from communicate.
  const [communicationNote, setCommunicationNote] = useState('');

  // Modals
  const [isReconstructionOpen, setIsReconstructionOpen] = useState(false);
  const [isAddDogOpen, setIsAddDogOpen] = useState(false);
  const [isDogMenuOpen, setIsDogMenuOpen] = useState(false);

  // New dog form
  const [newDogName, setNewDogName] = useState('');
  const [newDogBreed, setNewDogBreed] = useState('');
  const [newDogBirth, setNewDogBirth] = useState('2023-01-01');

  const currentDog = dogs.find((d) => d.id === activeDogId) || dogs[0];
  const age = calculateDogAge(currentDog.birthDate, currentDog.weightKg);

  useEffect(() => {
    saveDogs(dogs);
  }, [dogs]);

  useEffect(() => {
    saveActiveDogId(activeDogId);
  }, [activeDogId]);

  // Periodic stat decay for Tamagotchi realism
  useEffect(() => {
    const interval = setInterval(() => {
      setDogs((prev) =>
        prev.map((d) => {
          if (d.id !== activeDogId) return d;
          return {
            ...d,
            tamagotchi: {
              ...d.tamagotchi,
              hunger: Math.max(0, d.tamagotchi.hunger - 1),
              energy: Math.max(0, d.tamagotchi.energy - 1),
              hygiene: Math.max(0, d.tamagotchi.hygiene - 1),
            },
          };
        })
      );
    }, 60000);
    return () => clearInterval(interval);
  }, [activeDogId]);

  const handleInteract = (action: 'pet' | 'feed' | 'play' | 'groom' | 'walk') => {
    setIsInteracting(true);

    if (action === 'pet' || action === 'feed' || action === 'play' || action === 'groom') {
      setInteractionTrigger(action);
    } else if (action === 'walk') {
      sound.happyYip();
    }

    // Run the domain model: needs decay, trust, arousal, personality, and the
    // classical-conditioning pairing of the last spoken cue with this outcome.
    const result = interact(petState, action);
    setPetState(result.state);

    // Sync the visible tamagotchi bars from the domain state, keeping the
    // happiness delta that isn't part of the domain model yet.
    let deltaHappy = 0;
    if (action === 'pet') deltaHappy = 12;
    else if (action === 'feed') deltaHappy = 8;
    else if (action === 'play') deltaHappy = 25;
    else if (action === 'groom') deltaHappy = 10;
    else if (action === 'walk') deltaHappy = 30;

    setDogs((prev) =>
      prev.map((d) => {
        if (d.id !== activeDogId) return d;
        return {
          ...d,
          tamagotchi: {
            ...d.tamagotchi,
            hunger: result.state.needs.hunger,
            energy: result.state.needs.energy,
            hygiene: result.state.needs.hygiene,
            happiness: Math.min(100, Math.max(0, d.tamagotchi.happiness + deltaHappy)),
            lastFed: action === 'feed' ? Date.now() : d.tamagotchi.lastFed,
            lastPlayed: action === 'play' ? Date.now() : d.tamagotchi.lastPlayed,
            lastWalked: action === 'walk' ? Date.now() : d.tamagotchi.lastWalked,
            lastGroomed: action === 'groom' ? Date.now() : d.tamagotchi.lastGroomed,
          },
        };
      })
    );

    setTimeout(() => {
      setIsInteracting(false);
      setInteractionTrigger(null);
    }, 2000);
  };

  const handleCommunicate = (cue: string) => {
    const result = communicate(petState, cue);
    setPetState(result.state);
    setCommunicationNote(result.note);

    // A recognised cue triggers a visible happy reaction in the 3D scene.
    if (result.note.includes('knows')) {
      setInteractionTrigger('communicate');
      setIsInteracting(true);
      setTimeout(() => {
        setIsInteracting(false);
        setInteractionTrigger(null);
      }, 2000);
    }
  };

  const handleUpdateCurrentDog = (updated: DogProfile) => {
    setDogs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleAddPhotoToDog = (url: string, angle: 'front' | 'side' | 'closeup' | 'body') => {
    const newPhoto = {
      id: `photo-${Date.now()}`,
      url,
      angle,
      dateTaken: new Date().toISOString().split('T')[0],
      notes: `User uploaded ${angle} view`,
    };
    handleUpdateCurrentDog({
      ...currentDog,
      photos: [...currentDog.photos, newPhoto],
    });
  };

  const handleCreateNewDog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDogName.trim()) return;

    const newDog: DogProfile = {
      id: `dog-${Date.now()}`,
      name: newDogName,
      callName: newDogName,
      breed: newDogBreed || 'Mixed Breed',
      birthDate: newDogBirth || '2023-01-01',
      sex: 'male',
      isNeutered: true,
      microchipId: `TH-${Math.floor(10000000 + Math.random() * 90000000)}`,
      weightKg: 20,
      coatColor: 'Custom Coat',
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
        baseColor: '#854d0e',
        secondaryColor: '#fef3c7',
        maskColor: '#451a03',
        furFluff: 0.5,
        earShape: 'floppy',
        tailShape: 'curl',
      },
    };

    setDogs((prev) => [...prev, newDog]);
    setActiveDogId(newDog.id);
    setIsAddDogOpen(false);
    setNewDogName('');
    setNewDogBreed('');
  };

  const resetToFactoryDefaults = () => {
    if (window.confirm(`Reset all dog profiles to the factory defaults?`)) {
      setDogs(DEFAULT_DOGS);
      setActiveDogId(DEFAULT_DOGS[0].id);
    }
  };

  return (
    <div className="min-h-screen bg-ground text-zinc-100 flex flex-col font-body">
      {/* ---- one band of chrome -------------------------------------------- */}
      <header className="border-hairline-b bg-surface sticky top-0 z-40 no-print">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline font-display text-[15px] text-white shrink-0">
            Canine OS
          </span>

          {/* Which dog. The dog is the subject of the app, so the switcher sits
              in the middle of the band, where the eye lands first.

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
              className="btn-quiet min-h-11 px-2 text-[13px] whitespace-nowrap"
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
                  className="absolute left-0 top-full mt-1 z-20 min-w-[200px] border-hairline bg-elevated shadow-none"
                >
                  {dogs.map((dog) => (
                    <li key={dog.id} role="none">
                      <button
                        role="option"
                        aria-selected={dog.id === activeDogId}
                        onClick={() => {
                          setActiveDogId(dog.id);
                          setIsDogMenuOpen(false);
                        }}
                        className={`w-full min-h-11 px-3 text-left text-[13px] ${
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
                      className="w-full min-h-11 px-3 text-left text-[13px] text-zinc-300 hover:text-white"
                    >
                      <Plus size={13} className="inline mr-1 -mt-0.5" aria-hidden="true" />
                      Enroll another dog
                    </button>
                  </li>
                </ul>
              </>
            )}
          </div>

          {/* Which view. The ONE loud control in the header. */}
          <nav aria-label="Views" className="ml-auto shrink-0">
            <ul className="flex items-center">
              {MODES.map((mode) => {
                const isActive = mode.id === activeMode;
                return (
                  <li key={mode.id}>
                    <button
                      onClick={() => {
                        setActiveMode(mode.id);
                        setIsDogMenuOpen(false);
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={`min-h-11 px-2.5 text-[12px] ${
                        isActive ? 'btn-accent' : 'btn-quiet'
                      }`}
                    >
                      <span className="hidden sm:inline">{mode.icon}</span>
                      {mode.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4">
        {/* ---- the subject ------------------------------------------------- */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
          <h1 className="font-display text-3xl text-white">{currentDog.name}</h1>
          <p className="text-[13px] text-zinc-400">
            {currentDog.breed}
            <span className="text-zinc-600"> / </span>
            <span className="data text-zinc-300">{age.formattedCalendarAge}</span>
          </p>
        </div>

        {activeMode === 'command' && (
          <div className="space-y-4">
            {/* The deck. The stage and the care panel sit side by side; the
                stage's height comes from its own aspect ratio, and the care
                panel's from its content, so neither column is padded out to
                meet the other. */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* The stage. Its height comes from its own aspect ratio, because
                  the camera's field of view is vertical: a wider stage at the
                  same height would frame the dog smaller, and a narrower one
                  would crop it. The box is therefore the same shape the scene
                  is composed for, and it does not move when the scene
                  arrives. */}
              <div className="lg:col-span-7 aspect-[4/3] lg:aspect-[16/10] bg-black border-hairline overflow-hidden">
                <Suspense fallback={null}>
                  <DogAvatar3D
                    dog={currentDog}
                    petState={petState}
                    interactionTrigger={interactionTrigger}
                    onInteractionEnd={() => setInteractionTrigger(null)}
                  />
                </Suspense>
              </div>

              <div className="lg:col-span-5 flex flex-col gap-4">
                <TamagotchiControls
                  dog={currentDog}
                  petState={petState}
                  onInteract={handleInteract}
                  onCommunicate={handleCommunicate}
                  communicationNote={communicationNote}
                  isInteracting={isInteracting}
                />

                {/* The photogrammetry callout is a caption on the pipeline, not
                    a card of its own. */}
                <div className="border-hairline bg-surface p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-[13px] text-white">Photo to 3D avatar</h2>
                    <p className="text-[12px] text-zinc-400">
                      Stitch {currentDog.photos.length}{' '}
                      {currentDog.photos.length === 1 ? 'photo' : 'photos'} into a mesh via TripoSR or
                      InstantMesh.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsReconstructionOpen(true)}
                    className="btn btn-accent shrink-0"
                  >
                    Pipeline
                  </button>
                </div>
              </div>
            </div>

            <DogPassportView
              dog={currentDog}
              onUpdateDog={handleUpdateCurrentDog}
              onOpenReconstruction={() => setIsReconstructionOpen(true)}
            />
          </div>
        )}

        {activeMode === 'metaverse' && (
          <Suspense fallback={null}>
            <MetaversePark3D myDog={currentDog} />
          </Suspense>
        )}

        {activeMode === 'clinical' && (
          <ClinicalArchiveView
            dog={currentDog}
            onOpenReconstruction={() => setIsReconstructionOpen(true)}
          />
        )}

        {activeMode === 'training' && (
          <TrainingView
            dog={currentDog}
            petState={petState}
            onPetStateChange={setPetState}
            onInteract={handleInteract}
          />
        )}
      </main>

      <footer className="border-hairline-t bg-surface px-3 sm:px-4 py-3 mt-8 no-print">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-[12px] text-faint">
            Canine OS is local-first. Every profile, note and measurement stays on this device.
          </p>
          <button onClick={resetToFactoryDefaults} className="btn-quiet text-[12px]">
            Reset profiles to defaults
          </button>
        </div>
      </footer>

      <ReconstructionPipelineModal
        dog={currentDog}
        isOpen={isReconstructionOpen}
        onClose={() => setIsReconstructionOpen(false)}
        onAddPhoto={handleAddPhotoToDog}
        onLoadCustomModel={(url) => {
          handleUpdateCurrentDog({
            ...currentDog,
            avatarConfig: {
              ...currentDog.avatarConfig,
              customModelUrl: url,
            },
          });
        }}
      />

      {/* ---- enroll a dog --------------------------------------------------- */}
      {isAddDogOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 no-print">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="enroll-title"
            className="bg-surface border-hairline w-full max-w-md p-4 text-zinc-100"
          >
            <div className="flex justify-between items-center border-hairline-b pb-2 mb-3">
              <h2 id="enroll-title" className="font-display text-base text-white">
                Enroll a new dog
              </h2>
              <button
                onClick={() => setIsAddDogOpen(false)}
                className="btn-quiet w-9 h-9 min-h-0"
                aria-label="Close"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateNewDog} className="space-y-3">
              <div>
                <label className="label block mb-1" htmlFor="new-dog-name">
                  Dog name
                </label>
                <input
                  id="new-dog-name"
                  type="text"
                  value={newDogName}
                  onChange={(e) => setNewDogName(e.target.value)}
                  placeholder="Luna"
                  className="w-full"
                  required
                />
              </div>
              <div>
                <label className="label block mb-1" htmlFor="new-dog-breed">
                  Breed
                </label>
                <input
                  id="new-dog-breed"
                  type="text"
                  value={newDogBreed}
                  onChange={(e) => setNewDogBreed(e.target.value)}
                  placeholder="Thai Ridgeback"
                  className="w-full"
                  required
                />
              </div>
              <div>
                <label className="label block mb-1" htmlFor="new-dog-birth">
                  Birth date
                </label>
                <input
                  id="new-dog-birth"
                  type="date"
                  value={newDogBirth}
                  onChange={(e) => setNewDogBirth(e.target.value)}
                  className="w-full"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-hairline-t">
                <button
                  type="button"
                  onClick={() => setIsAddDogOpen(false)}
                  className="btn"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-accent">
                  Create profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
