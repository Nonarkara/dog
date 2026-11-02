import React,{useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {loadEmailClient,rememberEmail,bounded,type EmailClient} from '../utils/emailClient';
export function EmailSignIn({back,onClose}:{back:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),host=useRef<HTMLDivElement>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[loading,setLoading]=useState(true);
 useEffect(()=>{dialog.current?.showModal();},[]);
 useEffect(()=>{let active=true,client:EmailClient|null=null;const target=host.current!;setLoading(true);setError('');
  loadEmailClient().then(async clerk=>{if(!active)return;client=clerk;rememberEmail(true);if(clerk.session){const token=await bounded(clerk.session.getToken({skipCache:true}),5000);if(!active)return;if(token){location.assign(back);return;}await bounded(clerk.signOut(),5000);if(!active)return;}
   const style=getComputedStyle(dialog.current!);
   clerk.mountSignIn(target,{routing:'virtual',forceRedirectUrl:back,signUpForceRedirectUrl:back,appearance:{variables:{fontFamily:style.fontFamily,colorPrimary:style.getPropertyValue('--accent').trim()||'#365f43',colorBackground:style.getPropertyValue('--bg-surface').trim()||'#fff9ed',colorText:style.color,borderRadius:'2px'}}});setLoading(false);
  }).catch(e=>{if(active){setLoading(false);setError(e instanceof Error?e.message:'Email sign-in could not load.');}});
  return()=>{active=false;if(client)client.unmountSignIn(target);};
 },[back,retry]);
 return <dialog ref={dialog} className="email-signin-dialog" aria-label="Email sign-in" onCancel={onClose}>
  <header><h2>Email sign-in</h2><button type="button" className="btn-quiet" aria-label="Close email sign-in" onClick={onClose}><X size={20}/></button></header>
  {loading&&<p role="status">Opening secure sign-in…</p>}
  {error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>}
  <div ref={host}/>
  <p className="email-signin-note">Clerk handles passwords and emailed recovery codes. Your dog stays on Cloudflare. Use the same sign-in method to return to the same dog.</p>
 </dialog>;
}
