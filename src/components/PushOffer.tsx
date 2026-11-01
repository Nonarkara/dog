/** "Let him call you when the app is closed." Offered only after you have answered a call in the app. */
import React,{useEffect,useState} from 'react';
import {enablePush,disablePush,pushEnabled,pushSupported,needsInstall} from '../utils/push';

export const PushOffer:React.FC<{name:string;answered:number;detail:boolean}>=({name,answered,detail})=>{
  const [on,setOn]=useState<boolean|null>(null);
  const [note,setNote]=useState('');
  useEffect(()=>{void pushEnabled().then(setOn);},[]);
  if(on===null||!answered)return null;
  if(on&&note)return <p className="push-offer" role="status">{note}</p>;
  if(on)return detail?<p className="push-offer">{name} can call you when the app is closed. <button type="button" className="btn-quiet" onClick={()=>void disablePush().then(()=>setOn(false))}>Turn off</button></p>:null;
  if(needsInstall())return detail?<p className="push-offer">To get {name}'s calls on iPhone: Share → Add to Home Screen, then open him from there.</p>:null;
  if(!pushSupported()||Notification.permission==='denied')return null;
  return <p className="push-offer"><button type="button" className="btn-quiet border-hairline" onClick={()=>void enablePush().then(ok=>{setOn(ok);setNote(ok?`Done. ${name} will call when he needs you — never 22:00–07:00.`:'Not turned on. You can allow notifications in the browser settings.');})}>Let {name} call you when the app is closed</button>{note&&<span role="status"> {note}</span>}</p>;
};
