import {householdDefaults,modeKey,playMode,readAdoption,OWN_SAVE_KEY} from './playMode';
import {dayKey} from '../domain/attention';
import type {PetState} from '../domain/types';
import type {DogProfile} from '../types/dog';
import {createPetState,decay,happiness} from '../domain/pet';
import {DEFAULT_DOGS} from '../data/defaultDogs';
import {loadStoredDogs,loadStoredPetStates,normalizeDogs,normalizePetStates} from './dogCalculators';
import {readSave,SAVE_KEY,validSave} from './saveFormat';
export type PetMutation=(latest:PetState)=>PetState;
export type CommitPet=(update:PetMutation)=>Promise<PetState|null>;
export type DogMutation=(latest:DogProfile)=>DogProfile;
export type CommitDog=(update:DogMutation)=>Promise<boolean>;

let connection:Promise<IDBDatabase>|undefined;
function mutexDatabase():Promise<IDBDatabase>{
  if(!connection)connection=new Promise<IDBDatabase>((resolve,reject)=>{
    let abandoned=false;
    const request=indexedDB.open('canine_os_progress_mutex',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('writer');
    request.onerror=()=>{connection=undefined;reject(request.error);};
    request.onblocked=()=>{abandoned=true;connection=undefined;reject(new Error('Another tab is holding the save database. Reload it and try again.'));};
    request.onsuccess=()=>{const db=request.result;if(abandoned){db.close();return;}db.onclose=()=>{connection=undefined;};db.onversionchange=()=>{db.close();connection=undefined;};resolve(db);};
  });
  return connection;
}

/** Progress and owner-record writers share one scope. No async work belongs in the reducer. */
async function exclusive<T>(work:()=>T):Promise<T>{
  const db=await mutexDatabase();
  return new Promise<T>((resolve,reject)=>{
    const tx=db.transaction('writer','readwrite');let finished=false;
    const timeout=window.setTimeout(()=>{if(!finished){finished=true;reject(new Error('The save is busy. Please try again.'));tx.abort();}},10_000);
    const request=tx.objectStore('writer').get('mutex');
    request.onsuccess=()=>{
      if(finished)return;
      window.clearTimeout(timeout);
      try{const result=work();finished=true;resolve(result);}
      catch(error){finished=true;reject(error);tx.abort();}
    };
    tx.onabort=()=>{window.clearTimeout(timeout);if(!finished){finished=true;reject(tx.error??new Error('The save could not acquire its lock.'));}};
    tx.onerror=()=>{window.clearTimeout(timeout);if(!finished){finished=true;reject(tx.error??new Error('The save database is unavailable.'));}};
  });
}

function current(){
  try{
  const raw=readSave(); // Reject damaged canonical data instead of overwriting it with defaults.
  if(raw)return {version:3 as const,revision:raw.revision,...(playMode()==='own'?{adoption:readAdoption()}:{}),dogs:normalizeDogs(raw.dogs,householdDefaults(),true),pets:normalizePetStates(raw.pets,true)};
  if(!raw){
    for(const [key,array] of [['canine_os_dogs_v1',true],['canine_os_pet_states_v1',false]] as const){
      const legacy=localStorage.getItem(modeKey(key));if(legacy===null)continue;
      const parsed=JSON.parse(legacy);
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)!==array||Object.values(parsed).some(item=>!item||typeof item!=='object'||Array.isArray(item)))throw new Error('Older saved progress needs recovery; no data was replaced.');
    }
  }
  return {version:3 as const,revision:0,...(playMode()==='own'?{adoption:readAdoption()}:{}),dogs:loadStoredDogs(householdDefaults(),true),pets:loadStoredPetStates(true)};
  }catch(error){throw new Error('Saved progress needs recovery; no data was replaced.',{cause:error});}
}
function write(save:ReturnType<typeof current>){
  if(!validSave(save))throw new Error('Saved progress needs recovery; no data was replaced.');
  localStorage.setItem(SAVE_KEY,JSON.stringify({...save,revision:save.revision+1}));
  // Signed-in owners push this to the cloud a few seconds later (utils/cloud.ts).
  window.dispatchEvent(new Event('tdc-saved'));
}

