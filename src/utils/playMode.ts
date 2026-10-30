import {DEFAULT_DOGS} from '../data/defaultDogs';
import type {DogProfile} from '../types/dog';
export function playMode():'play'|'own' {return typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('mode')==='own'?'own':'play';}
export function modeKey(key:string){return playMode()==='own'?`${key}_owned_v1`:key;}
export const OWN_SAVE_KEY='canine_os_save_v3_owned_v1';
export const ADOPTION_KEY='tama_dog_chi_adoption_v1';
export interface Adoption {dogId:string;at:number;seed:string;
 /** The name the owner gave their dog; the household dog's name if none. */
 name?:string;}
/** A dog's name as typed: no markup, no control characters, at most 24 characters. */
export const cleanDogName=(v:unknown)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,24):'';
export function readAdoption():Adoption|null{try{const saved=JSON.parse(localStorage.getItem(OWN_SAVE_KEY)||'null');const a=saved?.adoption??JSON.parse(localStorage.getItem(ADOPTION_KEY)||'null');return a&&typeof a.dogId==='string'&&Number.isFinite(a.at)&&typeof a.seed==='string'&&DEFAULT_DOGS.some(d=>d.id===a.dogId)?a:null;}catch{return null;}}
export function householdDefaults():DogProfile[]{
 if(playMode()!=='own')return DEFAULT_DOGS;
 const a=readAdoption(),base=DEFAULT_DOGS.find(d=>d.id===a?.dogId);if(!base)return DEFAULT_DOGS;
 const name=cleanDogName(a?.name)||base.name;
 return [{...base,name,callName:name,birthDate:'',microchipId:'Not recorded',weightKg:0,isNeutered:null,primaryVetClinic:'',emergencyPhone:'',vaccinations:[],parasiteControl:[],medicalHistory:[],photos:[],primaryPhotoUrl:'',metaverseBio:name===base.name?`Your adopted virtual ${base.name}. Growing up together.`:`${name}, your own ${base.breed}. Growing up together.`,tamagotchi:{...base.tamagotchi,lastFed:0,lastPlayed:0,lastWalked:0,lastGroomed:0}}];
}
