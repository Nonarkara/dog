import {clerkHost} from './emailConfig';
export const EMAIL_SESSION_KEY='tama_dog_chi_email_session';
interface ClerkSession {getToken:(options?:{skipCache?:boolean})=>Promise<string|null>;}
export interface EmailClient {
 load:(options:{ui:{ClerkUI:unknown};telemetry:false})=>Promise<void>;
 session:ClerkSession|null;
 mountSignIn:(element:HTMLElement,options:Record<string,unknown>)=>void;
 unmountSignIn:(element:HTMLElement)=>void;
 signOut:()=>Promise<void>;
}
declare global {interface Window {Clerk?:EmailClient;__internal_ClerkUICtor?:unknown;}}
let loading:Promise<EmailClient>|null=null;
export function bounded<T>(promise:Promise<T>,ms:number):Promise<T>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Secure sign-in took too long. Please try again.')),ms);promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});}
export const rememberedEmail=()=>{try{return localStorage.getItem(EMAIL_SESSION_KEY)==='1';}catch{return false;}};
export function rememberEmail(on:boolean){try{if(on)localStorage.setItem(EMAIL_SESSION_KEY,'1');else localStorage.removeItem(EMAIL_SESSION_KEY);}catch{/* Server authentication never depends on this preference. */}}
function script(src:string,key?:string){return new Promise<void>((resolve,reject)=>{const tag=document.createElement('script');tag.src=src;tag.async=true;tag.crossOrigin='anonymous';if(key)tag.setAttribute('data-clerk-publishable-key',key);const timer=setTimeout(()=>{tag.remove();reject(new Error('Email sign-in took too long. Please try again.'));},20000);tag.onload=()=>{clearTimeout(timer);resolve();};tag.onerror=()=>{clearTimeout(timer);tag.remove();reject(new Error('Email sign-in could not load. Please try again.'));};document.head.append(tag);});}
export function loadEmailClient():Promise<EmailClient>{
 if(loading)return loading;
 loading=(async()=>{
  const response=await fetch('/api/auth/email/config',{credentials:'same-origin',signal:AbortSignal.timeout(6000)});if(!response.ok)throw new Error('Email sign-in is not configured yet.');
  const {publishableKey}=await response.json() as {publishableKey:string},host=clerkHost(publishableKey);if(!host)throw new Error('Email sign-in is not configured correctly.');
  await script(`https://${host}/npm/@clerk/ui@1/dist/ui.browser.js`);
  await script(`https://${host}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`,publishableKey);
  if(!window.Clerk||!window.__internal_ClerkUICtor)throw new Error('Email sign-in could not start.');
  await bounded(window.Clerk.load({ui:{ClerkUI:window.__internal_ClerkUICtor},telemetry:false}),8000);return window.Clerk;
 })().catch(error=>{loading=null;throw error;});return loading;
}
/** Refresh the managed cookie before asking Cloudflare for the owner's dog. */
export async function resumeEmail(signal?:AbortSignal){
 if(!rememberedEmail())return;
 const clerk=await loadEmailClient();signal?.throwIfAborted();if(!clerk.session){rememberEmail(false);return;}
 const token=await bounded(clerk.session.getToken({skipCache:true}),5000);signal?.throwIfAborted();if(!token)throw new Error('Please sign in with email again.');
 const response=await fetch('/api/auth/email/session',{method:'POST',credentials:'same-origin',headers:{'X-TDC':'1','Authorization':`Bearer ${token}`},signal});
 if(!response.ok)throw new Error('Email sign-in could not be confirmed. Please try again.');
}
export async function emailAuthorization():Promise<Record<string,string>>{
 if(!rememberedEmail())return {};
 const token=await bounded((await loadEmailClient()).session?.getToken()??Promise.resolve(null),5000);if(!token)throw new Error('Please sign in with email again.');return {Authorization:`Bearer ${token}`};
}
export async function signOutEmail(){if(!rememberedEmail())return;const clerk=await loadEmailClient();await clerk.signOut();rememberEmail(false);}
