import React, { useState, useEffect } from 'react';
import { DogProfile } from './types/dog';
import { DEFAULT_DOGS } from './data/defaultDogs';
import { loadStoredDogs, saveDogs, loadActiveDogId, saveActiveDogId } from './utils/dogCalculators';
import { DogAvatar3D } from './components/DogAvatar3D';
import { TamagotchiControls } from './components/TamagotchiControls';
import { DogPassportView } from './components/DogPassportView';
import { MetaversePark3D } from './components/MetaversePark3D';
import { ClinicalArchiveView } from './components/ClinicalArchiveView';
import { ReconstructionPipelineModal } from './components/ReconstructionPipelineModal';
import { sound } from './utils/proceduralAudio';
import { Dog, Globe, Sparkles, Plus, FileSpreadsheet, Shield } from 'lucide-react';

export const App: React.FC = () => {
  const [dogs, setDogs] = useState<DogProfile[]>(() => loadStoredDogs(DEFAULT_DOGS));
  const [activeDogId, setActiveDogId] = useState<string>(() => loadActiveDogId(DEFAULT_DOGS[0].id));
  const [activeMode, setActiveMode] = useState<'command' | 'metaverse' | 'clinical'>('command');

  // Interactive 3D triggers
  const [interactionTrigger, setInteractionTrigger] = useState<'pet' | 'feed' | 'play' | 'groom' | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  // Modals
  const [isReconstructionOpen, setIsReconstructionOpen] = useState(false);
  const [isAddDogOpen, setIsAddDogOpen] = useState(false);

  // New dog form
  const [newDogName, setNewDogName] = useState('');
  const [newDogBreed, setNewDogBreed] = useState('');
  const [newDogBirth, setNewDogBirth] = useState('2023-01-01');

  const currentDog = dogs.find((d) => d.id === activeDogId) || dogs[0];

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

    setDogs((prev) =>
      prev.map((d) => {
        if (d.id !== activeDogId) return d;
        const cur = d.tamagotchi;
        let deltaHunger = 0;
        let deltaHappy = 0;
        let deltaEnergy = 0;
        let deltaHygiene = 0;

        if (action === 'pet') {
          deltaHappy = 12;
        } else if (action === 'feed') {
          deltaHunger = 25;
          deltaHappy = 8;
        } else if (action === 'play') {
          deltaHappy = 25;
          deltaEnergy = -12;
          deltaHunger = -5;
        } else if (action === 'walk') {
          deltaHappy = 30;
          deltaEnergy = -20;
          deltaHunger = -10;
        } else if (action === 'groom') {
          deltaHygiene = 35;
          deltaHappy = 10;
        }

        return {
          ...d,
          tamagotchi: {
            ...cur,
            hunger: Math.min(100, Math.max(0, cur.hunger + deltaHunger)),
            happiness: Math.min(100, Math.max(0, cur.happiness + deltaHappy)),
            energy: Math.min(100, Math.max(0, cur.energy + deltaEnergy)),
            hygiene: Math.min(100, Math.max(0, cur.hygiene + deltaHygiene)),
            lastFed: action === 'feed' ? Date.now() : cur.lastFed,
            lastPlayed: action === 'play' ? Date.now() : cur.lastPlayed,
            lastWalked: action === 'walk' ? Date.now() : cur.lastWalked,
            lastGroomed: action === 'groom' ? Date.now() : cur.lastGroomed,
          },
        };
      })
    );

    setTimeout(() => {
      setIsInteracting(false);
      setInteractionTrigger(null);
    }, 2000);
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
    if (window.confirm('Reset dogs data to original Expo profile defaults?')) {
      setDogs(DEFAULT_DOGS);
      setActiveDogId(DEFAULT_DOGS[0].id);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-body selection:bg-amber-500 selection:text-black">
      {/* Top Application Bar (Dieter Rams Planar Grid) */}
      <header className="border-hairline-b bg-zinc-950 px-3 py-2 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5">
          {/* Logo & Protocol Title */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
              <h1 className="font-display text-sm tracking-widest font-bold text-white">
                CANINE // DOG.NONARKARA.ORG
              </h1>
            </div>
            <span className="font-mono text-[9px] text-zinc-500 border-hairline px-1.5 py-0.5">
              MVP V1.2 · 1440×900
            </span>
          </div>

          {/* Dog Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 md:pb-0">
            {dogs.map((dog) => (
              <button
                key={dog.id}
                onClick={() => setActiveDogId(dog.id)}
                className={`text-[10px] py-1 px-2.5 font-mono flex items-center gap-1.5 ${
                  dog.id === activeDogId
                    ? 'btn-accent'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Dog size={11} /> {dog.name.toUpperCase()}
              </button>
            ))}

            <button
              onClick={() => setIsAddDogOpen(true)}
              className="btn text-[10px] py-1 px-2 text-zinc-400 hover:text-amber-400"
              title="Add another dog"
            >
              <Plus size={11} /> ADD DOG
            </button>
          </div>

          {/* 3-Way Mode Switcher: Command vs Commons vs Clinical */}
          <div className="flex border-hairline bg-black p-0.5 font-mono text-[10px]">
            <button
              onClick={() => setActiveMode('command')}
              className={`py-1 px-2.5 ${
                activeMode === 'command'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              01. COMMAND
            </button>
            <button
              onClick={() => setActiveMode('metaverse')}
              className={`py-1 px-2.5 flex items-center gap-1 ${
                activeMode === 'metaverse'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Globe size={11} /> 02. COMMONS
            </button>
            <button
              onClick={() => setActiveMode('clinical')}
              className={`py-1 px-2.5 flex items-center gap-1 ${
                activeMode === 'clinical'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet size={11} /> 03. CLINICAL
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-4 space-y-4">
        {/* VIEW 01: THE COMMAND DECK (Option 1) */}
        {activeMode === 'command' && (
          <div className="space-y-4">
            {/* Top Deck: 3D Avatar Canvas + Tamagotchi Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Left 7 Cols: 3D Interactive WebGL Avatar */}
              <div className="lg:col-span-7 h-[360px] lg:h-[400px]">
                <DogAvatar3D
                  dog={currentDog}
                  interactionTrigger={interactionTrigger}
                  onInteractionEnd={() => setInteractionTrigger(null)}
                />
              </div>

              {/* Right 5 Cols: Tamagotchi Care Deck & Photogrammetry Hook */}
              <div className="lg:col-span-5 flex flex-col justify-between">
                <TamagotchiControls
                  dog={currentDog}
                  onInteract={handleInteract}
                  isInteracting={isInteracting}
                />

                {/* 3D Photogrammetry Callout Card */}
                <div className="border-hairline bg-zinc-950 p-3 mt-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest block font-semibold">
                      OPEN-SOURCE 3D PIPELINE
                    </span>
                    <h4 className="font-display text-xs text-white">
                      PHOTO-TO-3D AVATAR ENGINE
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      Stitch {currentDog.photos.length} photos into 3D mesh via TripoSR / InstantMesh.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsReconstructionOpen(true)}
                    className="btn btn-accent text-[10px] py-1.5 px-3 shrink-0"
                  >
                    <Sparkles size={11} /> PIPELINE
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom: Comprehensive Dog Passport & Health Ledger */}
            <DogPassportView
              dog={currentDog}
              onUpdateDog={handleUpdateCurrentDog}
              onOpenReconstruction={() => setIsReconstructionOpen(true)}
            />
          </div>
        )}

        {/* VIEW 02: THE SPATIAL COMMONS (Option 2 - Metaverse Park) */}
        {activeMode === 'metaverse' && (
          <div className="space-y-3">
            <div className="border-hairline bg-zinc-950 p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest block">
                  GOAL 2 // THE METAVERSE OF DOGS
                </span>
                <h3 className="font-display text-lg text-white">
                  CANINE COMMONS · TRIBAL METAVERSE PARK
                </h3>
                <p className="text-xs text-zinc-400">
                  {currentDog.name} has entered the park representing the{' '}
                  <span className="text-amber-400 font-semibold">{currentDog.metaverseTribe}</span>.
                </p>
              </div>

              <button
                onClick={() => setActiveMode('command')}
                className="btn text-xs py-1 px-3"
              >
                RETURN TO COMMAND DECK
              </button>
            </div>

            <MetaversePark3D myDog={currentDog} />
          </div>
        )}

        {/* VIEW 03: CLINICAL ARCHIVE (Option 3 - Tri-Column Studio) */}
        {activeMode === 'clinical' && (
          <ClinicalArchiveView
            dog={currentDog}
            onOpenReconstruction={() => setIsReconstructionOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-hairline-t bg-zinc-950 px-3 py-3 mt-8 text-zinc-500 font-mono text-[10px]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>CANINE OS // SHIPPED TO DOG.NONARKARA.ORG</span> ·{' '}
            <span className="text-zinc-400">EXPO (THAI BANGKAEW · 5Y)</span>
          </div>
          <div className="flex items-center gap-3">
            <span>LOCAL-FIRST PERSISTENCE</span>
            <span>·</span>
            <button
              onClick={resetToFactoryDefaults}
              className="text-zinc-500 hover:text-amber-500 underline"
            >
              RESET TO DEFAULTS
            </button>
          </div>
        </div>
      </footer>

      {/* 3D Reconstruction Pipeline Modal */}
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

      {/* Add New Dog Modal */}
      {isAddDogOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3">
          <div className="bg-zinc-950 border border-amber-500/80 w-full max-w-md p-4 text-zinc-100 space-y-3">
            <div className="flex justify-between items-center border-hairline-b pb-2">
              <h4 className="font-display text-base text-white">ENROLL NEW DOG TO SYSTEM</h4>
              <button onClick={() => setIsAddDogOpen(false)} className="text-zinc-500 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewDog} className="space-y-3 text-xs">
              <div>
                <label className="font-mono text-[10px] text-zinc-400 block mb-1">DOG NAME</label>
                <input
                  type="text"
                  value={newDogName}
                  onChange={(e) => setNewDogName(e.target.value)}
                  placeholder="e.g. Luna"
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label className="font-mono text-[10px] text-zinc-400 block mb-1">BREED</label>
                <input
                  type="text"
                  value={newDogBreed}
                  onChange={(e) => setNewDogBreed(e.target.value)}
                  placeholder="e.g. Thai Ridgeback, French Bulldog, Beagle"
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label className="font-mono text-[10px] text-zinc-400 block mb-1">BIRTH DATE</label>
                <input
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
                  className="btn text-xs py-1 px-3"
                >
                  CANCEL
                </button>
                <button type="submit" className="btn btn-accent text-xs py-1 px-3">
                  CREATE PROFILE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
