/** Reminders earn a quiet invitation after the first answered care call. */
import React,{useEffect,useState} from 'react';
import {Bell,BellOff} from 'lucide-react';
import {enablePush,disablePush,pushEnabled,pushSupported,needsInstall,followupEnabled,setFollowupEnabled,pushProblem} from '../utils/push';

export const PushOffer:React.FC<{name:string;answered:number;detail:boolean}>=({name,answered,detail})=>{
  const [on,setOn]=useState<boolean|null>(null),[busy,setBusy]=useState(false);
  const [followup,setFollowup]=useState(followupEnabled),[note,setNote]=useState('');
  useEffect(()=>{
    let live=true;void pushEnabled().then(enabled=>{if(live)setOn(enabled);});
    const refresh=()=>{setFollowup(followupEnabled());setNote(pushProblem());void pushEnabled().then(enabled=>{if(live)setOn(enabled);});};
    const visibility=()=>{if(document.visibilityState==='visible')refresh();};
    window.addEventListener('tdc-push-status',refresh);window.addEventListener('storage',refresh);
    document.addEventListener('visibilitychange',visibility);
    return()=>{live=false;window.removeEventListener('tdc-push-status',refresh);window.removeEventListener('storage',refresh);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  if(on===null||(!answered&&!on&&!note))return null;
  if(needsInstall()&&!on)return detail?<p className="push-offer">Calls on iPhone: Share → Add to Home Screen, then open your dog from there.</p>:null;
  if(!pushSupported())return null;
  const change=async()=>{
    setBusy(true);setNote('');
    try{
      if(on){await disablePush();setOn(false);setNote('Calls turned off.');}
      else{const ok=await enablePush();setOn(ok);setNote(ok?'Calls are on.':'Not turned on. You can allow notifications in browser settings.');}
    }catch(error){setNote(error instanceof Error?error.message:'Could not change calls. Try again.');}
    finally{setBusy(false);}
  };
  // Enabled calls remain manageable after switching to a dog with no answered
  // calls. A success message must never replace its Turn off control.
  return <div className="push-offer" aria-busy={busy}>
    <div className="push-offer-controls"><button type="button" className="btn-quiet border-hairline" disabled={busy} aria-label={on?`Turn off calls for this browser`:`Let ${name} call when the app is closed`} onClick={()=>void change()}>{on?<BellOff size={15} aria-hidden="true"/>:<Bell size={15} aria-hidden="true"/>}{busy?'One moment…':on?'Turn off calls':'Calls when away'}</button>
    {on&&detail&&<label><input type="checkbox" checked={followup} disabled={busy} onChange={e=>{try{setFollowupEnabled(e.target.checked);setFollowup(e.target.checked);setNote('Applies next time you leave.');}catch{setNote('Could not save that choice. Try again.');}}}/>One gentle follow-up</label>}</div>
    {on&&detail&&<p>Scheduled 07:00–22:00 in your device’s time. Up to {followup?'two calls':'one call'} while away; delivery can be delayed.</p>}
    {!on&&<p>One daytime call while away. A follow-up is optional.</p>}
    {!on&&Notification.permission==='denied'&&<p>Calls are blocked in browser settings.</p>}
    {note&&<p role="status">{note}</p>}
  </div>;
};
