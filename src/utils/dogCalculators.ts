import { DogProfile, TamagotchiStats } from '../types/dog';
import type { PetState, Behaviour, BehaviourName, Schedule } from '../domain/types';
import { createPetState, decay } from '../domain/pet';

export interface AgeCalculation {
  years: number;
  months: number;
  days: number;
  dogYears: number;
  daysUntilNextBirthday: number;
  formattedCalendarAge: string;
  isBirthdayToday: boolean;
}

export function calculateDogAge(birthDateStr: string, weightKg: number = 24, now: Date = new Date()): AgeCalculation {
  const birth = new Date(birthDateStr);

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prevMonthDays;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // Next birthday countdown
  const nextBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (nextBirthday.getTime() < now.getTime()) {
    nextBirthday.setFullYear(now.getFullYear() + 1);
  }
  const diffMs = nextBirthday.getTime() - now.getTime();
  const daysUntilNextBirthday = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isBirthdayToday = daysUntilNextBirthday === 0 || (birth.getMonth() === now.getMonth() && birth.getDate() === now.getDate());

  // AVMA / UC Davis scientifically-informed dog years curve based on weight
  // Year 1: ~15 dog years. Year 2: +9 years (~24). Subsequent years: +4 to +5 years for medium dogs (15-25kg)
  let dogYears = 0;
  const totalYearsFloat = years + months / 12 + days / 365;

  if (totalYearsFloat <= 1) {
    dogYears = Math.round(totalYearsFloat * 15);
  } else if (totalYearsFloat <= 2) {
    dogYears = Math.round(15 + (totalYearsFloat - 1) * 9);
  } else {
    const ratePerYear = weightKg > 25 ? 5.2 : 4.5;
    dogYears = Math.round(24 + (totalYearsFloat - 2) * ratePerYear);
  }

  const formattedCalendarAge = `${years}y ${months}m ${days}d`;

  return {
    years,
    months,
    days,
    dogYears,
    daysUntilNextBirthday,
    formattedCalendarAge,
    isBirthdayToday,
  };
}

export function getVaccineStatus(dueDateStr: string, now: Date = new Date()): {
  status: 'valid' | 'expiring-soon' | 'expired';
  daysRemaining: number;
  badgeLabel: string;
} {
  const due = new Date(dueDateStr);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'expired',
      daysRemaining: diffDays,
      badgeLabel: `EXPIRED (${Math.abs(diffDays)}d ago)`,
    };
  }
  if (diffDays <= 30) {
    return {
      status: 'expiring-soon',
      daysRemaining: diffDays,
      badgeLabel: `DUE IN ${diffDays}d`,
    };
  }
  return {
    status: 'valid',
    daysRemaining: diffDays,
    badgeLabel: `CURRENT (${diffDays}d)`,
  };
}

const STORAGE_KEY = 'canine_os_dogs_v1';
const ACTIVE_DOG_KEY = 'canine_os_active_dog_id';
const PET_STATE_KEY = 'canine_os_pet_states_v1';
const SCHEMA_KEY = 'canine_os_schema';

/**
 * THE SCHEMA VERSION.
 *
 * A record written by an older build must still open. So every record is
 * versioned, and a record from an older version is brought forward rather
 * than discarded: the reader would otherwise open the app and find their
 * dog's history gone, with no way to get it back.
 */
const SCHEMA_VERSION = 2;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A stable key from a dog's name, for a record that arrived without an id. */
const nameKey = (name: string | undefined): string =>
  (name || 'unnamed').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * BRING A DOG RECORD FORWARD.
 *
 * Only what the current build needs is added, and nothing that exists is
 * thrown away. A record that gains a field it did not have is migrated; a
 * record whose field is missing entirely is given the safe default.
 */
