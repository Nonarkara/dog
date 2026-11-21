/** Pure cloud/backup boundary. No browser storage or game initialization imports. */
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const day=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
/** Revisions count saves one at a time; nothing honest reaches a million million. */
export const MAX_REVISION=1e12;
/** Needs, trust and arousal all live on the game's 0..100 scale (pet.ts clamp). */
const meter=(value:unknown):value is number=>finite(value)&&value>=0&&value<=100;
function validPet(value:unknown,strict:boolean):boolean{
 if(!object(value)||!object(value.needs)||!object(value.behaviours))return false;
 const scale=strict?meter:finite;
 return ['hunger','energy','hygiene'].every(key=>scale((value.needs as Record<string,unknown>)[key]))
  &&['trust','arousal'].every(key=>scale(value[key]))
  &&finite(value.updatedAt)
  &&Object.values(value.behaviours).every(object);
}
export interface OwnedBackupEnvelope {
 format:'tama-dog-chi-owned-v1';
 adoption:{dogId:string;at:number;seed:string;name?:string};
 save:{version:3;revision:number;dogs:{id:string}[];pets:Record<string,unknown>};
}
/** The same adopted identity must be present in the envelope and growth record.
 * `strict` is the server's write path: meters must be on the 0..100 scale. Reading
 * an old backup or an old cloud row stays lenient, so nobody is locked out of
 * their own dog. A save stamped by a fast clock is not refused here: decay()
 * resumes such a dog from now, on every device, which cannot lose a save. */
export function validOwnedBackup(value:unknown,allowedDogIds:readonly string[],strict=false):value is OwnedBackupEnvelope{
 if(!object(value)||value.format!=='tama-dog-chi-owned-v1'||!object(value.adoption)||!object(value.save))return false;
 const a=value.adoption,s=value.save;
 if(typeof a.dogId!=='string'||!allowedDogIds.includes(a.dogId)||!finite(a.at)||typeof a.seed!=='string'||!a.seed||a.seed.length>256)return false;
 if(s.version!==3||!Number.isSafeInteger(s.revision)||Number(s.revision)<0||Number(s.revision)>MAX_REVISION||!Array.isArray(s.dogs)||!s.dogs.length||!s.dogs.every(d=>object(d)&&typeof d.id==='string')||!s.dogs.some(d=>d.id===a.dogId)||!object(s.pets)||!Object.values(s.pets).every(pet=>validPet(pet,strict)))return false;
 const pet=s.pets[a.dogId];if(!object(pet)||!object(pet.personality)||!object(pet.growth))return false;
 const personality=pet.personality,growth=pet.growth;
 return ['boldness','sociability','foodDrive','playDrive','sensitivity'].every(key=>finite(personality[key]))
  &&growth.seed===a.seed&&growth.adoptedAt===a.at&&Array.isArray(growth.careDays)&&growth.careDays.length<=28
  &&growth.careDays.every(day)&&new Set(growth.careDays).size===growth.careDays.length
  &&day(growth.day)&&finite(growth.daySeconds)&&growth.daySeconds>=0;
}
