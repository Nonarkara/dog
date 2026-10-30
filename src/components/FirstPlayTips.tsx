import React,{useState} from 'react';
import {Lightbulb,X} from 'lucide-react';
import {modeKey} from '../utils/playMode';
const TIPS={
 pet:{title:'Gentle company',text:'Stroke slowly. Each dog has a favorite spot—watch for a happy lean.'},
 clean:{title:'Clean little home',text:'The broom clears mess and cleans the coat. Regular cleanup protects game health.'},
 feed:{title:'Meals and rewards',text:'Keep regular meals. Use tiny training rewards from the daily allowance; never skip meals to force learning.'},
 coins:{title:'Your pantry',text:'Active time together earns paw coins. Six coins buy three meals; hungry dogs have an emergency bowl.'},
 play:{title:'A ball is a learned game',text:'New dogs watch it drop. Teach Fetch first, then help them catch left or right.'},
 walk:{title:'A sniff walk',text:'Tap the ground to explore. Gentle greetings build your dog’s social confidence.'},
 bed:{title:'Goodnight together',text:'Tuck your dog in when you settle down. Each dog has a wake habit; rest restores energy.'},
 wake:{title:'A little morning woof',text:'Opt in to wake-up barking. Keep the app open with sound allowed; this is not a lock-screen alarm.'},
 talk:{title:'Words become familiar',text:'Pair a short word with care. Repeating it patiently gives it meaning to this dog.'},
 calm:{title:'Reward relaxation',text:'Meet needs first, offer quiet time, then watch the body soften before giving a reward.'},
 coach:{title:'Watch, mark, reward',text:'Cue once, wait for the dog’s movement, mark that moment, then give the promised treat.'},
 record:{title:'Your dog’s notebook',text:'Identity, health notes and photos live here. Starter health examples are marked, not verified facts.'},
 care:{title:'Read the dog',text:'Six symbols show needs and mood. Follow the next-action sentence; History opens the full details.'},
 park:{title:'Your little universe',text:'Tap dogs to pet, ground to walk. Pinch or use ± to zoom; people and chat open below.'},
 dogs:{title:'Meet the pack',text:'Each dog keeps separate care, training and personality. Switching dogs never transfers progress.'},
 tricks:{title:'A little invitation',text:'Try a gesture and watch the response. Let a tired or unwell dog rest instead.'},
 nose:{title:'Clever nose',text:'Watch where the treat goes, then choose a cup. Sniffing games ease boredom.'},
 marker:{title:'That exact moment',text:'Your marker promises a reward. Follow it with a treat, even if your timing wasn’t perfect.'},
 treat:{title:'Keep your promise',text:'Deliver a small reward promptly after the marker. Start new skills with consistent rewards.'},
 zoom:{title:'Come closer',text:'Zoom changes the camera, not the dog. Find my dog brings your companion back into view.'},
} as const;
type TipKey=keyof typeof TIPS;
function seenTips():Partial<Record<TipKey,boolean>>{try{const raw=JSON.parse(localStorage.getItem(modeKey('tama_dog_chi_tips_v1'))||'{}');return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};}catch{return {};}}
export function useFirstPlayTips(){
 const [tip,setTip]=useState<TipKey|null>(null);
 const show=(key:TipKey)=>{const seen=seenTips();if(seen[key])return;setTip(key);try{localStorage.setItem(modeKey('tama_dog_chi_tips_v1'),JSON.stringify({...seen,[key]:true}));}catch{/* A guide preference must never block care or the canonical save. */}};
 const capture=(event:React.MouseEvent)=>{
  const element=event.target instanceof Element?event.target.closest('button,[role="tab"],input[type="checkbox"]'):null;if(!element)return;
  const label=(element.getAttribute('aria-label')||element.getAttribute('title')||element.textContent||'').trim();
  if(element.getAttribute('aria-controls')==='dog-switcher'){show('dogs');return;}
  if(element.closest('.dog-toys')){show(label==='Find the treat'?'nose':'tricks');return;}
  if(element.closest('.wake-bark')){show('wake');return;}
  if(element.getAttribute('role')==='tab'&&['Care','Coach','Record','Commons'].includes(label)){show(({Care:'care',Coach:'coach',Record:'record',Commons:'park'} as const)[label as 'Care'|'Coach'|'Record'|'Commons']);return;}
  if(/Open Commons park/.test(label)){show('park');return;}
  if(/Zoom in|Zoom out|Find my dog/.test(label)){show('zoom');return;}
  if(/Yes!.*mark/.test(label)){show('marker');return;}
  if(label==='Treat'){show('treat');return;}
  if(/Teach fetch|^Lure$/.test(label)){show('coach');return;}
  if(/3 meals/.test(label)){show('coins');return;}
  if(/Serve a meal|^Feed /.test(label)){show('feed');return;}
  if(/Tuck .+ in|^Put .+ to bed/.test(label)){show('bed');return;}
  if(/^Pet /.test(label)){show('pet');return;}
  if(/^Clean|^Groom/.test(label)){show('clean');return;}
  if(/^Play /.test(label)){show('play');return;}
  if(/^Walk /.test(label)){show('walk');return;}
  if(/Talk to your dog|^Say a word/.test(label)){show('talk');return;}
  if(/Quiet time|Watch calm|Reward calm/.test(label))show('calm');
 };
 return {tip,show,capture,close:()=>setTip(null)};
}
export function FirstPlayTip({tip,onClose}:{tip:TipKey;onClose:()=>void}){const t=TIPS[tip];return <aside className="first-play-tip" data-first-tip={tip} role="status" aria-label={`First-time tip: ${t.title}`}><Lightbulb size={17} aria-hidden="true"/><p><span className="label">{t.title}</span><span>{t.text}</span></p><button type="button" className="btn-quiet" aria-label="Got it, close this tip" onClick={onClose}><X size={17}/></button></aside>;}
