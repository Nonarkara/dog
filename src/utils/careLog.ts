/**
 * THE CARE LEDGER, browser side.
 *
 * When a signed-in owner takes their dog to the park, this writes the visit:
 * arrive on entering the commons, leave on heading home, each carrying a
 * snapshot of how the dog was being cared for at that moment. Local-first
 * still holds — the game never waits on these calls, and an offline visit
 * simply isn't logged. The record is for the boarding house's book, not for
 * the game.
 */

import type { PetState } from '../domain/types';
import type { DogProfile } from '../types/dog';

const snapshotOf = (petState: PetState) => ({
  fullness: Math.round(100 - (petState.needs.hunger ?? 0)),
  energy: Math.round(petState.needs.energy ?? 0),
  hygiene: Math.round(petState.needs.hygiene ?? 0),
  trust: Math.round(petState.trust ?? 0),
  calm: petState.calmSince !== undefined ? 100 : Math.round(petState.arousal ?? 0),
  sick: !!petState.sick,
  asleep: !!petState.sleep?.asleep,
});

const post = async (path: string, body: unknown, keepalive = false): Promise<void> => {
  try {
    await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TDC': '1' },
      credentials: 'same-origin',
      keepalive,
      body: JSON.stringify(body),
    });
  } catch { /* offline: the ledger skips this visit, the game does not care */ }
};

// The owner's answer to the consent note lives on the server only, so a
// shared browser or a second device always asks the right account.
export type VisitChoice = 'yes' | 'no' | null;
/** undefined: not signed in or offline, so the note is not shown. */
export const fetchVisitChoice = async (): Promise<VisitChoice | undefined> => {
  try {
    const r = await fetch('/api/visit/consent', { credentials: 'same-origin' });
    return r.ok ? ((await r.json()).consent as VisitChoice) : undefined;
  } catch { return undefined; }
};
/** True only when the server stored the answer. */
export const chooseVisitRecord = async (agree: boolean): Promise<boolean> => {
  try {
    const r = await fetch('/api/visit/consent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TDC': '1' }, credentials: 'same-origin', body: JSON.stringify({ agree }) });
    return r.ok;
  } catch { return false; }
};

export const arriveAtPark = (dog: DogProfile, petState: PetState, room: string): void => {
  void post('/api/visit', { dogId: dog.id, dogName: dog.name, room, snapshot: snapshotOf(petState) });
};

export const leavePark = (dog: DogProfile, petState: PetState): void => {
  void post('/api/visit/leave', { snapshot: snapshotOf(petState) }, true);
};
