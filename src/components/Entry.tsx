import React,{lazy,Suspense,useState} from 'react';
import {ArrowRight,Heart,Play,ArrowLeft,Upload} from 'lucide-react';
import {DEFAULT_DOGS} from '../data/defaultDogs';
import {dogTheme} from '../data/dogThemes';
import {ADOPTION_KEY,readAdoption} from '../utils/playMode';
const App=lazy(()=>import('../App').then(m=>({default:m.App})));
const art:Record<string,string>={'expo-2021':'expo','mali-2022':'mali','oreo-frenchie':'oreo','paolo-pug':'paolo','shiba-chai':'hachiku'};
export function Entry(){
 const mode=new URLSearchParams(location.search).get('mode'),adoption=readAdoption();
 const [choosing,setChoosing]=useState(mode==='own'&&!adoption),[selected,setSelected]=useState('oreo-frenchie'),[artReady,setArtReady]=useState(false),[error,setError]=useState(''),[restore,setRestore]=useState<{raw:string;name:string}|null>(null);
 if(mode==='play'||mode==='own'&&adoption)return <Suspense fallback={<main className="entry-loading" data-study-ready="false" data-workspace-loading="true">Opening Tama-Dog-Chi…</main>}><App/></Suspense>;
 const dog=DEFAULT_DOGS.find(d=>d.id===selected)!;
 const adopt=()=>{try{localStorage.setItem(ADOPTION_KEY,JSON.stringify({dogId:dog.id,at:Date.now(),seed:crypto.randomUUID()}));location.assign('/?mode=own');}catch{setError('This browser could not save your puppy. Allow browser storage and try again.');}};
 return <main className="entry cockpit" style={dogTheme(selected)} data-study-ready="true">
  <header className="entry-head"><h1>Tama-Dog-Chi</h1>{choosing&&<button type="button" className="btn-quiet" onClick={()=>setChoosing(false)}><ArrowLeft size={18}/>Back</button>}</header>
  <div className="entry-dog">{!artReady&&<svg className="entry-dog-skeleton" viewBox="0 0 400 320" aria-hidden="true"><path d="M105 113L83 57L137 81L175 48L185 121Q245 100 300 148Q332 100 348 126Q356 167 314 177L312 271H275L268 212H189L171 276H135L142 195Q84 203 70 159L42 145L67 125Z" fill="var(--stage-ground)" stroke="var(--border-dim)" strokeWidth="3"/></svg>}<img onLoad={()=>setArtReady(true)} onError={()=>setError('The preview could not load. You can still choose a mode or another dog.')} src={`/dogs/${art[selected]}.webp`} alt={`${dog.name}, your illustrated dog companion`} width="768" height="768" fetchPriority="high"/><span>{choosing?'A little dog. Your own story.':'A little company, whenever you need it.'}</span></div>
  <div className="entry-choices">
   {choosing?<>
    <div role="group" aria-label="Choose your puppy" className="adoption-dogs">{DEFAULT_DOGS.map(d=><button key={d.id} type="button" aria-pressed={selected===d.id} onClick={()=>{if(selected!==d.id){setArtReady(false);setSelected(d.id);setError('');}}}>{d.name}</button>)}</div>
    <p className="entry-note">{dog.breed} · Puppy → adult over 7 care days</p>
    <button type="button" className="entry-choice" onClick={adopt}><Heart size={22}/><span>Bring {dog.name} home<small>One minute of attention earns a care day.</small></span><ArrowRight size={22}/></button>
    <p className="entry-note">Saved in this browser. Clearing site data removes your dog; export progress to keep a copy.</p>
   </>:<>
    <a href="/?mode=play" className="entry-choice"><Play size={24}/><span>Play<small>Meet the pack. Pet, play, explore.</small></span><ArrowRight size={22}/></a>
    {adoption?<a href="/?mode=own" className="entry-choice"><Heart size={24}/><span>Your dog<small>Come home to {DEFAULT_DOGS.find(d=>d.id===adoption.dogId)?.name}.</small></span><ArrowRight size={22}/></a>:<button type="button" onClick={()=>setChoosing(true)} className="entry-choice"><Heart size={24}/><span>Own a dog<small>Raise your puppy. Shape a personality.</small></span><ArrowRight size={22}/></button>}
    <div className="entry-footer"><p className="entry-note">Your browser, your little world. No account needed.</p><label className="entry-restore"><Upload size={16}/><span>Restore</span><input type="file" accept=".json,application/json" className="sr-only" aria-label="Choose an owned-dog backup" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>5_000_000)throw new Error('That backup is too large.');const raw=await file.text(),{validateOwnedBackup}=await import('../utils/progressStore');const data=validateOwnedBackup(raw);setRestore({raw,name:DEFAULT_DOGS.find(d=>d.id===data.adoption.dogId)?.name??'your dog'});setError('');}catch(error){setError(error instanceof Error?error.message:'Could not read this backup.');}}}/></label></div>
    {restore&&<div className="restore-confirm"><p>Restore {restore.name}? This replaces the owned-dog save in this browser. Play stays separate.</p><button type="button" onClick={async()=>{try{const {restoreOwnedBackup}=await import('../utils/progressStore');await restoreOwnedBackup(restore.raw);location.assign('/?mode=own');}catch{setError('Could not restore this backup. The previous save is unchanged.');}}}>Restore {restore.name}</button><button type="button" onClick={()=>setRestore(null)}>Cancel</button></div>}
   </>}
   {error&&<p role="alert">{error}</p>}
  </div>
 </main>;
}
