import {ownedBackup} from './progressStore';

/** Export the validated companion save, including personality and adoption identity. */
export function downloadOwnedBackup(name:string){
 const data=ownedBackup();
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const anchor=document.createElement('a');
 anchor.href=url;
 anchor.download=`Tama-Dog-Chi-${name}-backup.json`;
 document.body.appendChild(anchor);
 anchor.click();
 anchor.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
