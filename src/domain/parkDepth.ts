/**
 * One-point perspective for the flat park, without a 3D camera.
 *
 * The scenery is already drawn from a 3/4 view: the path and the mown bands
 * widen toward the viewer. World y is therefore screen depth, and everything
 * standing on the lawn takes its size from where its feet are: the ground line
 * shrinks linearly toward a horizon above the back fence (y = HORIZON) and is
 * true size at y = REFERENCE, the middle of the lawn. Dogs, trees and props all
 * read this one function, so nothing in the park is scaled by eye.
 */
export const HORIZON=-1000;
export const REFERENCE=60;
export const DEPTH_MIN=.6,DEPTH_MAX=1.45;
/** Size of something whose feet stand at world y (park units, before `unit`). */
export const depthScale=(y:number)=>Math.max(DEPTH_MIN,Math.min(DEPTH_MAX,(y-HORIZON)/(REFERENCE-HORIZON)));
const f=(n:number)=>Math.round(n*1000)/1000;
/** SVG transform for a prop drawn around (0,0) whose ground contact sits `ground`
 * below its origin: it is scaled about that contact, so it stays on the lawn. */
export const onGround=(x:number,y:number,ground:number,k=1)=>`translate(${x} ${f(y+ground)}) scale(${f(k*depthScale(y+ground))}) translate(0 ${-ground})`;
/** A dog drawn smaller than a finger (`box`, world units for 120 screen px) gets a
 * box-wide touch area standing on its feet; a full-size dog gets none, so a tap
 * beside it walks. Returns the index of the nearest such dog, or -1. */
export function touchFallback(dogs:readonly {x:number;y:number;w:number;h:number}[],px:number,py:number,box:number):number{
  let best=-1,bestD=Infinity;
  dogs.forEach((a,i)=>{
    if(a.w>=box||Math.abs(px-a.x)>=box/2||py>=a.y+8||py<=a.y-Math.max(a.h,box))return;
    const d=Math.hypot(px-a.x,py-a.y);if(d<bestD){bestD=d;best=i;}
  });
  return best;
}
