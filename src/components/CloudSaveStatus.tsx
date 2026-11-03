import React,{useEffect,useRef,useState} from 'react';
import {CloudCheck,CloudUpload,CloudOff,HardDrive,X} from 'lucide-react';
import {readSyncStatus} from '../utils/cloud';
const messages={local:'Saved in this browser. Sign in from the welcome screen to enable account sync.',pending:'Saved in this browser. Account upload is pending; it runs about once a minute while you play.',saved:'Last upload reached your account. This browser also keeps your dog.',failed:'Account upload did not finish. Your browser save is safe; it will retry while you play. Export a backup in History & details.',conflict:'Another device has a newer dog save. Uploads are paused. Reopen Own mode to load it; export this browser’s dog first if you want to keep it.'};
export function CloudSaveStatus(){
 const [status,setStatus]=useState(readSyncStatus),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const update=()=>setStatus(readSyncStatus());window.addEventListener('tdc-cloud-status',update);return()=>window.removeEventListener('tdc-cloud-status',update);},[]);
 const Icon=status==='saved'?CloudCheck:status==='pending'?CloudUpload:status==='local'?HardDrive:CloudOff;
 return <><button type="button" className="btn-quiet cloud-save-status" data-sync-status={status} aria-label={`Dog save status: ${status}`} title={messages[status]} onClick={()=>dialog.current?.showModal()}><Icon size={16} aria-hidden="true"/></button><dialog ref={dialog} className="care-details-dialog cloud-save-dialog" aria-label="Your dog’s saves"><button type="button" className="btn-quiet care-details-close" aria-label="Close save status" onClick={()=>dialog.current?.close()}><X size={18}/></button><h2>Your dog’s saves</h2><p role="status">{messages[status]}</p><p>Closing the page cannot guarantee a final upload. Clearing browser data removes the local copy. Export a backup before switching devices or accounts.</p></dialog></>;
}
