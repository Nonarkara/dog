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
import { snapshotOf } from '../domain/careSnapshot';

const post = async (path: string, body: unknown, keepalive = false): Promise<Response | undefined> => {
  try {
    return await fetch(path, {
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
export interface VisitPermission {
  accountId: string;
  consent: VisitChoice;
  consentAt: number | null;
}

async function readPermission(response: Response | undefined): Promise<VisitPermission | undefined> {
  if (!response?.ok) return undefined;
  const { accountId, consent, consentAt } = await response.json();
  if (typeof accountId !== 'string') return undefined;
  if (consent === 'yes' && Number.isSafeInteger(consentAt) && consentAt > 0 ||
      consent === 'no' && consentAt === 0 ||
      consent === null && consentAt === null) return { accountId, consent, consentAt };
  return undefined;
}

/** undefined: not signed in or offline, so the note is not shown. */
export const fetchVisitChoice = async (): Promise<VisitPermission | undefined> => {
  try {
    const r = await fetch('/api/visit/consent', { credentials: 'same-origin' });
    return await readPermission(r);
  } catch { return undefined; }
};
/** Returns the consent recorded for this account. */
export const chooseVisitRecord = async (accountId: string, agree: boolean): Promise<VisitPermission | undefined> => {
  try {
    return await readPermission(await post('/api/visit/consent', { accountId, agree }));
  } catch { return undefined; }
};

export const arriveAtPark = (dog: DogProfile, petState: PetState, room: string, permission: VisitPermission) => {
  const visit = { visitKey: crypto.randomUUID(), accountId: permission.accountId };
  const arrival = post('/api/visit', {
    ...visit, consentAt: permission.consentAt, dogId: dog.id, dogName: dog.name, room, snapshot: snapshotOf(petState),
  });
  return (finalState: PetState): void => {
    const snapshot = snapshotOf(finalState);
    // A quick Home or hide must wait for its own arrival. A network error
    // can lose the response after a write, so still try the keyed departure.
    void arrival.then(response => {
      if (!response || response.ok) return post('/api/visit/leave', { ...visit, snapshot }, true);
    });
  };
};
