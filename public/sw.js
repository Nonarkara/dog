// Calls are visible invitations, not an alarm. Scheduling stays on the device;
// payloadless push addresses on the server never contain a dog's name or needs.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
const safeTarget = (raw) => {
  try {
    const u=new URL(raw,self.location.origin),mode=u.searchParams.get('mode');
    if(u.origin===self.location.origin&&u.pathname==='/'&&(mode==='own'||mode==='play'))return `/?mode=${mode}&source=call`;
  } catch {}
  return '/?source=call';
};
// Same small local store as utils/pushState.ts. A clear/disable leaves only a
// revision and mode; it removes the personal note and fences older requests.
async function savedState(){
  return new Promise((resolve,reject)=>{
    let done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(new Error('Storage busy')),1000),request=indexedDB.open('tdc-reminder-state',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onerror=request.onblocked=()=>finish(new Error('Storage unavailable'));
    request.onsuccess=()=>{
      const db=request.result;if(done){db.close();return;}
      const tx=db.transaction('state','readonly'),get=tx.objectStore('state').get('current');
      get.onsuccess=()=>finish(null,get.result??null);get.onerror=()=>finish(new Error('Storage unreadable'));
      tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();finish(new Error('Storage unavailable'));};
    };
  });
}
async function notificationNote(){
  let stored;
  try{stored=await savedState();}catch{/* A visible generic call still works without storage. */}
  let note=stored?.note,url=stored?.url;
  if(!stored)try{const cached=await(await caches.open('dog-push')).match('/push-note');if(cached)note=await cached.json();}catch{/* Legacy/corrupt cache never prevents the visible fallback. */}
  return {title:typeof note?.title==='string'&&note.title.trim()?note.title.slice(0,80):'Tama-Dog-Chi',body:typeof note?.body==='string'&&note.body.trim()?note.body.slice(0,180):'Your dog would like some company. Open your dog to check in.',url:safeTarget(url??note?.url)};
}
self.addEventListener('message',e=>{
  if(e.data?.type!=='dog-push-visible'||!e.ports?.[0])return;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>e.ports[0].postMessage({visible:windows.some(c=>c.visibilityState==='visible')})).catch(()=>e.ports[0].postMessage({error:'Visibility unavailable'})));
});
self.addEventListener('push',e=>e.waitUntil((async()=>{
  const note=await notificationNote();
  let visible=false;try{visible=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).some(c=>c.visibilityState==='visible');}catch{}
  const hour=new Date().getHours(),silent=visible||hour<7||hour>=22;
  // Every received push remains visible (required by Web Push on Safari).
  // Late/foreground cards are silent; the browser may still delay delivery.
  if(!visible&&self.navigator.setAppBadge)self.navigator.setAppBadge(1).catch(()=>{});
  await self.registration.showNotification(note.title,{body:note.body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:'dog-call',renotify:false,silent,data:{url:note.url}});
})()));
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil((async()=>{
    const target=safeTarget(e.notification.data?.url),mode=new URL(target,self.location.origin).searchParams.get('mode');
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const open=windows.find(c=>{try{const u=new URL(c.url);return mode&&u.pathname==='/'&&u.searchParams.get('mode')===mode;}catch{return false;}});
    return open?open.focus():self.clients.openWindow(target);
  })());
});
