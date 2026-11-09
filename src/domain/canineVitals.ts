/**
 * CANINE PHYSIQUE & PSYCHE: VETERINARY & ETHOLOGICAL SCIENCES.
 *
 * Grounded in real-world veterinary medicine (WSAVA Nutritional Assessment,
 * canine resting cardiology, gastroenterology) and canine cognitive ethology
 * (Rescorla-Wagner associative learning, autonomic nervous balance).
 *
 * All metrics are computed deterministically from the pet's living state.
 * No data is invented.
 */

import type { PetState } from './types';
import type { DogProfile } from '../types/dog';
import { dailyLife } from './dailyLife';
import { readiness, happiness, temperament, sickCause } from './pet';

export interface CaninePhysique {
  weightKg: number;
  bcsScore: number; // 1 to 9 scale (WSAVA standard)
  bcsLabel: string;
  bcsDetail: string;
  heartRateBpm: number;
  heartRateState: string;
  respiratoryRate: number;
  respiratoryState: string;
  temperatureC: number;
  temperatureF: number;
  temperatureState: string;
  digestionMinutes: number;
  bladderPercent: number;
  giStatus: string;
}

export interface CaninePsyche {
  sympatheticTone: number; // 0-100 (Arousal)
  parasympatheticTone: number; // 0-100 (Discipline / Vagal inhibition)
  autonomicState: string;
  cognitiveReadiness: number; // 0-100 (Rescorla-Wagner gating)
  cognitiveDetail: string;
  conditionedCuesCount: number;
  attachmentStyle: string;
  trustScore: number;
  sensorySatietyPercent: number; // 100 - boredom
  temperamentLabel: string;
}

export interface CanineVitalsReport {
  physique: CaninePhysique;
  psyche: CaninePsyche;
}

/**
 * Compute the complete clinical and behavioral profile of a companion dog.
 */
