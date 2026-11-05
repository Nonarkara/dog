/** Shared with sw.js. One atomic counter orders requests across tabs, slow
 * networks and clock changes. Notes never leave this browser. */
export interface PushNote {title:string;body:string;url:string;}
const DB='tdc-reminder-state';
let opening:Promise<IDBDatabase>|undefined;
function database(){
  const pending=opening??=new Promise<IDBDatabase>((resolve,reject)=>{
    let settled=false;
    const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);opening=undefined;reject(new Error('Reminder storage is unavailable'));};
    const timer=setTimeout(fail,8000);
    let request:IDBOpenDBRequest;
    try{request=indexedDB.open(DB,1);}catch{fail();return;}
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onsuccess=()=>{const db=request.result;if(settled){db.close();return;}settled=true;clearTimeout(timer);db.onversionchange=()=>{db.close();opening=undefined;};resolve(db);};
    request.onerror=request.onblocked=fail;
  });
  return pending.catch(error=>{if(opening===pending)opening=undefined;throw error;});
}
export async function pushRevision(note:PushNote|null|undefined,url:string,floor=0):Promise<number>{
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),get=store.get('current');
    const timer=setTimeout(()=>{try{tx.abort();}catch{}reject(new Error('Reminder storage is busy'));},8000);
    let revision=0;
    get.onsuccess=()=>{
      const old=get.result??{},previous=Number.isSafeInteger(old.revision)?old.revision:0;
      revision=Math.max(previous,Date.now(),floor)+1;
      if(!Number.isSafeInteger(revision)){tx.abort();return;}
      store.put({...old,revision,...(note===undefined?{}:{note,url:note===null?(old.url??url):url})},'current');
    };
    tx.oncomplete=()=>{clearTimeout(timer);resolve(revision);};
    tx.onerror=tx.onabort=()=>{clearTimeout(timer);reject(new Error('Could not save reminder settings'));};
  });
}