function migrateDog(raw: unknown): DogProfile | null {
  if (!isObject(raw)) return null;
  const dog = raw as Partial<DogProfile>;

  const tamagotchi = (
    isObject(dog.tamagotchi) ? dog.tamagotchi : {}
  ) as Partial<TamagotchiStats>;
  const avatar = (
    isObject(dog.avatarConfig) ? dog.avatarConfig : {}
  ) as Partial<DogProfile['avatarConfig']>;

  return {
    ...dog,
    id: typeof dog.id === 'string' && dog.id ? dog.id : `dog-migrated-${nameKey(dog.name)}`,
    name: typeof dog.name === 'string' && dog.name ? dog.name : 'Unnamed',
    breed: dog.breed || 'Mixed Breed',
    birthDate: dog.birthDate || '2023-01-01',
    sex: dog.sex === 'female' ? 'female' : 'male',
    isNeutered: Boolean(dog.isNeutered),
    microchipId: dog.microchipId || 'Not recorded',
    weightKg: Number(dog.weightKg) || 20,
    coatColor: dog.coatColor || 'Not recorded',
    distinctiveMarks: Array.isArray(dog.distinctiveMarks) ? dog.distinctiveMarks : [],
    personalityTraits: Array.isArray(dog.personalityTraits) ? dog.personalityTraits : [],
    favoriteFood: dog.favoriteFood || '',
    favoriteToy: dog.favoriteToy || '',
    quirks: Array.isArray(dog.quirks) ? dog.quirks : [],
    primaryVetClinic: dog.primaryVetClinic || '',
    emergencyPhone: dog.emergencyPhone || '',
    photos: Array.isArray(dog.photos) ? dog.photos : [],
    primaryPhotoUrl: typeof dog.primaryPhotoUrl === 'string' ? dog.primaryPhotoUrl : '',
    vaccinations: Array.isArray(dog.vaccinations) ? dog.vaccinations : [],
    parasiteControl: Array.isArray(dog.parasiteControl) ? dog.parasiteControl : [],
    medicalHistory: Array.isArray(dog.medicalHistory) ? dog.medicalHistory : [],
    tamagotchi: {
      hunger: Number(tamagotchi.hunger ?? 80),
      happiness: Number(tamagotchi.happiness ?? 80),
      energy: Number(tamagotchi.energy ?? 80),
      hygiene: Number(tamagotchi.hygiene ?? 85),
      lastFed: Number(tamagotchi.lastFed ?? Date.now()),
      lastPlayed: Number(tamagotchi.lastPlayed ?? Date.now()),
      lastWalked: Number(tamagotchi.lastWalked ?? Date.now()),
      lastGroomed: Number(tamagotchi.lastGroomed ?? Date.now()),
    },
    metaverseTribe: dog.metaverseTribe || 'The Roaming Pack',
    metaverseBio: dog.metaverseBio || '',
    avatarConfig: {
      baseColor: avatar.baseColor || '#854d0e',
      secondaryColor: avatar.secondaryColor || '#fef3c7',
      maskColor: avatar.maskColor || '#451a03',
      furFluff: Number(avatar.furFluff ?? 0.5),
      earShape: avatar.earShape ?? 'floppy',
      tailShape: avatar.tailShape ?? 'curl',
      ...(avatar.customModelUrl ? { customModelUrl: String(avatar.customModelUrl) } : {}),
    },
  };
}

/**
 * BRING A PET STATE FORWARD.
 *
 * The observation log and the per-behaviour cue lists were added after the
 * first records were written, so an old state is given empty ones rather than
 * being thrown away.
 */
function migratePetState(raw: unknown): PetState | null {
  if (!isObject(raw)) return null;
  const state = raw as Partial<PetState>;
  const behaviours = (
    isObject(state.behaviours) ? state.behaviours : {}
  ) as Record<string, Partial<Behaviour>>;

  return {
    ...state,
    updatedAt: Number(state.updatedAt ?? Date.now()),
    needs: {
      hunger: Number(state.needs?.hunger ?? 70),
      energy: Number(state.needs?.energy ?? 75),
      hygiene: Number(state.needs?.hygiene ?? 85),
    },
    trust: Number(state.trust ?? 60),
    arousal: Number(state.arousal ?? 30),
    personality: {
      boldness: Number(state.personality?.boldness ?? 0),
      sociability: Number(state.personality?.sociability ?? 0),
      foodDrive: Number(state.personality?.foodDrive ?? 0.2),
      playDrive: Number(state.personality?.playDrive ?? 0.3),
      sensitivity: Number(state.personality?.sensitivity ?? 0.2),
    },
    behaviours: Object.fromEntries(
      Object.entries(behaviours).map(([name, behaviour]) => [
        name,
        {
          ...behaviour,
          name: name as BehaviourName,
          strength: Math.min(1, Math.max(0, Number(behaviour.strength ?? 0))),
          reps: Number(behaviour.reps ?? 0),
          performedReps: Number(behaviour.performedReps ?? behaviour.reps ?? 0),
          rehearsals: Number(behaviour.rehearsals ?? 0),
          repsSinceReinforcement: Number(behaviour.repsSinceReinforcement ?? 0),
          markerDelayMs: Number(behaviour.markerDelayMs ?? 0),
          schedule: (behaviour.schedule ?? 'continuous') as Schedule,
          cues: Array.isArray(behaviour.cues) ? behaviour.cues : [],
          history: Array.isArray(behaviour.history) ? behaviour.history : [],
        } as Behaviour,
      ])
    ),
    associations: isObject(state.associations) ? state.associations : {},
    observations: Array.isArray(state.observations) ? state.observations : [],
    sleep: {
      asleep: Boolean(state.sleep?.asleep),
      fellAsleepAt:
        typeof state.sleep?.fellAsleepAt === 'number' ? state.sleep.fellAsleepAt : null,
      wokenAt: typeof state.sleep?.wokenAt === 'number' ? state.sleep.wokenAt : null,
      wakeCount: Number(state.sleep?.wakeCount ?? 0),
      restlessness: Number(state.sleep?.restlessness ?? 0),
    },
    lastCareAt: Number(state.lastCareAt ?? Date.now()),
  };
}

