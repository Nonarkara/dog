import React from 'react';
import { DogProfile, TamagotchiStats } from '../types/dog';
import { Utensils, Heart, Zap, Sparkles, Footprints, HandMetal } from 'lucide-react';

interface TamagotchiControlsProps {
  dog: DogProfile;
  onInteract: (action: 'pet' | 'feed' | 'play' | 'groom' | 'walk') => void;
  isInteracting: boolean;
}

export const TamagotchiControls: React.FC<TamagotchiControlsProps> = ({
  dog,
  onInteract,
  isInteracting,
}) => {
  const stats = dog.tamagotchi;

  // Progress Bar Helper
  const renderStatBar = (label: string, value: number, icon: React.ReactNode, alertThreshold = 30) => {
    const isLow = value < alertThreshold;
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className="text-zinc-400 flex items-center gap-1.5">
            {icon} {label}
          </span>
          <span className={`font-semibold ${isLow ? 'text-rose-400' : 'text-amber-400'}`}>
            {value}%
          </span>
        </div>
        <div className="w-full h-2 bg-black border-hairline overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isLow ? 'bg-rose-500' : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="border-hairline bg-zinc-950 p-3 space-y-3">
      <div className="flex items-center justify-between border-hairline-b pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span className="font-mono text-xs text-zinc-300 uppercase tracking-wider font-semibold">
            TAMAGOTCHI PET CARE DECK
          </span>
        </div>
        <span className="font-mono text-[9px] text-zinc-500">
          REAL-TIME BIOMETRICS
        </span>
      </div>

      {/* 4 Core Stat Bars */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-black/60 p-2.5 border-hairline">
        {renderStatBar('HUNGER', stats.hunger, <Utensils size={11} className="text-amber-500" />)}
        {renderStatBar('HAPPINESS', stats.happiness, <Heart size={11} className="text-amber-500" />)}
        {renderStatBar('ENERGY', stats.energy, <Zap size={11} className="text-amber-500" />)}
        {renderStatBar('HYGIENE', stats.hygiene, <Sparkles size={11} className="text-amber-500" />)}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
        <button
          onClick={() => onInteract('pet')}
          disabled={isInteracting}
          className="btn btn-accent text-[10px] py-2"
        >
          <HandMetal size={12} /> PET EXPO
        </button>

        <button
          onClick={() => onInteract('feed')}
          disabled={isInteracting}
          className="btn text-[10px] py-2"
        >
          <Utensils size={12} /> FEED BONE
        </button>

        <button
          onClick={() => onInteract('play')}
          disabled={isInteracting}
          className="btn text-[10px] py-2"
        >
          <Heart size={12} /> TENNIS BALL
        </button>

        <button
          onClick={() => onInteract('walk')}
          disabled={isInteracting}
          className="btn text-[10px] py-2"
        >
          <Footprints size={12} /> TAKE WALK
        </button>

        <button
          onClick={() => onInteract('groom')}
          disabled={isInteracting}
          className="btn text-[10px] py-2"
        >
          <Sparkles size={12} /> BRUSH RUFF
        </button>
      </div>
    </div>
  );
};
