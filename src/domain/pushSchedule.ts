/** Delivery windows are calculated on the owner's device. The server receives
 * timestamps, never a location, timezone, dog name or reason for the call. */
export interface PushSchedule {at:number;until:number;followupAt:number;followupUntil:number;}
const SLOT=15*60_000,FOLLOWUP=90*60_000;
function localDaylight(at:number){
  const d=new Date(Math.ceil(at/SLOT)*SLOT);
  if(d.getHours()>=22){d.setDate(d.getDate()+1);d.setHours(7,0,0,0);}
  else if(d.getHours()<7)d.setHours(7,0,0,0);
  const end=new Date(d);end.setHours(22,0,0,0);
  return {at:d.getTime(),until:end.getTime()};
}
export function buildPushSchedule(at:number,followup:boolean,now=Date.now()):PushSchedule {
  if(!Number.isSafeInteger(at)||at<=0)throw new Error('Invalid reminder time');
  const limit=now+48*3600_000,first=localDaylight(at);
  if(!Number.isFinite(first.at)||first.at>=limit)throw new Error('Reminder too far away');
  const next=followup?localDaylight(first.at+FOLLOWUP):null;
  return {at:first.at,until:Math.min(first.until,limit),followupAt:next&&next.at<limit?next.at:0,followupUntil:next&&next.at<limit?Math.min(next.until,limit):0};
}
