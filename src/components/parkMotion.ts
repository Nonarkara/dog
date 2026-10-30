import * as THREE from 'three';
import {VERTEX,FRAGMENT} from './illustrationShaders';
import frames from './parkLocomotionArt.json';

type Point=[number,number];
export type MotionArtName=keyof typeof frames;
export const MOTION_LAYOUT={columns:10,rows:12,frames:112,runStart:0,runFrames:32,walkStart:32,walkFrames:16,turnStart:48,turnFrames:32,towardStart:80,awayStart:96,depthFrames:16} as const;
export const MOTION_FLOOR=348/384;
export const turnAngle=(from:number,to:number,limit:number)=>from+Math.max(-limit,Math.min(limit,Math.atan2(Math.sin(to-from),Math.cos(to-from))));
// A stride is advanced by distance, never by a free-running animation clock.
// During stance, a paw travels backwards by exactly the root's forward travel.
export function pawCycle(phase:number,offset=0){
 const q=((phase+offset)%1+1)%1,stance=.58;
 if(q<stance)return {x:q/stance-.5,lift:0,contact:true};
 const t=(q-stance)/(1-stance);
 return {x:.5-t,lift:Math.sin(t*Math.PI),contact:false};
}
export function viewFor(heading:number){
 const side=Math.abs(Math.cos(heading)),away=Math.sin(heading)<0;
 return {frame:side>.91?-1:side<.38?(away?10:9):(away?11:8),side,away,facing:Math.cos(heading)>0?-1:1};
}
export function frameArt(name:MotionArtName,index:number){return frames[name][index];}
export function sourceRig(name:MotionArtName,index:number):Point[]{
 const art=frameArt(name,index),front=index===56||index===72;
 const feet=art.feet.map(p=>[p[0],p[1]] as Point);
 const roots:Point[]=front?[[.40,.66],[.44,.65],[.61,.66],[.56,.65]]:[[.36,.61],[.32,.60],[.74,.61],[.66,.61]];
 const knees=feet.map((p,i)=>[roots[i][0]*.42+p[0]*.58+(i<2?.012:-.018),roots[i][1]*.42+p[1]*.58] as Point);
 return [...(front?[[.5,.30],[.5,.49],[.37,.52],[.63,.52]]:[[.25,.36],[.50,.49],[.72,.48],[.79,.31]]).map(p=>p as Point),...roots,...knees,...feet];
}
export function gaitRig(source:Point[],phase:number,amount:number,heading:number,front:boolean,size:number):{points:Point[];contacts:boolean[];stride:number}{
 const points=source.map(p=>[...p] as Point),contacts:boolean[]=[];
 // Authored/interpolated walk/run pixels supply the large anatomical movement.
 // Directional views need only short placement steps: never force a bent drawing
 // onto a generic neutral skeleton (that stretches knees and smears the chest).
 for(let leg=0;leg<4;leg++){
  const cycle=pawCycle(phase,[0,.5,.5,0][leg]);contacts.push(cycle.contact);
  const lift=cycle.lift*.028*amount;
  points[12+leg][1]-=lift;points[8+leg][1]-=lift*.45;
  points[12+leg][0]+=cycle.lift*(leg<2?.008:-.008)*amount;
 }
 return {points,contacts,stride:.36*size};
}

export function writeRig(from:THREE.Vector2[],to:THREE.Vector2[],source:Point[],target:Point[]){for(let i=0;i<16;i++){from[i].set(...source[i]);to[i].set(...target[i]);}}

// Preserve the home rig. The park adds a separate 16-joint skin only when its
// authored motion atlas is available. Full-opacity art avoids ghost/double paws.
export const PARK_VERTEX=VERTEX.replace('varying vec2 vUv;',`varying vec2 vUv;
 uniform vec2 strideFrom[16],strideTo[16];uniform float locomotion,running;uniform vec2 runNeck;`).replace('gl_Position=projectionMatrix',`
 if(locomotion>.001){
   vec2 displacement=vec2(0.);float weight=0.;
   for(int j=0;j<16;j++){vec2 d=original-strideFrom[j];float d2=dot(d,d);float w=1./(d2*d2*d2+.00000002);displacement+=(strideTo[j]-strideFrom[j])*w;weight+=w;}
   p=original+displacement/max(weight,.001);
   // Keep the commissioned large-headed proportions through the stretched run.
   float runHead=(1.-smoothstep(runNeck.x-.035,runNeck.x+.065,original.x))*(1.-smoothstep(runNeck.y-.07,runNeck.y+.035,original.y));
   p=mix(p,runNeck+(p-runNeck)*1.40,runHead*running);
   float chest=(1.-smoothstep(.59,.72,original.y));
   p.y+=sin(time*1.7)*.002*chest*(1.-reduced);
 }
 gl_Position=projectionMatrix`);
export const PARK_FRAGMENT=FRAGMENT.replace('uniform float opacity;', 'uniform float opacity;uniform vec4 artTile;').replace('texture2D(art,vUv)','texture2D(art,vUv*artTile.xy+artTile.zw)');
