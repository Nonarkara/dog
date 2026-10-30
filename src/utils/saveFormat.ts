import {modeKey} from './playMode';
export const SAVE_KEY=modeKey('canine_os_save_v3');
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function validPet(value:unknown):boolean{
  if(!object(value)||!object(value.needs)||!object(value.behaviours))return false;
  const needs=value.needs;
  return ['hunger','energy','hygiene'].every(key=>Number.isFinite(needs[key]))
    &&['updatedAt','trust','arousal'].every(key=>Number.isFinite(value[key]))
    &&Object.values(value.behaviours).every(object);
}
interface SaveEnvelope {version:3;revision:number;dogs:unknown[];pets:Record<string,unknown>}
export function validSave(value:unknown):value is SaveEnvelope {
  return object(value)&&value.version===3&&typeof value.revision==='number'&&Number.isSafeInteger(value.revision)&&value.revision>=0
    &&Array.isArray(value.dogs)&&value.dogs.length>0&&value.dogs.every(dog=>object(dog)&&typeof dog.id==='string')
    &&object(value.pets)&&Object.values(value.pets).every(validPet);
}
/** Refuse structural damage rather than falling back and overwriting progress. */
export function readSave():SaveEnvelope|null {
  const raw=localStorage.getItem(SAVE_KEY);
  if(raw===null)return null;
  const value=JSON.parse(raw);
  if(!validSave(value)){
    throw new Error('Saved progress needs recovery; no data was replaced.');
  }
  return value;
}
