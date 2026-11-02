import {rememberedEmail,rememberEmail,resumeEmail,signOutEmail,emailAuthorization,bounded} from './emailClient';
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
async function accountFetch(path:string,options:RequestInit={}){const merged=new Headers(options.headers);for(const[k,v]of Object.entries(await emailAuthorization()))merged.set(k,v);return fetch(path,{...options,headers:merged,credentials:'same-origin'});}

export const cloudOn = (): boolean => {
  try { return localStorage.getItem(CLOUD_KEY) === '1'; } catch { return false; }
};
const setCloud = (on: boolean) => {
  try { if (on) localStorage.setItem(CLOUD_KEY, '1'); else localStorage.removeItem(CLOUD_KEY); } catch { /* cannot remember */ }
};

export async function fetchMe(): Promise<Me | null> {
  try {
    let discoveryOnly=false;
    if(rememberedEmail()){const controller=new AbortController();try{await bounded(resumeEmail(controller.signal),8000);}catch{controller.abort();rememberEmail(false);discoveryOnly=true;}}
    const r = discoveryOnly?await fetch('/api/me',{credentials:'omit',signal:AbortSignal.timeout(4000)}):await accountFetch('/api/me',{signal:AbortSignal.timeout(4000)});
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
    const r = await accountFetch('/api/dog', {
      method: 'PUT', headers, credentials: 'same-origin', keepalive,
      body: JSON.stringify({ revision: backup.save.revision, backup }),
    });
    if (r.status === 401) setCloud(false);
    return r.ok ? 'saved' : r.status === 409 ? 'newer-elsewhere' : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Push at most once a minute while playing, and at once when the page is hidden.
 * The game saves locally every ~10 s; pushing each one would spend the free
 * database's daily writes on a few hundred player-hours.
 */
const CLOUD_EVERY_MS = 60_000;
export function startCloudSync(): () => void {
  let timer = 0, last = Date.now();
  const push = (keepalive = false) => { last = Date.now(); void pushOwnedDog(keepalive); };
  const later = () => { clearTimeout(timer); timer = window.setTimeout(push, Math.max(4000, CLOUD_EVERY_MS - (Date.now() - last))); };
  const now = () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); push(true); } };
  window.addEventListener('tdc-saved', later);
  document.addEventListener('visibilitychange', now);
  push();
  return () => { clearTimeout(timer); window.removeEventListener('tdc-saved', later); document.removeEventListener('visibilitychange', now); };
}

export async function signOut(): Promise<void> {
  const response=await fetch('/api/auth/logout',{method:'POST',headers,credentials:'same-origin'});if(!response.ok)throw new Error('Sign-out did not finish.');
  try{await bounded(signOutEmail(),5000);}catch{rememberEmail(false);}setCloud(false);
}

/** Deletes the account and the cloud copy. The dog in this browser stays unless the owner resets it. */
export async function deleteAccount(): Promise<'deleted'|'pending'|false> {
  const r = await accountFetch('/api/account', { method: 'DELETE', headers, credentials: 'same-origin' });
  if (r.ok) {try{await bounded(signOutEmail(),5000);}catch{/* The server has revoked/deleted the identity; local cleanup is best-effort. */}setCloud(false);rememberEmail(false);}
  return !r.ok?false:r.status===202?'pending':'deleted';
}

/** Fetch with the managed identity too; a plain link cannot carry a bearer token. */
export async function downloadMyData(){
 const response=await accountFetch('/api/export');if(!response.ok)throw new Error('Your data could not be downloaded. Please try again.');
 const url=URL.createObjectURL(await response.blob()),anchor=document.createElement('a');anchor.href=url;anchor.download='tama-dog-chi-my-data.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
