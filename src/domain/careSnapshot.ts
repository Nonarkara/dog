import type { PetState } from './types';

const METERS = ['fullness', 'energy', 'hygiene', 'happy', 'trust', 'arousal'] as const;
const FLAGS = ['sick', 'asleep'] as const;
type Meter = typeof METERS[number];
type Flag = typeof FLAGS[number];
export type CareSnapshot = { version: 2 } & Partial<Record<Meter, number> & Record<Flag, boolean>>;

export const snapshotOf = (pet: PetState): CareSnapshot => ({
  version: 2,
  fullness: Math.round(pet.needs.hunger),
  energy: Math.round(pet.needs.energy),
  hygiene: Math.round(pet.needs.hygiene),
  trust: Math.round(pet.trust),
  arousal: Math.round(pet.arousal),
  sick: !!pet.sick,
  asleep: !!pet.sleep?.asleep,
});

/** Keep only agreed fields. Older tabs sent hunger under the fullness label. */
export function parseCareSnapshot(input: unknown): CareSnapshot | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  if (source.version !== undefined && source.version !== 2) return null;
  const result: CareSnapshot = { version: 2 };
  for (const key of METERS) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) return null;
    result[key] = key === 'fullness' && source.version === undefined ? 100 - value : value;
  }
  for (const key of FLAGS) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') return null;
    result[key] = value;
  }
  return result;
}
