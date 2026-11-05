import type {Call} from './attention';

export type ObservedCall = {dogId:string; call:Call|undefined};

/** Only a new call from the dog already on screen is news. Opening a save,
 * switching dogs and returning to a hidden tab are silent observations. */
export function shouldAnnounceCall(previous:ObservedCall,current:ObservedCall,now:number,visible:boolean):boolean {
  const call=current.call;
  return visible&&previous.dogId===current.dogId&&!!call&&
    (previous.call?.since!==call.since||previous.call?.reason!==call.reason)&&
    now>=call.since&&now-call.since<=45_000;
}
