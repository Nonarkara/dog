/**
 * THREE CUPS: his nose gets better the more you play.
 * A new dog guesses a little better than chance; a practised nose finds the
 * bone most of the time, never always — a dog that never misses is no fun.
 */
export const noseAccuracy=(nose:number)=>.45+.4*Math.max(0,Math.min(1,nose));
/** Which of `cups` he paws first. */
export function pickCup(target:number,cups:number[],nose:number,rnd=Math.random):number{
  const others=cups.filter(c=>c!==target);
  if(!others.length||rnd()<noseAccuracy(nose))return target;
  return others[Math.floor(rnd()*others.length)];
}
/** Practised noses earn a shuffle. */
export const shuffles=(nose:number)=>nose>=.5?3:0;
