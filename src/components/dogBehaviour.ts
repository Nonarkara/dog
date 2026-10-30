import type {PetState} from '../domain/types';
import {dailyMood} from '../domain/dailyLife';
/** Twenty everyday expressions, authored from body-language references in the design note.
 * These are context-dependent game animations, not a diagnostic body-language classifier. */
export const DOG_BEHAVIOURS=['watching','looking','sniffing','wandering','sitting','stretching','yawning','ear-twitch','head-tilt','tail-wag','shake','scratch','paw-screen','nose-nudge','play-bow','trotting','resting','sighing','sleeping','toileting'] as const;
export type DogBehaviour=typeof DOG_BEHAVIOURS[number];
export function behaviourPool(state:PetState):DogBehaviour[]{
 const mood=dailyMood(state);
 if(mood==='sleeping')return ['sleeping'];if(mood==='sick')return ['resting','sighing'];
 if(mood==='tired')return ['resting','yawning','sighing'];
 if(mood==='hungry'||state.call?.reason==='lonely')return ['paw-screen','nose-nudge','looking'];
 if(mood==='toilet')return ['sniffing','wandering'];
 if(mood==='bored')return ['paw-screen','head-tilt','sighing','nose-nudge'];
 const pool:DogBehaviour[]=['watching','looking','sniffing','wandering','sitting','ear-twitch','head-tilt','tail-wag','yawning','nose-nudge'];
 if(state.needs.hygiene<70)pool.push('scratch','shake');else pool.push('shake');
 if(state.needs.energy>45&&state.trust>50)pool.push('stretching','play-bow','trotting');
 if(state.needs.energy<65)pool.push('resting','sighing');
 return pool;
}
export function chooseBehaviour(state:PetState,previous:DogBehaviour,random=Math.random):{kind:DogBehaviour;duration:number}{
 const candidates=behaviourPool(state),pool=candidates.length>1?candidates.filter(k=>k!==previous):candidates;
 const kind=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
 return {kind,duration:kind==='wandering'||kind==='resting'?5.5:kind==='watching'?4:3};
}