function readSchemaVersion(): number {
  try {
    return Number(localStorage.getItem(SCHEMA_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeSchemaVersion(): void {
  try {
    localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
  } catch {
    /* storage is unavailable; the app still works, it just cannot remember. */
  }
}

export function loadStoredDogs(fallback: DogProfile[]): DogProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;

    const migrated = parsed
      .map(migrateDog)
      .filter((d): d is DogProfile => d !== null)
      // A starter dog saved before coats had patterns carries the old, wrong
      // colours (Expo was stored as wolf-grey). Take the corrected coat from
      // the defaults, keeping any model the owner imported.
      .map((d) => {
        const def = fallback.find((f) => f.id === d.id);
        if (!def || d.avatarConfig?.pattern) return d;
        return { ...d, coatColor: def.coatColor, avatarConfig: { ...def.avatarConfig, customModelUrl: d.avatarConfig?.customModelUrl } };
      });
    if (migrated.length === 0) return fallback;
    if (readSchemaVersion() !== SCHEMA_VERSION) writeSchemaVersion();
    return migrated;
  } catch (e) {
    console.warn('Failed to load dogs from localStorage, using fallback', e);
  }
  return fallback;
}

export function saveDogs(dogs: DogProfile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dogs));
  } catch (e) {
    console.error('Failed to save dogs to localStorage', e);
  }
}

export function loadActiveDogId(fallbackId: string): string {
  try {
    return localStorage.getItem(ACTIVE_DOG_KEY) || fallbackId;
  } catch {
    return fallbackId;
  }
}

export function saveActiveDogId(id: string) {
  try {
    localStorage.setItem(ACTIVE_DOG_KEY, id);
  } catch (e) {
    console.error(e);
  }
}

/**
 * PER-DOG INNER LIFE STORAGE.
 *
 * Each dog carries their own trust, arousal, personality, associations, and
 * behaviour ledger. Keyed by dog id so Expo, Mali and Bangal never share a
 * state.
 */
export function loadStoredPetStates(): Record<string, PetState> {
  try {
    const raw = localStorage.getItem(PET_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return {};
    const migrated: Record<string, PetState> = {};
    for (const [id, value] of Object.entries(parsed)) {
      const state = migratePetState(value);
      if (state) migrated[id] = state;
    }
    if (readSchemaVersion() !== SCHEMA_VERSION) writeSchemaVersion();
    return migrated;
  } catch (e) {
    console.warn('Failed to load pet states from localStorage', e);
  }
  return {};
}

export function savePetStates(states: Record<string, PetState>) {
  try {
    localStorage.setItem(PET_STATE_KEY, JSON.stringify(states));
    writeSchemaVersion();
  } catch (e) {
    console.error('Failed to save pet states to localStorage', e);
  }
}

/**
 * THE STATE AS IT IS NOW.
 *
 * The record was written the last time the dog was seen. Time has passed
 * since, and a dog that has not been fed for a day IS hungrier now. So the
 * state is brought forward to the present before it is handed over — the
 * numbers on screen are the numbers for right now, not the numbers for
 * whenever the reader last closed the app.
 */
export function loadPetState(dogId: string, now: number = Date.now()): PetState {
  const states = loadStoredPetStates();
  const stored = states[dogId];
  if (stored) return decay(stored, now);
  return createPetState(now);
}

export function savePetState(dogId: string, state: PetState) {
  const states = loadStoredPetStates();
  states[dogId] = state;
  savePetStates(states);
}
