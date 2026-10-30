export type IdleAct='none'|'shift'|'look'|'sniff'|'pawtip'|'hop'|'bow'|'stretch';
export interface IdleState {name:IdleAct;start:number;dur:number;nextAt:number;yaw:number;wasAsleep:boolean;wakePending:boolean;starts:number}
export interface IdleContext {reduced:boolean;asleep:boolean;sick:boolean;busy:boolean;standing:boolean;energy:number;trust:number;arousal:number;fullness:number}
export function newIdle(random=Math.random):IdleState{return {name:'none',start:0,dur:0,nextAt:2.5+random()*3,yaw:0,wasAsleep:false,wakePending:false,starts:0};}
export const idleAllowed=(c:IdleContext)=>!c.reduced&&!c.asleep&&!c.sick&&!c.busy&&c.standing;
export function idlePool(c:IdleContext):IdleAct[]{
 const pool:IdleAct[]=['shift','look','sniff','shift','look'];
 if(c.energy>=.25)pool.push('pawtip');
 const playful=c.energy>=.5&&c.trust>=.55&&c.fullness>=.35;
 if(playful&&c.arousal>.55)pool.push('hop');
 if(playful&&c.arousal>.45)pool.push('bow','bow');
 return pool;
}
/** One act, then a real quiet interval. Wake stretches wait for body ownership. */
export function stepIdle(previous:IdleState,t:number,c:IdleContext,random=Math.random):IdleState{
 const s={...previous};
 if(s.wasAsleep&&!c.asleep)s.wakePending=true;
 s.wasAsleep=c.asleep;
 if(c.asleep||c.sick||c.reduced)s.wakePending=false;
 if(!idleAllowed(c)){s.name='none';s.nextAt=Math.max(s.nextAt,t+.75);return s;}
 if(s.name!=='none'&&t-s.start>=s.dur)s.name='none';
 if(s.wakePending){s.name='stretch';s.start=t;s.dur=2.6;s.nextAt=t+s.dur+2;s.starts++;s.wakePending=false;}
 else if(s.name==='none'&&t>=s.nextAt){
  const pool=idlePool(c);s.name=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];s.start=t;
  s.dur=s.name==='bow'?2.4:s.name==='sniff'?2.8:s.name==='look'?2.2:1.4+random()*.8;
  s.yaw=s.name==='look'?(random()<.5?-1:1)*(.3+random()*.3):0;
  s.nextAt=t+s.dur+1.5+random()*3.5/(.5+c.arousal);s.starts++;
 }
 return s;
}
export function idleWeight(s:IdleState,t:number){
 if(s.name==='none')return 0;
 const x=Math.max(0,Math.min(1,Math.min(t-s.start,s.dur-(t-s.start))*3));return x*x*(3-2*x);
}