export function mutatePet(id:string,update:PetMutation,care?:'feed'|'play'|'walk'|'groom'):Promise<PetState>{
  return exclusive(()=>{
    const save=current(),now=Date.now();
    if(!save.dogs.some(dog=>dog.id===id))throw new Error('This dog is no longer in the saved record.');
    let initial=save.pets[id];
    if(!initial){initial=createPetState(now);const adoption=playMode()==='own'?readAdoption():null;if(adoption)initial={...initial,growth:{adoptedAt:adoption.at,seed:adoption.seed,careDays:[],day:dayKey(now),daySeconds:0}};}
    const before=decay(initial,now),next=update(before);
    save.pets[id]=next;
    const lastKey=care&&next!==before&&!(care==='feed'&&next.needs.hunger<=before.needs.hunger)?({feed:'lastFed',play:'lastPlayed',walk:'lastWalked',groom:'lastGroomed'} as const)[care]:undefined;
    save.dogs=save.dogs.map(dog=>dog.id!==id?dog:{...dog,tamagotchi:{...dog.tamagotchi,
      hunger:next.needs.hunger,energy:next.needs.energy,hygiene:next.needs.hygiene,happiness:Math.round(happiness(next)),
      ...(lastKey?{[lastKey]:now}:{})}});
    write(save);return next;
  });
}
export function mutateDogs(update:(latest:DogProfile[])=>DogProfile[]):Promise<void>{
  return exclusive(()=>{const save=current();save.dogs=update(save.dogs);write(save);});
}
export function resetProgress():Promise<void>{
  return exclusive(()=>{const save=current();save.dogs=householdDefaults();delete save.pets[save.dogs[0].id];write(save);});
}

/** Complete owned-pet backup, including adoption identity and learned personality. */
export function ownedBackup(){
 const raw=localStorage.getItem(OWN_SAVE_KEY),save=raw?JSON.parse(raw):null,adoption=readAdoption();
 if(!validSave(save)||!adoption)throw new Error('No complete owned-dog save is available yet.');
 return validateOwnedBackup(JSON.stringify({format:'tama-dog-chi-owned-v1',adoption,save}));
}
export function validateOwnedBackup(raw:string){
 const data=JSON.parse(raw),a=data?.adoption;
 if(data?.format!=='tama-dog-chi-owned-v1'||!validSave(data.save)||!a||typeof a.dogId!=='string'||!Number.isFinite(a.at)||typeof a.seed!=='string'||!DEFAULT_DOGS.some(d=>d.id===a.dogId)||!data.save.dogs.some((d:unknown)=>(d as DogProfile).id===a.dogId))throw new Error('This is not a complete Tama-Dog-Chi owned-dog backup.');
 const pet=data.save.pets[a.dogId],growth=pet?.growth;
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const personality=object(pet)&&object(pet.personality)?pet.personality:null;
 if(!object(pet)||!personality||!['boldness','sociability','foodDrive','playDrive','sensitivity'].every(k=>Number.isFinite(personality[k]))||!object(growth)||growth.seed!==a.seed||growth.adoptedAt!==a.at||!Array.isArray(growth.careDays)||growth.careDays.length>7||growth.careDays.some((day:unknown)=>typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))||new Set(growth.careDays).size!==growth.careDays.length||typeof growth.day!=='string'||!Number.isFinite(growth.daySeconds)||Number(growth.daySeconds)<0)throw new Error('This backup is missing the adopted dog’s personality or growth record. Your current dog was not changed.');
 return data as {format:string;adoption:NonNullable<ReturnType<typeof readAdoption>>;save:ReturnType<typeof current>};
}
export function restoreOwnedBackup(raw:string):Promise<void>{
 const data=validateOwnedBackup(raw);
 return exclusive(()=>{const old=localStorage.getItem(OWN_SAVE_KEY),existing=old?JSON.parse(old):null;localStorage.setItem(OWN_SAVE_KEY,JSON.stringify({...data.save,adoption:data.adoption,revision:Math.max(data.save.revision,validSave(existing)?existing.revision:0)+1}));});
}
