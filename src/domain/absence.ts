import type {PetState} from './types';
import {dailyLife,dailyMood} from './dailyLife';
/** A return recap is a comparison, never an extra decay or a new care penalty. */
export function describeAbsence(before:PetState,after:PetState):string|null{
 const elapsed=after.updatedAt-before.updatedAt;
 if(!Number.isFinite(elapsed)||elapsed<30*60_000)return null;
 const hours=elapsed/3_600_000,span=hours>=36?`${Math.round(hours/24)} days`:hours>=1?`${Math.round(hours)} h`:`${Math.round(elapsed/60_000)} min`;
 const bits:string[]=[];
 for(const[key,label]of [['hunger','food'],['energy','energy'],['hygiene','clean']]as const){const d=Math.round(after.needs[key]-before.needs[key]);if(d)bits.push(`${label} ${d>0?'+':'−'}${Math.abs(d)}`);}
 const mess=(s:PetState)=>(s.poopCount??0)+dailyLife(s).peeCount,added=Math.max(0,mess(after)-mess(before));if(added)bits.push(`${added} new mess${added>1?'es':''}`);
 const mood=dailyMood(after);
 const next=after.away?'Find your dog in the park; gentle pets bring them home.':mood==='sleeping'?'Rest is restoring energy.':mood==='sick'?mess(after)?'Clean up first, then game medicine and rest.':'Game medicine and rest first.':mood==='hungry'?'Food first.':mood==='toilet'?'A toilet walk first.':mess(after)?'Clean up, then a little company.':mood==='tired'?'A little rest first.':'A little company is welcome.';
 return `While you were away (${span}): ${bits.join(', ')||'nothing urgent changed'}. ${next}`;
}
