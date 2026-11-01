/**
 * Opt-in calls when the app is closed (worker/push.ts has the server half).
 *
 * When you leave, the phone works out when he will next need you, saves the
 * words for that call on the phone, and tells the server only *when*. When
 * you come back, the pending call is cleared.
 */
import type {PetState} from '../domain/types';
import {nextCallAt} from '../domain/life';
import {CALL_TEXT} from '../domain/attention';
import {VAPID_PUBLIC} from './vapidPublic';

export const pushSupported=()=>typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
/** iPhone only allows web push from an app added to the Home Screen. */
export const needsInstall=()=>typeof navigator!=='undefined'&&(/iPhone|iPad/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1))&&!(navigator as Navigator&{standalone?:boolean}).standalone;

const key=()=>Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const post=(endpoint:string,at:number|null)=>fetch('/api/push',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint,at})}).catch(()=>{});

async function subscription(){
  if(!pushSupported()||Notification.permission!=='granted')return null;
  const reg=await navigator.serviceWorker.getRegistration();
  return reg?.pushManager.getSubscription()??null;
}
export async function pushEnabled(){return !!(await subscription().catch(()=>null));}

export async function enablePush():Promise<boolean>{
  if(!pushSupported())return false;
  if(await Notification.requestPermission()!=='granted')return false;
  const reg=await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub=(await reg.pushManager.getSubscription())??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key()});
  endpoint=sub.endpoint;await post(sub.endpoint,0);
  return true;
}
export async function disablePush(){
  const sub=await subscription().catch(()=>null);if(!sub)return;
  endpoint=null;await post(sub.endpoint,null);await sub.unsubscribe().catch(()=>{});
}

// The endpoint is kept in memory so leaving can post at once, before the page is frozen.
let endpoint:string|null=null;
export async function rememberEndpoint(){endpoint=(await subscription().catch(()=>null))?.endpoint??null;}
/** On leaving: the time of his next call (posted first), and its words saved on this phone. */
export function scheduleCall(state:PetState,name:string){
  if(!endpoint)return;
  const next=nextCallAt(state,Date.now());
  void post(endpoint,next?next.at:0);
  if(next)void caches.open('dog-push').then(c=>c.put('/push-note',new Response(JSON.stringify({title:`${name} is calling`,body:`${name} ${CALL_TEXT[next.reason]}.`})))).catch(()=>{});
}
/** On return: nothing pending while you are here. */
export function clearCall(){if(endpoint)void post(endpoint,0);}
