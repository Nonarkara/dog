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
  if(raw)return {version:3 as const,revision:raw.revision,dogs:normalizeDogs(raw.dogs,DEFAULT_DOGS,true),pets:normalizePetStates(raw.pets,true)};
  if(!raw){
    for(const [key,array] of [['canine_os_dogs_v1',true],['canine_os_pet_states_v1',false]] as const){
      const legacy=localStorage.getItem(key);if(legacy===null)continue;
      const parsed=JSON.parse(legacy);
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)!==array||Object.values(parsed).some(item=>!item||typeof item!=='object'||Array.isArray(item)))throw new Error('Older saved progress needs recovery; no data was replaced.');
    }
  }
  return {version:3 as const,revision:0,dogs:loadStoredDogs(DEFAULT_DOGS,true),pets:loadStoredPetStates(true)};
  }catch(error){throw new Error('Saved progress needs recovery; no data was replaced.',{cause:error});}
}
function write(save:ReturnType<typeof current>){
  if(!validSave(save))throw new Error('Saved progress needs recovery; no data was replaced.');
  localStorage.setItem(SAVE_KEY,JSON.stringify({...save,revision:save.revision+1}));
}

export function mutatePet(id:string,update:PetMutation,care?:'feed'|'play'|'walk'|'groom'):Promise<PetState>{
  return exclusive(()=>{
    const save=current(),now=Date.now();
    if(!save.dogs.some(dog=>dog.id===id))throw new Error('This dog is no longer in the saved record.');
    const before=decay(save.pets[id]??createPetState(now),now),next=update(before);
    save.pets[id]=next;
    const lastKey=care&&next!==before?({feed:'lastFed',play:'lastPlayed',walk:'lastWalked',groom:'lastGroomed'} as const)[care]:undefined;
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
  return exclusive(()=>{const save=current();save.dogs=DEFAULT_DOGS;save.pets[DEFAULT_DOGS[0].id]=createPetState();write(save);});
}
