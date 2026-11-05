/** Opt-in, local-first calls when the app is closed. */
import type {PetState} from '../domain/types';
import {nextCallAt} from '../domain/life';
import {buildPushSchedule,type PushSchedule} from '../domain/pushSchedule';
import {playMode} from './playMode';
import {pushRevision,type PushNote} from './pushState';
import {VAPID_PUBLIC} from './vapidPublic';

export const pushSupported=()=>typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
/** iPhone only allows web push from an app added to the Home Screen. */
export const needsInstall=()=>typeof navigator!=='undefined'&&(/iPhone|iPad/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1))&&!(navigator as Navigator&{standalone?:boolean}).standalone;
const FOLLOWUP_KEY='tdc-push-followup-v1';
export function followupEnabled(){try{return localStorage.getItem(FOLLOWUP_KEY)==='true';}catch{return false;}}
export function setFollowupEnabled(on:boolean){localStorage.setItem(FOLLOWUP_KEY,String(on));void clearCall();}
const returnUrl=()=>`/?mode=${playMode()}&source=call`;
const key=()=>Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
let endpoint:string|null=null,intent=0,problem='';
class StaleSchedule extends Error{}
export const pushProblem=()=>problem;
function report(message:string){problem=message;window.dispatchEvent(new Event('tdc-push-status'));}
async function subscription(){
  if(!pushSupported()||Notification.permission!=='granted')return null;
  const reg=await navigator.serviceWorker.getRegistration();
  return reg?.pushManager.getSubscription()??null;
}
export async function pushEnabled(){return !!(await subscription().catch(()=>null));}
async function send(to:string,schedule:PushSchedule|0|null,revision:number){
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
  try{
    const response=await fetch('/api/push',{method:'POST',keepalive:true,signal:abort.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:to,revision,...(typeof schedule==='object'&&schedule!==null?schedule:{at:schedule})})});
    if(response.status===409){
      const floor=await response.json().catch(()=>null);
      if(Number.isSafeInteger(floor?.revision)&&floor.revision>0)await pushRevision(undefined,returnUrl(),floor.revision);
      throw new StaleSchedule('Reminders changed in another tab. Try again.');
    }
    if(!response.ok)throw new Error('Could not reach reminders. Try again.');
  }finally{clearTimeout(timeout);}
}
async function closeShownCalls(){
  try{const reg=await navigator.serviceWorker.getRegistration();for(const n of await reg?.getNotifications({tag:'dog-call'})??[])n.close();}catch{/* The browser may not expose notification history. */}
  await (navigator as Navigator&{clearAppBadge?:()=>Promise<void>}).clearAppBadge?.().catch(()=>{});
}
export async function enablePush():Promise<boolean>{
  if(!pushSupported())return false;
  if(await Notification.requestPermission()!=='granted')return false;
  const reg=await navigator.serviceWorker.register('/sw.js');
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Reminders are not ready. Try again.')),8000);})]);}finally{clearTimeout(timer);}
  const existing=await reg.pushManager.getSubscription();
  const sub=existing??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key()});
  try{
    const revision=await pushRevision(null,returnUrl());
    await send(sub.endpoint,0,revision);endpoint=sub.endpoint;intent++;report('');return true;
  }catch(error){if(!existing)await sub.unsubscribe().catch(()=>{});throw error;}
}
export async function disablePush(){
  const sub=await subscription(),to=sub?.endpoint??endpoint;
  // Unsubscribing stops browser delivery even if server cleanup is offline.
  if(sub&&!await sub.unsubscribe()&&await subscription())throw new Error('Could not turn off calls. Try again in browser settings.');
  endpoint=null;intent++;
  await closeShownCalls();
  try{await caches.delete('dog-push');}catch{/* Unsubscription still stops delivery if local cache access is blocked. */}
  try{const revision=await pushRevision(null,returnUrl());if(to)await send(to,null,revision);}catch{/* An unsubscribed endpoint cannot receive calls; the provider cleans it up. */}
  report('');
}
/** Cache the endpoint before leaving; refresh the small worker without reloading the dog. */
export async function rememberEndpoint(){
  const mine=intent,sub=await subscription().catch(()=>null);if(mine!==intent)return;
  endpoint=sub?.endpoint??null;
  if(endpoint)void navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
async function someoneVisible():Promise<boolean>{
  if(document.visibilityState==='visible')return true;
  const reg=await navigator.serviceWorker.getRegistration(),worker=reg?.active;
  if(!worker)throw new Error('Open the app again to refresh reminders.');
  return new Promise((resolve,reject)=>{
    const channel=new MessageChannel(),timeout=setTimeout(()=>{channel.port1.close();reject(new Error('Open the app again to refresh reminders.'));},1500);
    channel.port1.onmessage=e=>{clearTimeout(timeout);channel.port1.close();typeof e.data?.visible==='boolean'?resolve(e.data.visible):reject(new Error('Reminder visibility could not be checked'));};
    worker.postMessage({type:'dog-push-visible'},[channel.port2]);
  });
}
/** A missed call is an invitation to return, not a claim about today's exact needs. */
export async function scheduleCall(state:PetState,name:string){
  const to=endpoint,mine=++intent;if(!to)return;
  try{
    const now=Date.now(),next=nextCallAt(state,now,t=>t);
    const schedule=next?buildPushSchedule(next.at,followupEnabled(),now):0;
    const note:PushNote|null=next?{title:`${name} would like to see you`,body:'A little care and company? Open your dog to check in.',url:returnUrl()}:null;
    const revision=await pushRevision(note,returnUrl());if(mine!==intent)return;
    // Reserve the intent before asking the worker. A return during that async
    // check gets a higher revision; a return before it is seen by the worker.
    if(await someoneVisible()){if(mine===intent)await clearCall();return;}
    if(mine!==intent)return;
    await send(to,schedule,revision);if(mine===intent)report('');
  }catch(error){if(mine===intent&&!(error instanceof StaleSchedule))report(error instanceof Error?error.message:'Could not schedule a call. Try again.');}
}
/** Return/disable intent fences any delayed schedule request, including other tabs. */
export async function clearCall(){
  const to=endpoint,mine=++intent;void closeShownCalls();if(!to)return;
  try{const revision=await pushRevision(null,returnUrl());await send(to,0,revision);if(mine===intent)report('');}
  catch(error){if(mine===intent&&!(error instanceof StaleSchedule))report(error instanceof Error?error.message:'Could not clear reminders. Try again.');}
}
