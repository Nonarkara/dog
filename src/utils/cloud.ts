/**
 * CLOUD-SAVED DOG — the browser side of worker/accounts.ts.
 *
 * Local-first: the game always plays from the browser's own save. When you
 * are signed in, every save is pushed to the server a few seconds later (the
 * newest revision wins there), and on opening "own" mode a newer server copy
 * is pulled in before the game starts. Offline, nothing breaks: the next
 * successful push catches up.
 */

import { ownedBackup, restoreOwnedBackup } from './progressStore';
import { readAdoption, OWN_SAVE_KEY } from './playMode';

export interface CloudDog { name: string; dog_id: string; revision: number; backup: string; updated_at: number }
export interface Me { user: { name: string; provider: string } | null; dog: CloudDog | null; providers: string[] }

const CLOUD_KEY = 'tama_dog_chi_cloud';
const headers = { 'Content-Type': 'application/json', 'X-TDC': '1' };

export const cloudOn = (): boolean => {
  try { return localStorage.getItem(CLOUD_KEY) === '1'; } catch { return false; }
};
const setCloud = (on: boolean) => {
  try { if (on) localStorage.setItem(CLOUD_KEY, '1'); else localStorage.removeItem(CLOUD_KEY); } catch { /* cannot remember */ }
};

export async function fetchMe(): Promise<Me | null> {
  try {
    const r = await fetch('/api/me', { credentials: 'same-origin' });
    if (!r.ok) return null;
    const me = (await r.json()) as Me;
    setCloud(!!me.user);
    return me;
  } catch {
    return null; // offline: keep playing from the browser
  }
}

const localRevision = (): number => {
  try { const s = JSON.parse(localStorage.getItem(OWN_SAVE_KEY) || 'null'); return Number(s?.revision) || 0; } catch { return 0; }
};

/** Bring a newer cloud copy into this browser. Returns what happened. */
export async function pullIfNewer(me: Me): Promise<'restored' | 'kept' | 'none'> {
  if (!me.user || !me.dog) return 'none';
  if (readAdoption() && localRevision() >= me.dog.revision) return 'kept';
  await restoreOwnedBackup(me.dog.backup);
  return 'restored';
}

/** Push this browser's dog now. A 409 means another device has a newer copy; it wins on next open. */
export async function pushOwnedDog(keepalive = false): Promise<'saved' | 'newer-elsewhere' | 'skipped' | 'failed'> {
  if (!cloudOn()) return 'skipped';
  let backup;
  try { backup = ownedBackup(); } catch { return 'skipped'; }
  try {
    const r = await fetch('/api/dog', {
      method: 'PUT', headers, credentials: 'same-origin', keepalive,
      body: JSON.stringify({ revision: backup.save.revision, backup }),
    });
    if (r.status === 401) setCloud(false);
    return r.ok ? 'saved' : r.status === 409 ? 'newer-elsewhere' : 'failed';
  } catch {
    return 'failed';
  }
}

/** Push a few seconds after the game saves, and once more when the page is hidden. */
export function startCloudSync(): () => void {
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = window.setTimeout(() => void pushOwnedDog(), 4000); };
  const now = () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); void pushOwnedDog(true); } };
  window.addEventListener('tdc-saved', later);
  document.addEventListener('visibilitychange', now);
  void pushOwnedDog();
  return () => { clearTimeout(timer); window.removeEventListener('tdc-saved', later); document.removeEventListener('visibilitychange', now); };
}

export async function signOut(): Promise<void> {
  try { await fetch('/api/auth/logout', { method: 'POST', headers, credentials: 'same-origin' }); } finally { setCloud(false); }
}

/** Deletes the account and the cloud copy. The dog in this browser stays unless the owner resets it. */
export async function deleteAccount(): Promise<boolean> {
  const r = await fetch('/api/account', { method: 'DELETE', headers, credentials: 'same-origin' });
  if (r.ok) setCloud(false);
  return r.ok;
}
