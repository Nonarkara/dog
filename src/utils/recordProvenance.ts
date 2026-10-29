import type {DogProfile} from '../types/dog';
import {DEFAULT_DOGS} from '../data/defaultDogs';
export const CLINICAL_FIELDS=['birthDate','isNeutered','microchipId','weightKg','primaryVetClinic','emergencyPhone'] as const;
export type ClinicalField=typeof CLINICAL_FIELDS[number];
const sameEntry=(a:object,b:object)=>JSON.stringify(Object.entries(a).sort(([x],[y])=>x.localeCompare(y)))===JSON.stringify(Object.entries(b).sort(([x],[y])=>x.localeCompare(y)));
/** Source evidence, not a clinical verification. Deriving it never rewrites owner data. */
export function recordSources(dog:DogProfile){
 const starter=DEFAULT_DOGS.find(d=>d.id===dog.id);
 const fields=CLINICAL_FIELDS.filter(key=>{
  if(!starter||key==='isNeutered'&&dog.id==='mali-2022')return false; // Owner explicitly supplied Mali's sterilisation.
  const value=starter[key];
  return value!==''&&value!==0&&value!==null&&dog[key]===value;
 });
 const matches=(key:'vaccinations'|'parasiteControl'|'medicalHistory')=>dog[key].filter(entry=>starter?.[key].some(original=>sameEntry(entry,original))).map(entry=>entry.id);
 return {fields,vaccinations:matches('vaccinations'),parasiteControl:matches('parasiteControl'),medicalHistory:matches('medicalHistory')};
}
export function recordExport(dog:DogProfile){
 return {...dog,recordSources:{notice:'Health facts are unverified. Exact bundled starter examples are listed below; other values are owner-entered or imported, not independently verified.',starterExamples:recordSources(dog)}};
}
