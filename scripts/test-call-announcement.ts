import assert from 'node:assert/strict';
import {shouldAnnounceCall,type ObservedCall} from '../src/domain/callAnnouncement';
import {sound} from '../src/utils/proceduralAudio';
const now=100_000;
const empty:ObservedCall={dogId:'expo',call:undefined};
const fresh:ObservedCall={dogId:'expo',call:{reason:'hungry',since:now}};
assert(shouldAnnounceCall(empty,fresh,now,true),'a new visible call is announced');
assert(!shouldAnnounceCall(fresh,fresh,now,true),'initial saved call and ordinary rerenders stay silent');
assert(!shouldAnnounceCall(fresh,{...fresh,dogId:'oreo'},now,true),'switching dogs is silent even with equal timestamps');
assert(!shouldAnnounceCall(empty,fresh,now,false),'hidden calls are silent');
assert(!shouldAnnounceCall(fresh,fresh,now+1000,true),'showing the tab does not replay an observed call');
assert(!shouldAnnounceCall(empty,fresh,now+46_000,true),'a stale restored call is silent');
assert(!shouldAnnounceCall(empty,fresh,now-1,true),'future timestamps are silent');
assert(shouldAnnounceCall(fresh,{...fresh,call:{reason:'dirty',since:now}},now,true),'a different need can start at the same clock tick');
console.log('PASS new calls announce once; restoration, dog switching, hidden tabs and stale calls stay silent');

// Exercise the actual synthesizer, including suspended audio and node cleanup.
const priorWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
let contexts=0,resumes=0,disconnected=0;
const notes:number[]=[],ended:(()=>void)[]=[];
class AudioFixture {
  state='running';currentTime=0;destination={};
  constructor(){contexts++;}
  resume(){resumes++;return Promise.resolve();}
  createOscillator(){return {type:'sine',frequency:{setValueAtTime:(n:number)=>notes.push(n)},connect:()=>{},start:()=>{},stop:()=>{},disconnect:()=>{disconnected++;},set onended(fn:()=>void){ended.push(fn);}};}
  createGain(){return {gain:{setValueAtTime:()=>{},linearRampToValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},connect:()=>{},disconnect:()=>{disconnected++;}};}
}
try {
  Object.defineProperty(globalThis,'window',{value:{AudioContext:AudioFixture},configurable:true});
  sound.attention();assert.equal(contexts,0,'ambient call must not unlock audio');
  sound.markerClick();assert.equal(contexts,1,'a deliberate action can initialize audio');
  notes.length=0;sound.attention();assert.deepEqual(notes,[783.99,1046.5],'a new call has exactly two notes');
  ended.splice(0).forEach(fn=>fn());assert.equal(disconnected,6,'all three oscillator/gain pairs disconnect');
  // The fixture instance is only exposed here to represent a browser suspending it.
  const audio=sound as unknown as {ctx:AudioFixture};audio.ctx.state='suspended';
  notes.length=0;sound.attention();assert.equal(notes.length,0);assert.equal(resumes,0,'ambient call must not resume suspended audio');
  console.log('PASS call audio respects gesture/suspension and releases completed nodes');
} finally {
  if(priorWindow)Object.defineProperty(globalThis,'window',priorWindow);else Reflect.deleteProperty(globalThis,'window');
}