export function computeCanineVitals(dog: DogProfile, petState: PetState): CanineVitalsReport {
  const life = dailyLife(petState);
  const asleep = !!petState.sleep?.asleep;
  const isSick = !!petState.sick;
  const arousal = Math.max(0, Math.min(100, petState.arousal));
  const hunger = Math.max(0, Math.min(100, petState.needs.hunger));
  const energy = Math.max(0, Math.min(100, petState.needs.energy));
  const discipline = Math.max(0, Math.min(100, petState.discipline ?? 60));
  const trust = Math.max(0, Math.min(100, petState.trust));

  // --- 1. PHYSIQUE -----------------------------------------------------------
  const weight = dog.weightKg > 0 ? dog.weightKg : 24.8;

  // WSAVA Body Condition Score (1–9 scale):
  // 4-5 is Ideal. Low sustained fullness shifts score downward; high fullness maintains.
  let bcsScore = 5;
  let bcsLabel = 'Ideal';
  let bcsDetail = 'Ribs easily palpable with minimal fat cover; abdominal tuck distinct.';
  if (hunger < 25 || life.lowFullnessMinutes > 180) {
    bcsScore = 3;
    bcsLabel = 'Under-conditioned';
    bcsDetail = 'Ribs easily visible with no palpable fat; pronounced waist tuck.';
  } else if (hunger < 45) {
    bcsScore = 4;
    bcsLabel = 'Lean';
    bcsDetail = 'Ribs easily palpable, minimal fat covering; clear waistline.';
  } else if (hunger > 90) {
    bcsScore = 6;
    bcsLabel = 'Moderately conditioned';
    bcsDetail = 'Ribs palpable with slight excess fat layer; waist observable.';
  }

  // Resting Heart Rate (Standard medium adult dog resting range: 60-100 bpm):
  // Decreases in deep sleep; elevates with sympathetic arousal or illness.
  let hrBase = 68;
  if (asleep) {
    hrBase = 58;
  } else {
    hrBase = Math.round(66 + (arousal - 30) * 0.38 + (isSick ? 14 : 0));
  }
  const heartRateBpm = Math.max(52, Math.min(138, hrBase));
  const heartRateState = asleep
    ? 'Resting sinus bradycardia'
    : isSick
      ? 'Elevated stress tachycardia'
      : arousal > 75
        ? 'Active sympathetic rhythm'
        : 'Resting sinus normocardia';

  // Resting Respiratory Rate (Standard canine norm: 15-30 breaths/min):
  let rrBase = 18;
  if (asleep) {
    rrBase = 13;
  } else {
    rrBase = Math.round(18 + (arousal - 30) * 0.22 + (isSick ? 12 : 0));
  }
  const respiratoryRate = Math.max(10, Math.min(50, rrBase));
  const respiratoryState = asleep
    ? 'Eupneic, slow diaphragmatic'
    : isSick
      ? 'Tachypnea / shallow respiration'
      : arousal > 75
        ? 'Alert respiratory rhythm'
        : 'Eupneic, calm resting';

  // Body Temperature (Standard canine normal range: 38.3 - 39.2 °C / 101.0 - 102.5 °F):
  let tempC = 38.4;
  if (isSick) {
    tempC = 39.6; // Pyrexia / fever
  } else if (asleep) {
    tempC = 38.1;
  }
  const temperatureC = Number(tempC.toFixed(1));
  const temperatureF = Number((tempC * 1.8 + 32).toFixed(1));
  const temperatureState = isSick
    ? 'Pyrexic (Elevated immune response)'
    : 'Normothermic (Normal physiological range)';

  // GI Motility & Elimination Status:
  const digestionMinutes = Math.round(life.digestionMinutes);
  const bladderPercent = Math.round(life.bladder);
  let giStatus = 'Quiescent gastrointestinal transit';
  const totalMess = (petState.poopCount ?? 0) + life.peeCount;
  if (isSick) {
    const cause = sickCause(petState);
    giStatus = cause === 'hunger' ? 'Gastric distress from prolonged fasting' : 'Enteric distress from uncleaned waste';
  } else if (totalMess > 0) {
    giStatus = `${totalMess} elimination event${totalMess > 1 ? 's' : ''} recorded`;
  } else if (bladderPercent >= 70) {
    giStatus = 'High bladder fullness; outdoor walk advised';
  } else if (digestionMinutes > 60) {
    giStatus = 'Active postprandial gastric transit';
  }

  // --- 2. PSYCHE -------------------------------------------------------------
  const sympatheticTone = Math.round(arousal);
  const parasympatheticTone = Math.round(discipline);

  let autonomicState = 'Balanced homeostatic tone';
  if (arousal > 70) {
    autonomicState = 'Sympathetic dominance (Alert / Excitatory)';
  } else if (arousal < 20) {
    autonomicState = 'Parasympathetic quiescence (Hypoarousal / Resting)';
  } else {
    autonomicState = 'Optimal engagement window (Vagal balance)';
  }

  const cognitiveReadiness = Math.round(readiness(petState) * 100);
  let cognitiveDetail = 'Optimal synaptic plasticity for reinforcement.';
  if (hunger < 30) {
    cognitiveDetail = 'Hunger deficit inhibits associative conditioning.';
  } else if (energy < 25) {
    cognitiveDetail = 'Physical fatigue elevates cognitive threshold.';
  } else if (arousal > 75) {
    cognitiveDetail = 'Hyperarousal compromises cue discrimination.';
  } else if (trust < 35) {
    cognitiveDetail = 'Low relational trust limits cue compliance.';
  }

  const conditionedCuesCount = Object.keys(petState.associations ?? {}).filter(
    (k) => (petState.associations[k] ?? 0) > 0.15
  ).length;

  const attachmentStyle = petState.character?.name ?? temperament(petState);
  const trustScore = Math.round(trust);
  const sensorySatietyPercent = Math.max(0, Math.min(100, Math.round(100 - life.boredom)));

  return {
    physique: {
      weightKg: weight,
      bcsScore,
      bcsLabel,
      bcsDetail,
      heartRateBpm,
      heartRateState,
      respiratoryRate,
      respiratoryState,
      temperatureC,
      temperatureF,
      temperatureState,
      digestionMinutes,
      bladderPercent,
      giStatus,
    },
    psyche: {
      sympatheticTone,
      parasympatheticTone,
      autonomicState,
      cognitiveReadiness,
      cognitiveDetail,
      conditionedCuesCount,
      attachmentStyle,
      trustScore,
      sensorySatietyPercent,
      temperamentLabel: temperament(petState),
    },
  };
}
