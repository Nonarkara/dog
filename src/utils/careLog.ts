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
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive,
      body: JSON.stringify(body),
    });
  } catch { /* offline: the ledger skips this visit, the game does not care */ }
};

export const arriveAtPark = (dog: DogProfile, petState: PetState, room: string): void => {
  void post('/api/visit', { dogId: dog.id, dogName: dog.name, room, snapshot: snapshotOf(petState) });
};

export const leavePark = (dog: DogProfile, petState: PetState): void => {
  void post('/api/visit/leave', { snapshot: snapshotOf(petState) }, true);
};
