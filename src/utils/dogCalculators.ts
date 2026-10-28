import { DogProfile, Vaccination } from '../types/dog';

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

export function loadStoredDogs(fallback: DogProfile[]): DogProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
