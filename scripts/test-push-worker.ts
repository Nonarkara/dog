/** Execute the actual service-worker script with local storage/notification
 * fixtures. No real push, browser permission or visible OS alert is used. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('public/sw.js','utf8');
type Card={title:string;options:Record<string,any>};
async function fixture(stored:unknown,{hour=12,visible=false,cacheFault=false}: {hour?:number;visible?:boolean;cacheFault?:boolean}={}){
  const listeners:Record<string,(e:any)=>void>={},cards:Card[]=[],opened:string[]=[],focused:string[]=[];
  let badge=0,windows:any[]=[];
  const indexedDB={open(){
    const request:any={};
    queueMicrotask(()=>{
      request.result={close(){},transaction(){
        const tx:any={};
        tx.objectStore=()=>({get(){const r:any={};queueMicrotask(()=>{r.result=stored;r.onsuccess?.();tx.oncomplete?.();});return r;}});
        return tx;
      }};
      request.onsuccess();
    });
    return request;
  }};
  const self={location:{origin:'https://dog.example'},navigator:{setAppBadge:async()=>{badge++;}},registration:{showNotification:async(title:string,options:Card['options'])=>{cards.push({title,options});}},addEventListener:(name:string,fn:(e:any)=>void)=>{listeners[name]=fn;},clients:{claim:async()=>{},matchAll:async()=>windows,openWindow:async(url:string)=>{opened.push(url);}},skipWaiting:async()=>{}};
  const TestDate=class extends Date{constructor(){super(2026,10,5,hour);}};
  const caches={open:async()=>{if(cacheFault)throw new Error('Cache unavailable');return{match:async()=>({json:async()=>{throw new Error('Corrupt cache');}})}}};
  vm.runInNewContext(source,{self,indexedDB,caches,URL,Date:TestDate,setTimeout,clearTimeout});
  const fire=async(name:string,extra:Record<string,any>={})=>{let work:Promise<unknown>=Promise.resolve();listeners[name]({...extra,waitUntil:(p:Promise<unknown>)=>{work=p;}});await work;};
  windows=visible?[{visibilityState:'visible',url:'https://dog.example/?mode=play',focus:async()=>{focused.push('play');}}]:[];
  return{cards,opened,focused,fire,getBadge:()=>badge,setWindows:(v:any[])=>{windows=v;}};
}
const note={revision:10,url:'/?mode=own&source=call',note:{title:'Mochi would like to see you',body:'A little care and company?',url:'/?mode=own&source=call'}};
for(const hour of[2,12,22]){
  const f=await fixture(note,{hour});await f.fire('push');assert.equal(f.cards.length,1,'Every received push is visible');
  assert.equal(f.cards[0].options.silent,hour<7||hour>=22,'Late cards remain silent');assert.equal(f.cards[0].options.renotify,false);
  assert.equal(f.cards[0].options.data.url,'/?mode=own&source=call');assert.equal(f.cards[0].options.tag,'dog-call');
}
const foreground=await fixture(note,{visible:true});await foreground.fire('push');assert.equal(foreground.cards[0].options.silent,true);assert.equal(foreground.getBadge(),0,'A stale foreground delivery does not set a new badge');
const cleared=await fixture({...note,note:null});await cleared.fire('push');assert.equal(cleared.cards[0].title,'Tama-Dog-Chi');assert.equal(cleared.cards[0].options.data.url,'/?mode=own&source=call','Clear removes personal words but keeps the correct return mode');
const corrupt=await fixture(null,{cacheFault:true});await corrupt.fire('push');assert.equal(corrupt.cards.length,1);assert.equal(corrupt.cards[0].title,'Tama-Dog-Chi');
const link=await fixture(note);let closed=0;
link.setWindows([{url:'https://dog.example/?mode=play',focus:async()=>{link.focused.push('wrong');}},{url:'https://dog.example/?mode=own',focus:async()=>{link.focused.push('own');}}]);
await link.fire('notificationclick',{notification:{close:()=>{closed++;},data:{url:'/?mode=own&source=call'}}});assert.deepEqual(link.focused,['own']);assert.deepEqual(link.opened,[]);assert.equal(closed,1);
link.setWindows([{url:'https://dog.example/?mode=play',focus:async()=>{link.focused.push('wrong');}}]);
await link.fire('notificationclick',{notification:{close(){},data:{url:'/?mode=own&source=call'}}});assert.deepEqual(link.opened,['/?mode=own&source=call'],'Another-mode tab is not hijacked');
await link.fire('notificationclick',{notification:{close(){},data:{url:'https://evil.example/?mode=own'}}});assert.equal(link.opened.at(-1),'/?source=call');
const presence=await fixture(note,{visible:true});let answer:any;
await presence.fire('message',{data:{type:'dog-push-visible'},ports:[{postMessage:(data:any)=>{answer=data;}}]});assert.equal(answer.visible,true);
console.log('PASS actual SW visible/silent cards, corrupt-cache fallback, privacy clear, owned/play return routing, URL allowlist and visible-client guard');
