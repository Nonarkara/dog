import {rememberedEmail,rememberEmail,resumeEmail,signOutEmail,emailAuthorization,bounded} from './emailClient';
/**
 * CLOUD-SAVED DOG — the browser side of worker/accounts.ts.
 *
 * Local-first: the game always plays from the browser's own save. When you
 * are signed in, changes are pushed at most once a minute (the
 * newest revision wins there), and on opening "own" mode a newer server copy
 * is pulled in before the game starts. Offline care stays in this browser. After an offline startup, reopen Own
 * mode when connected so account and companion identity are checked first.
 */

import { ownedBackup, restoreOwnedBackup, validateOwnedBackup } from './progressStore';
import { readAdoption, OWN_SAVE_KEY } from './playMode';

export interface CloudDog { name: string; dog_id: string; revision: number; backup: string; updated_at: number }
export interface Me { user: { id?: string; name: string; provider: string } | null; dog: CloudDog | null; providers: string[] }

const CLOUD_KEY = 'tama_dog_chi_cloud';
export type SyncStatus='local'|'pending'|'saved'|'failed'|'conflict'|'auth-required'|'reconnect';
let syncStatus:SyncStatus='local';
export const readSyncStatus=()=>syncStatus;
const reportSync=(status:SyncStatus)=>{syncStatus=status;window.dispatchEvent(new Event('tdc-cloud-status'));};
let expectedAccountId:string|undefined;
let cloudBaseRevision:number|null|undefined;
let uploadInFlight=false;
let needsReconcile=false;
const ACCOUNT_KEY = 'tama_dog_chi_cloud_owner';
const BASE_KEY='tama_dog_chi_cloud_base_v1';
interface AcknowledgedBase {accountId:string;seed:string;serverRevision:number|null;localRevisionAtAck:number;}
function acknowledgedBase(me:Me,seed:string|undefined):AcknowledgedBase|null{
  try{const value=JSON.parse(localStorage.getItem(BASE_KEY)||'null');return value&&value.accountId===me.user?.id&&value.seed===seed&&(value.serverRevision===null||Number.isSafeInteger(value.serverRevision)&&value.serverRevision>=0)&&Number.isSafeInteger(value.localRevisionAtAck)&&value.localRevisionAtAck>=0?value:null;}catch{return null;}
}
function rememberBase(localRevisionAtAck:number){
  const adoption=readAdoption();
  if(expectedAccountId&&adoption)localStorage.setItem(BASE_KEY,JSON.stringify({accountId:expectedAccountId,seed:adoption.seed,serverRevision:cloudBaseRevision,localRevisionAtAck}));
}
const bindAccount=(me:Me,localRevisionAtAck=localRevision())=>{
  expectedAccountId=me.user?.id;cloudBaseRevision=me.dog?.revision??null;needsReconcile=false;
  if(me.user?.id)localStorage.setItem(ACCOUNT_KEY,me.user.id);
  rememberBase(localRevisionAtAck);setCloud(true);reportSync('pending');
};
const headers = { 'Content-Type': 'application/json', 'X-TDC': '1' };
async function accountFetch(path:string,options:RequestInit={}){const merged=new Headers(options.headers);for(const[k,v]of Object.entries(await emailAuthorization()))merged.set(k,v);return fetch(path,{...options,headers:merged,credentials:'same-origin'});}

export const cloudOn = (): boolean => {
  try { return localStorage.getItem(CLOUD_KEY) === '1'; } catch { return false; }
};
const setCloud = (on: boolean) => {
  try { if (on) localStorage.setItem(CLOUD_KEY, '1'); else localStorage.removeItem(CLOUD_KEY); } catch { /* cannot remember */ }
};

export async function fetchMe(): Promise<Me | null> {
  setCloud(false); // Never reuse a previous account's permission while discovery is pending.
  try {
    let discoveryOnly=false;
    if(rememberedEmail()){const controller=new AbortController();try{await bounded(resumeEmail(controller.signal),8000);}catch{controller.abort();rememberEmail(false);discoveryOnly=true;}}
    const r = discoveryOnly?await fetch('/api/me',{credentials:'omit',signal:AbortSignal.timeout(4000)}):await accountFetch('/api/me',{signal:AbortSignal.timeout(4000)});
    if (!r.ok) {needsReconcile=true;reportSync(r.status===401?'auth-required':'reconnect');return null;}
    const me = (await r.json()) as Me;
    setCloud(false); // Reconcile companion identity before permitting any upload.
    return me;
  } catch {
    needsReconcile=true;
    try{if(localStorage.getItem(ACCOUNT_KEY))reportSync('reconnect');}catch{/* Local storage can be unavailable too; local save errors are handled by the game. */}
    return null; // Offline care stays local until safe reconciliation on reopen.
  }
}

const localRevision = (): number => {
  try { const s = JSON.parse(localStorage.getItem(OWN_SAVE_KEY) || 'null'); return Number(s?.revision) || 0; } catch { return 0; }
};

/** Revisions are comparable only within the same adopted companion. */
export async function pullIfNewer(me: Me): Promise<'restored' | 'kept' | 'none' | 'conflict'> {
  setCloud(false);
  if (!me.user) {reportSync('local');return 'none';}
  const local=readAdoption();
  const previous=localStorage.getItem(ACCOUNT_KEY);
  if (local && previous && me.user.id && previous!==me.user.id) {reportSync('conflict');return 'conflict';}
  const prior=acknowledgedBase(me,local?.seed),revision=localRevision();
  if (!me.dog) {
    // A cloud companion that disappeared must not be silently recreated.
    if(prior&&prior.serverRevision!==null){reportSync('conflict');return 'conflict';}
    bindAccount(me,prior?.localRevisionAtAck??0);return 'none';
  }
  const remote=validateOwnedBackup(me.dog.backup);
  if (local && local.seed!==remote.adoption.seed) {reportSync('conflict');return 'conflict';}
  if(local&&prior){
    const localChanged=revision>prior.localRevisionAtAck,remoteChanged=me.dog.revision!==prior.serverRevision;
    if(localChanged&&remoteChanged){reportSync('conflict');return 'conflict';}
    if(!remoteChanged&&revision>=prior.localRevisionAtAck){bindAccount(me,prior.localRevisionAtAck);return 'kept';}
    // No local edits: a changed account copy can safely replace its local
    // representation, even when restore previously added a local revision.
  }else if(local&&revision>=me.dog.revision){
    // Older clients have no acknowledged base. An equal counter with different
    // bytes is ambiguous: ask, rather than declaring either history newer.
    if(revision===me.dog.revision&&JSON.stringify(ownedBackup())!==JSON.stringify(remote)){reportSync('conflict');return 'conflict';}
    bindAccount(me,me.dog.revision);return 'kept';
  }
  await restoreOwnedBackup(me.dog.backup);
  bindAccount(me);
  return 'restored';
}

/** The player explicitly chose this account's dog, or to upload to an empty account. */
export async function resolveCloudDog(me:Me):Promise<void>{
  if(!me.user)throw new Error('Sign in first.');
  setCloud(false);
  if(me.dog)await restoreOwnedBackup(me.dog.backup);
  bindAccount(me,me.dog?localRevision():0);
}

/** Push against the last observed server base. A conflict pauses uploads for an explicit recheck. */
export async function pushOwnedDog(keepalive = false): Promise<'saved' | 'newer-elsewhere' | 'skipped' | 'failed'> {
  if (!cloudOn()||uploadInFlight) return 'skipped';
  let backup;
  try { backup = ownedBackup(); } catch { return 'skipped'; }
  uploadInFlight=true;
  try {
    const body=JSON.stringify({ revision: backup.save.revision, backup, expectedAccountId, baseRevision:cloudBaseRevision });
    // Fetch keepalive has a 64KiB shared body budget. Large photo saves use
    // ordinary fetch: works on hide, best effort on close, never a rejected beacon.
    const canKeepAlive=keepalive&&new TextEncoder().encode(body).byteLength<=60_000;
    const r = await accountFetch('/api/dog', {
      method: 'PUT', headers, credentials: 'same-origin', keepalive:canKeepAlive, body, signal:AbortSignal.timeout(15_000),
    });
    if (r.status === 401) setCloud(false);
    if(r.ok){cloudBaseRevision=backup.save.revision;rememberBase(backup.save.revision);}
    reportSync(r.ok?(localRevision()>backup.save.revision?'pending':'saved'):r.status===401?'auth-required':r.status===409?'conflict':'failed');
    if(r.status===409)setCloud(false);
    return r.ok ? 'saved' : r.status === 409 ? 'newer-elsewhere' : 'failed';
  } catch {
    reportSync('failed');return 'failed';
  } finally {uploadInFlight=false;}
}

/**
 * Push at most once a minute while playing; attempt a final save on hide.
 * Closing a page cannot guarantee delivery; the browser copy remains authoritative.
 * The game saves locally every ~10 s; pushing each one would spend the free
 * database's daily writes on a few hundred player-hours.
 */
const CLOUD_EVERY_MS = 60_000;
export function startCloudSync(): () => void {
  let timer = 0, last = Date.now();
  const push = (keepalive = false) => { last = Date.now(); void pushOwnedDog(keepalive); };
  const later = () => { if(cloudOn())reportSync('pending');clearTimeout(timer); timer = window.setTimeout(push, Math.max(4000, CLOUD_EVERY_MS - (Date.now() - last))); };
  const online=()=>{try{if(needsReconcile&&!cloudOn()&&localStorage.getItem(ACCOUNT_KEY))reportSync('reconnect');}catch{/* Storage is unavailable; do not start a background identity flow. */}};
  const now = () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); push(true); } };
  window.addEventListener('online',online);
  window.addEventListener('tdc-saved', later);
  document.addEventListener('visibilitychange', now);
  push();
  return () => { clearTimeout(timer);window.removeEventListener('online',online); window.removeEventListener('tdc-saved', later); document.removeEventListener('visibilitychange', now); };
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
