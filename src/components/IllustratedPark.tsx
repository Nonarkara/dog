import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {PLAY_PERSONALITIES} from './dogPlay';
import {PARK_VERTEX,PARK_FRAGMENT,MOTION_LAYOUT,MOTION_FLOOR,unwarpMotionPoint,runNeckFor,turnAngle,viewFor,sourceRig,gaitRig,writeRig,frameArt,type MotionArtName} from './parkMotion';
import {landmarksFor,poseAnchors,type ArtPose} from './illustratedRig';
import {growthStage} from '../domain/growth';
import type {PetState} from '../domain/types';
import {DEFAULT_DOGS} from '../data/defaultDogs';
import type {DogProfile} from '../types/dog';
import type {MetaverseNeighborDog} from '../types/dog';
import {parkScenery} from './parkScenery';
import {sound} from '../utils/proceduralAudio';
import {chooseActivity,personalityOf} from '../domain/parkPersonality';

export interface ParkApi {spawnNeighbor:(dog:MetaverseNeighborDog)=>void;removeNeighbor:(id:string)=>void;pet:(id:string)=>void;}
interface Props {appearance:DogProfile;dogId:string;name:string;petState?:PetState;neighbors:MetaverseNeighborDog[];zoom:number;focusId:string|null;onZoom:(zoom:number)=>void;onSelect:(id:string)=>void;onPet:()=>void;onSocialize:()=>void;onWalk?:(distance:number,seconds:number)=>void;onReady:(api:ParkApi)=>void;onError:(message:string)=>void;
 /** Watch mode: the camera frames the whole pack and your dog plays on its own. */
 ambient?:boolean;}
interface Raster {texture:THREE.Texture;pixels:Uint8ClampedArray;w:number;h:number;left:number;right:number;top:number;bottom:number;pixelWidth?:number;originX?:number;originY?:number;tile?:THREE.Vector4;alphaOnly?:boolean;}
const FILES:Record<string,string>={'expo-2021':'expo','mali-2022':'mali','oreo-frenchie':'oreo','paolo-pug':'paolo','shiba-chai':'hachiku'};
const NS='http://www.w3.org/2000/svg';
const attr=(element:Element,name:string,value:string)=>{if(element.getAttribute(name)!==value)element.setAttribute(name,value);};
/** An illustrated fallback visitor, not a pretend mesh of the friend's real dog. */
function visitorArt(d:MetaverseNeighborDog){
 const coat=d.avatarColors.base,cream=d.avatarColors.secondary||'#fbfaee',mask=d.avatarColors.mask||'#294434',short=/corgi|pug/i.test(d.breed),fluffy=/chow/i.test(d.breed);
 const svg=`<svg xmlns="${NS}" width="512" height="512" viewBox="0 0 512 512"><g stroke="#614c37" stroke-width="5" stroke-linejoin="round"><path d="M370 248Q477 129 454 269Q432 300 399 294" fill="${coat}"/><path d="M180 220Q284 173 397 233Q428 291 400 358L374 402H337L333 327L241 335L213 407H175L180 315Z" fill="${coat}"/><path d="M203 301Q296 318 340 282L324 338H240L210 395H183Z" fill="${cream}"/><path d="M94 197L99 110L161 161L213 126L218 225" fill="${coat}"/><path d="M107 191L112 139L141 176M180 178l24-27-1 49" stroke="#ccbaa0" stroke-width="9"/><path d="M86 190Q147 149 214 196L${fluffy?'239 234L224 252L241 277L218 292L221 317':'228 280'}Q178 335 111 284L67 251Z" fill="${coat}"/><path d="M71 229Q103 218 126 245L170 246Q159 289 112 278L69 257Z" fill="${cream}"/><path d="M65 236Q81 224 96 239L87 254Q67 256 65 236" fill="${mask}"/><path d="M92 267q21 22 40-1" fill="none"/><ellipse cx="128" cy="217" rx="10" ry="13" fill="${mask}"/><circle cx="125" cy="213" r="3.5" fill="#fbfaee"/>${short?'<path d="M242 338v48m91-54v53" fill="none"/>':''}<path d="M180 407h30M340 402h33" fill="none"/></g></svg>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
export function IllustratedPark(props:Props){
 const mount=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  const host=mount.current;if(!host)return;setReady(false);let disposed=false,frame=0,last=0,next=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const unit=Math.min(1.35,Math.max(1,host.clientWidth/600));
  host.insertAdjacentHTML('beforeend',parkScenery());const scenery=host.querySelector<SVGSVGElement>('svg')!;
  const landmarks=scenery.querySelector<SVGGElement>('.park-landmarks')!;landmarks.setAttribute('transform',`scale(${unit})`);
  const labels=document.createElementNS(NS,'g');labels.setAttribute('class','park-dog-labels');scenery.append(labels);
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{scenery.remove();setReady(true);latest.current.onError('The illustrated park needs WebGL. The dog list and visitor tools still work.');return;}
  renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));host.append(renderer.domElement);
  // Signals that must never be hidden behind a dog (the hungry bowl) live on
  // a layer above the canvas, sharing the scenery's coordinates.
  const overlay=document.createElementNS(NS,'svg');overlay.setAttribute('class','park-overlay');overlay.setAttribute('aria-hidden','true');host.append(overlay);
  const canvas=renderer.domElement;canvas.style.touchAction='none';canvas.dataset.renderer='illustrated-park';
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-200,200,300,-300,.1,50);camera.position.z=10;
  const geometry=new THREE.PlaneGeometry(2,2,48,48),rasters=new Map<string,Promise<Raster>>();
  const raster=(url:string,atlasMask=false)=>{let found=rasters.get(url);if(found)return found;
   found=new Promise<Raster>((resolve,reject)=>{const image=new Image();image.onload=()=>{
    if(disposed){reject(new Error('Park closed'));return;}
    const scratch=document.createElement('canvas');scratch.width=atlasMask?480:image.width;scratch.height=atlasMask?576:image.height;const context=scratch.getContext('2d');if(!context){reject(new Error('Could not read dog artwork'));return;}
    context.drawImage(image,0,0,scratch.width,scratch.height);const rgba=context.getImageData(0,0,scratch.width,scratch.height).data;let pixels=rgba,left=0,right=scratch.width-1,top=0,bottom=scratch.height-1;if(atlasMask){pixels=new Uint8ClampedArray(scratch.width*scratch.height);for(let i=0;i<pixels.length;i++)pixels[i]=rgba[i*4+3];}else{left=image.width;right=0;top=image.height;bottom=0;
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;texture.userData.asset=url;
    const result={texture,pixels,w:scratch.width,h:scratch.height,alphaOnly:atlasMask,left:left/scratch.width,right:(right+1)/scratch.width,top:top/scratch.height,bottom:(bottom+1)/scratch.height};
    if(disposed){texture.dispose();reject(new Error('Park closed'));return;}resolve(result);
   };image.onerror=()=>reject(new Error('Dog artwork could not load'));image.src=url;});rasters.set(url,found);return found;};
  type Actor={id:string;name:string;artId:string;source:string;own:boolean;phase:number;heading:number;speed:number;stride:number;strideSize:number;motionFile:MotionArtName|null;motionFrames:Raster[];motionFrame:number;hasWalked:boolean;blend:number;baseRaster:Raster|null;poseRaster:Raster|null;contacts:SVGEllipseElement[];x:number;y:number;homeX:number;homeY:number;tx:number;ty:number;facing:number;until:number;petUntil:number;lastPet:number;sniffUntil:number;pose:ArtPose;poseAt:number;requestedPose:ArtPose;mode:'wander'|'visit'|'chase'|'flee'|'rest'|'sit'|'feed'|'nap'|'walkto';then:'sit'|'feed'|'nap'|null;partner:string|null;bowUntil:number;bubble:SVGGElement|null;raster:Raster|null;mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;label:SVGTextElement;shadow:SVGEllipseElement;heart:SVGPathElement;w:number;h:number;};
  const actors=new Map<string,Actor>(),ownId=`you-${props.dogId}`;
  const uniformsFor=(id:string)=>{const r=landmarksFor(id,'stand');return {running:{value:0},runNeck:{value:new THREE.Vector2(.36,.72)},artTile:{value:new THREE.Vector4(1,1,0,0)},locomotion:{value:0},strideFrom:{value:Array.from({length:16},()=>new THREE.Vector2())},strideTo:{value:Array.from({length:16},()=>new THREE.Vector2())},art:{value:null as THREE.Texture|null},opacity:{value:1},time:{value:0},reduced:{value:0},puppy:{value:0},morphFrom:{value:poseAnchors(id,'stand').map(v=>new THREE.Vector2(...v))},morphTo:{value:poseAnchors(id,'stand').map(v=>new THREE.Vector2(...v))},morphAmount:{value:0},profile:{value:new THREE.Vector2(1,0)},motion:{value:new THREE.Vector4()},more:{value:new THREE.Vector4()},temperament:{value:new THREE.Vector4(.7,.4,.2,.2)},fun:{value:new THREE.Vector4(0,0,0,1)},lifeAct:{value:new THREE.Vector4()},gaze:{value:new THREE.Vector2()},headPivot:{value:new THREE.Vector2(...r.head)},tailPivot:{value:new THREE.Vector2(...r.tail)},feet:{value:new THREE.Vector4(...r.feet)},eyes:{value:new THREE.Vector4(...r.eyes)},legStart:{value:r.legStart},resting:{value:0},settling:{value:0}};};
  function applyPose(a:Actor,pose:ArtPose){if(a.requestedPose===pose)return;a.requestedPose=pose;const file=a.motionFile;if(!file)return;
   const url=pose==='stand'?`/dogs/${file}.webp`:`/dogs/${file}-${pose}.webp`;
   raster(url).then(r=>{if(disposed||a.requestedPose!==pose||!actors.has(a.id))return;const oldPose=a.pose;a.poseRaster=r;if(pose!=='stand'||!a.hasWalked)a.raster=r;a.pose=pose;a.poseAt=performance.now();const u=a.mesh.material.uniforms;poseAnchors(a.artId,pose).forEach((v,i)=>u.morphFrom.value[i].set(...v));poseAnchors(a.artId,oldPose).forEach((v,i)=>u.morphTo.value[i].set(...v));const rig=landmarksFor(a.artId,pose);u.art.value=r.texture;u.headPivot.value.set(...rig.head);u.tailPivot.value.set(...rig.tail);u.feet.value.set(...rig.feet);u.legStart.value=rig.legStart;u.resting.value=['sleep','down','sit'].includes(pose)?1:0;}).catch(()=>{/* Keep the available coherent drawing if an optional pose fails. */});
  }
  const spawn=(id:string,name:string,artId:string,source:string,x:number,y:number,own=false)=>{
   if(actors.has(id))return;const material=new THREE.ShaderMaterial({vertexShader:PARK_VERTEX,fragmentShader:PARK_FRAGMENT,uniforms:uniformsFor(artId),transparent:true,depthTest:false,depthWrite:false});const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
   const shadow=document.createElementNS(NS,'ellipse');shadow.setAttribute('class','park-contact-shadow');labels.append(shadow);
   const label=document.createElementNS(NS,'text');label.textContent=name;label.setAttribute('text-anchor','middle');labels.append(label);
   const heart=document.createElementNS(NS,'path');heart.setAttribute('d','M0 4C-18-8-11-19 0-11C11-19 18-8 0 4Z');heart.setAttribute('class','park-pet-heart');labels.append(heart);
   const contacts=Array.from({length:4},()=>{const dot=document.createElementNS(NS,'ellipse');dot.setAttribute('class','park-contact-shadow');dot.setAttribute('rx',String(4*unit));dot.setAttribute('ry',String(1.6*unit));labels.append(dot);return dot;});
   const motionFile=source===`/dogs/${FILES[artId]}.webp`?FILES[artId] as MotionArtName:null;
   const a:Actor={id,name,artId,source,own,heading:Math.PI,speed:0,stride:0,strideSize:76*unit,motionFile,motionFrames:[],motionFrame:-1,hasWalked:false,blend:0,baseRaster:null,poseRaster:null,contacts,phase:[...id].reduce((sum,c)=>sum+c.charCodeAt(0),0)*.13,x:x*unit,y:y*unit,homeX:x*unit,homeY:y*unit,tx:x*unit,ty:y*unit,facing:1,until:performance.now()+3000+Math.random()*4000,petUntil:0,lastPet:-Infinity,sniffUntil:0,pose:'stand',poseAt:0,requestedPose:'stand',mode:'wander',then:null,partner:null,bowUntil:0,bubble:null,raster:null,mesh,label,shadow,heart,w:0,h:0};actors.set(id,a);
   // A hungry dog says so without words: a bowl in a thought bubble.
   if(own){const g=document.createElementNS(NS,'g');g.setAttribute('class','park-hungry');g.setAttribute('opacity','0');
    g.innerHTML='<circle r="21" fill="#fbfaee" stroke="#614c37" stroke-width="2.5"/><circle cx="-12" cy="25" r="4.5" fill="#fbfaee" stroke="#614c37" stroke-width="2"/><circle cx="-18" cy="34" r="2.5" fill="#fbfaee" stroke="#614c37" stroke-width="1.6"/><path d="M-12 -2h24l-4 10h-16z" fill="#77624e" stroke="#614c37" stroke-width="2" stroke-linejoin="round"/><ellipse cy="-2" rx="12" ry="3.5" fill="#c9905b" stroke="#614c37" stroke-width="1.6"/>';
    overlay.append(g);a.bubble=g;}
   raster(source).then(r=>{if(disposed||!actors.has(id))return;a.baseRaster=r;if(!a.poseRaster||a.requestedPose==='stand')a.poseRaster=r;if(!a.raster||a.requestedPose==='stand'){a.raster=r;material.uniforms.art.value=r.texture;}if(own)setReady(true);}).catch(()=>{if(!disposed&&own){setReady(true);latest.current.onError('The dog illustration could not load. Please try again.');}});
   if(motionFile)raster(`/dogs/motion/${motionFile}-motion${own&&renderer.capabilities.maxTextureSize>=3840?'':'-lite'}.webp`,true).then(atlas=>{if(disposed||!actors.has(id))return;atlas.texture.generateMipmaps=false;atlas.texture.minFilter=THREE.LinearFilter;
    const tileSize=atlas.w/10;a.motionFrames=Array.from({length:MOTION_LAYOUT.frames},(_,index)=>{const box=frameArt(motionFile,index).box;return {...atlas,w:tileSize,h:tileSize,left:box[0],right:box[0]+box[2],top:box[1],bottom:MOTION_FLOOR,pixelWidth:atlas.w,originX:(index%10)*tileSize,originY:Math.floor(index/10)*tileSize,tile:new THREE.Vector4(.1,1/12,(index%10)/10,1-(Math.floor(index/10)+1)/12)};});}).catch(()=>{/* Optional gait art never removes the available dog or blocks care. */});
  };
  const original=DEFAULT_DOGS.find(d=>d.id===props.dogId),authored=original&&!props.appearance.avatarConfig.customModelUrl&&(['pattern','baseColor','secondaryColor','maskColor'] as const).every(k=>original.avatarConfig[k]===props.appearance.avatarConfig[k]);
  const ownFallback:MetaverseNeighborDog={id:ownId,name:props.name,breed:props.appearance.breed,tribe:'Your dog',ownerName:'You',personality:'',avatarColors:{base:props.appearance.avatarConfig.baseColor,secondary:props.appearance.avatarConfig.secondaryColor,mask:props.appearance.avatarConfig.maskColor},earShape:'pricked',position:[0,0,0],action:'sitting',speed:0};
  spawn(ownId,props.name,authored?props.dogId:'',authored?`/dogs/${FILES[props.dogId]}.webp`:visitorArt(ownFallback),0,95,true);
  const positions=[[-112,-46],[118,-42],[-117,235],[112,244],[-300,-90],[290,220],[-265,365],[310,-290],[0,-375]];
  const spawnNeighbor=(dog:MetaverseNeighborDog)=>{const known=dog.id.startsWith('pack-')?dog.id.slice(5):'',file=FILES[known],i=actors.size-1,p=positions[i%positions.length];spawn(dog.id,dog.name,known||'expo-2021',file?`/dogs/${file}.webp`:visitorArt(dog),p[0]+Math.floor(i/positions.length)*35,p[1]);};
  props.neighbors.forEach(spawnNeighbor);
  const removeNeighbor=(id:string)=>{const a=actors.get(id);if(!a||a.own)return;scene.remove(a.mesh);a.mesh.material.dispose();a.label.remove();a.shadow.remove();a.heart.remove();a.contacts.forEach(dot=>dot.remove());actors.delete(id);};
  let focus=props.focusId&&actors.has(props.focusId)?props.focusId:ownId,propFocus=props.focusId,cx=0,cy=35*unit,zoom=props.zoom,lastPet=-Infinity,lastSocial=-Infinity;
  const pet=(id:string)=>{const a=actors.get(id);if(!a)return;focus=id;latest.current.onSelect(id);if(a.own&&(latest.current.petState?.sleep.asleep||latest.current.petState?.sick))return;
   const now=performance.now();a.tx=a.x;a.ty=a.y;a.speed=0;if(now-a.lastPet<(a.own?2300:700)){a.petUntil=Math.max(a.petUntil,now+600);return;}a.lastPet=lastPet=now;a.petUntil=now+2200;sound.happyYip();if(a.own)latest.current.onPet();};
  latest.current.onReady({spawnNeighbor,removeNeighbor,pet});
  let width=1,height=1;
  let pendingResize=false;const resize=()=>{pendingResize=false;const w=host.clientWidth,h=host.clientHeight;if(w===width&&h===height)return;width=w;height=h;renderer.setSize(width,height);};const observer=new ResizeObserver(()=>{pendingResize=true;});observer.observe(host);resize();
  const point=(e:PointerEvent)=>{const b=canvas.getBoundingClientRect();return {x:cx+(e.clientX-b.left-width/2)/zoom,y:cy+(e.clientY-b.top-height/2)/zoom};};
  const hit=(p:{x:number;y:number})=>[...actors.values()].sort((a,b)=>b.y-a.y).find(a=>{if(!a.raster)return false;const v=a.mesh.worldToLocal(new THREE.Vector3(p.x,-p.y,0)),[x,y]=unwarpMotionPoint([(v.x+1)/2,(1-v.y)/2],a.motionFrame),r=a.raster;if(x<0||x>1||y<0||y>1)return false;return r.pixels[((Math.min(r.h-1,Math.floor(y*r.h))+(r.originY||0))*(r.pixelWidth||r.w)+Math.min(r.w-1,Math.floor(x*r.w))+(r.originX||0))*(r.alphaOnly?1:4)+(r.alphaOnly?0:3)]>32;});
  const pointers=new Map<number,{x:number;y:number;startX:number;startY:number;moved:boolean}>();let pinching=false,pinch=0,strokeId:string|null=null;
  const down=(e:PointerEvent)=>{if(!pointers.size){pinching=false;strokeId=null;}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});canvas.setPointerCapture(e.pointerId);if(pointers.size>1){pinching=true;strokeId=null;const[a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);return;}const a=hit(point(e));if(a){strokeId=a.id;pet(a.id);}};
  const move=(e:PointerEvent)=>{if(!pointers.has(e.pointerId))return;const prior=pointers.get(e.pointerId)!;pointers.set(e.pointerId,{...prior,x:e.clientX,y:e.clientY,moved:prior.moved||Math.hypot(e.clientX-prior.startX,e.clientY-prior.startY)>=15});if(pointers.size===2){const[a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch&&d)latest.current.onZoom(zoom*d/pinch);pinch=d;}else if(!pinching&&strokeId&&hit(point(e))?.id===strokeId)pet(strokeId);};
  const up=(e:PointerEvent)=>{if(!pointers.has(e.pointerId))return;const start=pointers.get(e.pointerId)!;pointers.delete(e.pointerId);if(!pinching&&!strokeId&&!start.moved&&Math.hypot(e.clientX-start.startX,e.clientY-start.startY)<15){const own=actors.get(ownId)!;if(!latest.current.petState?.sleep.asleep&&!latest.current.petState?.sick){const p=point(e);own.tx=Math.max(-420*unit,Math.min(420*unit,p.x));own.ty=Math.max(-280*unit,Math.min(400*unit,p.y));const px=(own.tx/unit+275)/180,py=(own.ty/unit-90)/115,d=Math.hypot(px,py);if(d<1){own.tx=(-275+px/Math.max(d,.001)*180)*unit;own.ty=(90+py/Math.max(d,.001)*115)*unit;}focus=ownId;latest.current.onSelect(ownId);}}pinch=0;};
  const wheel=(e:WheelEvent)=>{e.preventDefault();latest.current.onZoom(zoom*Math.exp(-e.deltaY*.001));};
  const keys=new Set<string>(),typing=(t:EventTarget|null)=>t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||(t instanceof HTMLElement&&t.isContentEditable);
  const keydown=(e:KeyboardEvent)=>{if(typing(e.target)||e.ctrlKey||e.metaKey)return;const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){e.preventDefault();keys.add(key);focus=ownId;}};const stopKeyboard=(coast=false)=>{const own=actors.get(ownId);if(!own)return;const tail=coast&&own.speed>1?8*unit:0;own.tx=own.x+Math.cos(own.heading)*tail;own.ty=own.y+Math.sin(own.heading)*tail;if(!coast)own.speed=0;};
  const keyup=(e:KeyboardEvent)=>{const held=keys.delete(e.key.toLowerCase());if(held&&!keys.size)stopKeyboard(true);};const blur=()=>{if(keys.size)stopKeyboard();keys.clear();};
  const cancel=(e:PointerEvent)=>{pointers.delete(e.pointerId);pinching=true;strokeId=null;};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('wheel',wheel,{passive:false});window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
  const contextLost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(frame);canvas.dataset.contextLost='true';latest.current.onError('The graphics connection was interrupted. Try the alternate view, or reopen the garden.');};
  const contextRestored=()=>{if(disposed)return;canvas.dataset.contextLost='false';latest.current.onReady({spawnNeighbor,removeNeighbor,pet});frame=requestAnimationFrame(animate);};
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
  // ---- PLAY ------------------------------------------------------------
  // Dogs in a park do four things: wander, go and sniff a friend, chase and
  // be chased, and flop down. Each dog picks its next activity when the last
  // one ends. In Watch mode your own dog joins in; otherwise it is yours to steer.
  // The playground follows the screen's shape: on a tall phone the pack
  // roams a taller, narrower field, so it fills the screen instead of a band.
  let roamX=400,roamTop=-250,roamBottom=380;
  const clampX=(x:number)=>Math.max(-roamX*unit,Math.min(roamX*unit,x)),clampY=(y:number)=>Math.max(roamTop*unit,Math.min(roamBottom*unit,y));
  const pick=<T,>(list:T[])=>list[Math.floor(Math.random()*list.length)];
  const hungry=()=>(latest.current.petState?.needs.hunger??100)<35;
  const ownFree=()=>!!latest.current.ambient&&!latest.current.petState?.sleep.asleep&&!latest.current.petState?.sick&&!hungry();
  const canPlay=(b:Actor)=>!!b.raster&&b.mode==='wander'&&(!b.own||ownFree());
  const farPoint=(b:Actor):[number,number]=>{const angle=Math.random()*Math.PI*2,r=(170+Math.random()*130)*unit;return [clampX(b.x+Math.cos(angle)*r),clampY(b.y+Math.sin(angle)*r*.8)];};
  const settle=(a:Actor,now:number)=>{a.mode='wander';a.partner=null;a.tx=a.x;a.ty=a.y;a.until=now+1500+Math.random()*2500;};
  const face=(a:Actor,b:Actor)=>{a.facing=b.x>a.x?-1:1;b.facing=a.x>b.x?-1:1;};
  // Places in the drawn park a dog can go to on purpose (park units).
  const BOWL:[number,number]=[22,232],BENCH:[number,number]=[125,-168];
  const LOOKOUTS:[number,number][]=[[-250,-150],[300,-40],[-190,330],[250,330]];
  const still=(m:Actor['mode'])=>m==='rest'||m==='sit'||m==='feed'||m==='nap';
  const goTo=(a:Actor,[x,y]:[number,number],then:'sit'|'feed'|'nap',now:number)=>{a.mode='walkto';a.then=then;a.tx=clampX(x*unit);a.ty=clampY(y*unit);a.until=now+20000;};
  const choose=(a:Actor,now:number)=>{
   // Each dog picks from its own habits (src/domain/parkPersonality.ts).
   const me=personalityOf(a.artId),friends=[...actors.values()].filter(b=>b!==a&&canPlay(b));
   const fav=friends.find(b=>b.artId===me.favourite);
   const friend=()=>fav&&Math.random()<.6?fav:pick(friends);
   const linger=(base:number)=>(base+Math.random()*base)*me.linger;
   switch(chooseActivity(a.artId,Math.random(),friends.length>0)){
    case 'chase':{const b=friend();a.mode='chase';a.partner=b.id;b.mode='flee';b.partner=a.id;[b.tx,b.ty]=farPoint(b);a.bowUntil=now+900;a.until=b.until=now+5200;return;}
    case 'visit':{const b=friend();a.mode='visit';a.partner=b.id;a.tx=clampX(b.x+(a.x<b.x?-118:118)*unit);a.ty=clampY(b.y+8*unit);a.until=now+7000;return;}
    case 'rest':a.mode='rest';a.tx=a.x;a.ty=a.y;a.until=now+linger(7000);return;
    case 'nap':a.mode='nap';a.tx=a.x;a.ty=a.y;a.until=now+linger(9000);return;
    case 'lookout':{const spot=LOOKOUTS.reduce((best,p)=>Math.hypot(p[0]*unit-a.x,p[1]*unit-a.y)<Math.hypot(best[0]*unit-a.x,best[1]*unit-a.y)&&Math.random()<.7?p:best,pick(LOOKOUTS));goTo(a,spot,'sit',now);return;}
    case 'bowl':goTo(a,BOWL,'feed',now);return;
    case 'wait':goTo(a,BENCH,'sit',now);return;
    default:a.mode='wander';a.tx=clampX(a.homeX+(Math.random()-.5)*me.roam*unit);a.ty=clampY(a.homeY+(Math.random()-.5)*me.roam*.65*unit);a.until=now+3500+Math.random()*5000;
   }
  };
  const behave=(a:Actor,now:number)=>{
   const partner=a.partner?actors.get(a.partner):undefined;
   if((a.mode==='chase'||a.mode==='flee'||a.mode==='visit')&&!partner){settle(a,now);return;}
   if(a.mode==='chase'&&partner&&now>a.bowUntil){
    a.tx=partner.x;a.ty=partner.y;
    if(Math.hypot(partner.x-a.x,partner.y-a.y)<58*unit){a.sniffUntil=partner.sniffUntil=now+1800;face(a,partner);settle(a,now);settle(partner,now);return;}
   }
   if(a.mode==='flee'&&Math.hypot(a.tx-a.x,a.ty-a.y)<20*unit)[a.tx,a.ty]=farPoint(a);
   if(a.mode==='visit'&&partner&&Math.hypot(a.tx-a.x,a.ty-a.y)<10*unit){
    if(Math.hypot(partner.x-a.x,partner.y-a.y)<130*unit&&partner.mode!=='chase'&&partner.mode!=='flee'){a.sniffUntil=now+2200;partner.sniffUntil=Math.max(partner.sniffUntil,now+2200);face(a,partner);}
    settle(a,now);return;
   }
   if(a.mode==='walkto'&&Math.hypot(a.tx-a.x,a.ty-a.y)<10*unit){
    const me=personalityOf(a.artId),then=a.then||'sit';a.mode=then;a.then=null;
    if(then==='feed')a.facing=-1; // face the bowl, to his right
    a.until=now+(then==='feed'?5000+Math.random()*3000:(10000+Math.random()*12000)*me.linger);return;
   }
   if(now<a.until)return;
   if(a.mode==='chase'||a.mode==='flee'){if(partner&&partner.partner===a.id)settle(partner,now);}
   choose(a,now);
  };
  let ambientZoom=props.zoom;
  let frames=0;const animate=(now:number)=>{frame=requestAnimationFrame(animate);if(document.visibilityState!=='visible'){last=0;next=0;blur();return;}if(now+.5<next)return;const dt=last?Math.min(.08,(now-last)/1000):1/60;last=now;next+=1000/(latest.current.ambient?30:60);if(next<now-1000/60)next=now+1000/60;
   if(pendingResize)resize();{const tall=height>width*1.15;roamX=tall?210:400;roamTop=-240;roamBottom=tall?620:380;}const p=latest.current;if(p.focusId!==propFocus){propFocus=p.focusId;focus=propFocus&&actors.has(propFocus)?propFocus:ownId;}zoom=Math.max(.85,Math.min(1.5,p.zoom));
   const own=actors.get(ownId)!,resting=!!p.petState?.sleep.asleep||!!p.petState?.sick;
   let dx=0,dy=0;if(!resting){if(keys.has('a')||keys.has('arrowleft'))dx--;if(keys.has('d')||keys.has('arrowright'))dx++;if(keys.has('w')||keys.has('arrowup'))dy--;if(keys.has('s')||keys.has('arrowdown'))dy++;}if(keys.size&&!dx&&!dy)stopKeyboard();if(dx||dy){own.tx=Math.max(-420*unit,Math.min(420*unit,own.x+dx*50));own.ty=Math.max(-280*unit,Math.min(400*unit,own.y+dy*50));}
   // PERSONAL SPACE: two dogs that are not playing together never stand on
   // top of each other. The one that is free to move steps aside, by walking.
   const placed=[...actors.values()].filter(a=>a.raster);
   for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
    const a=placed[i],b=placed[j];if(a.partner===b.id&&(a.mode==='chase'||a.mode==='flee'))continue;
    const gx=b.x-a.x,gy=(b.y-a.y)*1.8,d=Math.hypot(gx,gy),min=(a.w+b.w)*.42;if(d>=min)continue;
    const nx=d>.01?gx/d:1,ny=d>.01?gy/d:0;
    // Even a dog that is sniffing or lying down is eased apart a little;
    // only a dog you are steering (or one asleep at home) holds its ground.
    const slides=(c:Actor)=>!c.own||ownFree();
    const sa=slides(a),sb=slides(b),share=sa&&sb?.5:1,push=(min-d)*Math.min(1,dt*4);
    if(sa){a.x=clampX(a.x-nx*push*share);a.y=clampY(a.y-ny*push*share*.55);}
    if(sb){b.x=clampX(b.x+nx*push*share);b.y=clampY(b.y+ny*push*share*.55);}
    const free=(c:Actor)=>slides(c)&&!still(c.mode)&&c.mode!=='chase'&&c.mode!=='flee'&&c.mode!=='walkto'&&Math.hypot(c.tx-c.x,c.ty-c.y)<3;
    const mover=free(b)?b:free(a)?a:null;if(!mover)continue;
    const sign=mover===b?1:-1,gap=min-d+18*unit;
    mover.tx=clampX(mover.x+sign*nx*gap);mover.ty=clampY(mover.y+sign*ny*gap*.6);
   }
   for(const a of actors.values()){
    if(!reduced.matches&&(!a.own||ownFree()))behave(a,now);
    else if(a.own&&a.mode!=='wander')settle(a,now);
    if(a.own&&p.ambient&&hungry()&&!resting){a.tx=a.x;a.ty=a.y;}
    const distance=Math.hypot(a.tx-a.x,a.ty-a.y),moving=distance>2&&(a.own||!reduced.matches)&&!(a.own&&resting)&&now>a.petUntil&&now>a.sniffUntil&&now>a.bowUntil&&!still(a.mode);
    const desiredHeading=moving?Math.atan2(a.ty-a.y,a.tx-a.x):a.heading;
    const error=Math.atan2(Math.sin(desiredHeading-a.heading),Math.cos(desiredHeading-a.heading));
    a.heading=turnAngle(a.heading,desiredHeading,dt*4.4);
    const playSpeed=a.mode==='chase'?126:a.mode==='flee'?112:a.mode==='visit'||a.mode==='walkto'?62:null;
    const wantedSpeed=moving?(playSpeed??(a.own?(p.ambient&&!dx&&!dy?52:distance>100*unit||dx||dy?118:76):40))*unit*(PLAY_PERSONALITIES[a.artId]?.pace??1)*Math.max(0,Math.cos(error)):0;
    a.speed+=(wantedSpeed-a.speed)*(1-Math.exp(-dt*(moving?7:11)));
    if(!moving&&(now<a.petUntil||now<a.sniffUntil||now<a.bowUntil||still(a.mode)||(a.own&&resting)))a.speed=0;
    const step=moving?Math.min(distance,a.speed*dt):0;let traveled=0;
    if(step>.001){const oldX=a.x,oldY=a.y;let nx=a.x+Math.cos(a.heading)*step,ny=a.y+Math.sin(a.heading)*step;const px=(nx/unit+275)/180,py=(ny/unit-90)/115,d=Math.hypot(px,py);if(d<1){nx=(-275+px/Math.max(d,.001)*180)*unit;ny=(90+py/Math.max(d,.001)*115)*unit;}a.x=nx;a.y=ny;traveled=Math.hypot(a.x-oldX,a.y-oldY);a.stride+=traveled/a.strideSize;if(traveled<.01){a.tx=a.x;a.ty=a.y;a.speed=0;}a.hasWalked=true;if(a.own&&traveled>.01)p.onWalk?.(traveled/unit,dt);}
    a.blend+=((traveled>.01?1:0)-a.blend)*(1-Math.exp(-dt*10));
    const view=viewFor(a.heading);if(step>.01)a.facing=view.facing;
    const pose:ArtPose=a.own&&p.petState?.sleep.asleep?'sleep':a.own&&p.petState?.sick?'sick':now<a.petUntil&&a.motionFile?'pet':now<a.bowUntil?'bow':a.mode==='rest'?'down':a.mode==='nap'?'sleep':a.mode==='sit'?'sit':a.mode==='feed'?'feed':a.own&&p.ambient&&hungry()?'sit':'stand';applyPose(a,pose);
    const growth=a.own&&p.petState?growthStage(p.petState):{scale:1,progress:1};a.w=Math.max(128,(a.own?166:142)*unit*growth.scale);
    const u=a.mesh.material.uniforms,petting=now<a.petUntil;
    const animated=a.motionFile&&a.motionFrames.length===MOTION_LAYOUT.frames&&a.hasWalked&&a.pose==='stand'&&!(a.own&&resting)&&now>a.sniffUntil;
    let motionPoints:[number,number][]|null=null,contactFlags:boolean[]=[];
    if(animated){
     const traveling=a.blend>.15&&!reduced.matches&&Math.abs(error)<.25;
     const depth=traveling&&Math.abs(Math.sin(a.heading))>(a.motionFrame>=80?.70:.84);
     const side=traveling&&!depth,running=side&&a.speed>(a.motionFrame>=0&&a.motionFrame<32?78:92)*unit;
     const turnIndex=(Math.round((((Math.PI-a.heading)/(Math.PI*2))%1+1)%1*32)%32);
     const index=side?(running?Math.floor(a.stride*32)%32:32+Math.floor(a.stride*16)%16):depth?(Math.sin(a.heading)>0?80:96)+Math.floor(a.stride*16)%16:48+turnIndex;
     a.motionFrame=index;a.raster=a.motionFrames[index];a.facing=side?view.facing:1;
     const from=sourceRig(a.motionFile!,index),gait=gaitRig(from,a.stride,0,a.heading,index===56||index===72,a.w/.80);
     a.strideSize=(running?.46:depth?.30:.30)*a.w/.80;motionPoints=gait.points;contactFlags=frameArt(a.motionFile!,index).feet.map(point=>point[1]>.883);
     u.running.value=running?1:0;u.runNeck.value.set(...runNeckFor(index));
     if(petting){motionPoints[0][0]+=.006;motionPoints[0][1]+=.003;}
     writeRig(u.strideFrom.value,u.strideTo.value,from,motionPoints);u.locomotion.value=1;u.morphAmount.value=0;
    }else{a.motionFrame=-1;a.raster=a.poseRaster||a.raster;u.locomotion.value=0;u.running.value=0;}
    const r=a.raster;if(r){u.art.value=r.texture;u.artTile.value.copy(r.tile||new THREE.Vector4(1,1,0,0));}
    u.profile.value.set(a.artId==='mali-2022'?1.08:a.artId==='paolo-pug'?1.05:1,a.artId==='mali-2022'&&a.pose==='stand'?.65:0);u.morphAmount.value=animated||reduced.matches?0:Math.max(0,1-(now-a.poseAt)/420);u.time.value=reduced.matches?0:now/1000+a.phase;u.reduced.value=reduced.matches?1:0;u.puppy.value=1-growth.progress;
    u.motion.value.lerp(new THREE.Vector4(petting?1:0,moving?1:0,0,0),1-Math.exp(-dt*7));u.more.value.lerp(new THREE.Vector4(0,now<a.sniffUntil?1:0,a.own&&p.petState?.sick?1:0,0),1-Math.exp(-dt*5));
    const personality=PLAY_PERSONALITIES[a.artId]||PLAY_PERSONALITIES['expo-2021'];u.fun.value.set(petting?personality.wag*.65:0,0,!moving&&(now+a.phase*1000)%12000<2200?.4:0,personality.pace);if(a.own&&p.petState)u.temperament.value.lerp(new THREE.Vector4(p.petState.trust/100,p.petState.arousal/100,1-p.petState.needs.energy/100,1-p.petState.needs.hunger/100),1-Math.exp(-dt*4));
    a.mesh.renderOrder=Math.round(a.y+1000);if(r){const size=animated?a.w/.80*(a.motionFrame<32?1.30:1):a.w/(r.right-r.left);a.h=size*(r.bottom-r.top)+(animated&&a.motionFrame<32?size*.09:0);a.mesh.scale.set(a.facing*size/2,size/2,1);a.mesh.position.set(a.x-(animated?0:((r.left+r.right)/2-.5)*size*a.facing),-a.y+(r.bottom-.5)*size,0);a.mesh.updateMatrixWorld();
     for(let i=0;i<4;i++){const point=motionPoints?.[12+i];attr(a.contacts[i],'cx',String(a.x+(point?point[0]-.5:0)*size*a.facing));attr(a.contacts[i],'cy',String(a.y+(point?point[1]-MOTION_FLOOR:0)*size+1));attr(a.contacts[i],'opacity',point&&contactFlags[i]&&a.blend>.2?'.18':'0');}
    }
    if(a.own){canvas.dataset.paws=JSON.stringify(a.contacts.map(dot=>[Number(dot.getAttribute('cx')),Number(dot.getAttribute('cy')),dot.getAttribute('opacity')==='.18']));canvas.dataset.gaitBlend=String(a.blend);}
    attr(a.shadow,'cx',String(a.x));attr(a.shadow,'cy',String(a.y+2));attr(a.shadow,'rx',String(a.w*.33));attr(a.shadow,'ry',String(6*unit));attr(a.shadow,'opacity',a.raster?'.12':'0');
    attr(a.label,'x',String(a.x));attr(a.label,'y',String(a.y+17*unit));attr(a.label,'font-size',String(14*unit));attr(a.label,'opacity',a.raster?'1':'0');
    attr(a.heart,'transform',`translate(${a.x} ${a.y-a.h-14-(reduced.matches?0:(2200-Math.max(0,a.petUntil-now))*.014)}) scale(${unit})`);attr(a.heart,'opacity',petting?'1':'0');
    if(a.bubble){attr(a.bubble,'transform',`translate(${a.x+a.w*.3} ${a.y-a.h-30*unit}) scale(${unit})`);attr(a.bubble,'opacity',hungry()&&!resting&&a.raster?'1':'0');}
   }
   const target=actors.get(focus)||own;
   if(p.ambient){
    // WATCH FROM AFAR: frame the whole pack and drift slowly as they move.
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const a of actors.values())if(a.raster){minX=Math.min(minX,a.x-a.w*.6);maxX=Math.max(maxX,a.x+a.w*.6);minY=Math.min(minY,a.y-a.h);maxY=Math.max(maxY,a.y+24*unit);}
    if(minX<Infinity){const fit=Math.max(.4,Math.min(.95,Math.min(width/(maxX-minX+160*unit),height/(maxY-minY+140*unit))));
     const slow=reduced.matches?1:1-Math.exp(-dt*.7);ambientZoom+=(fit-ambientZoom)*slow;zoom=ambientZoom;cx+=((minX+maxX)/2-cx)*slow;cy+=((minY+maxY)/2-cy)*slow;}
   }else{
   ambientZoom=zoom;
   zoom=Math.min(zoom,Math.max(.85,(height-72)/Math.max(1,target.h)));
   const halfView=height/(2*zoom),wantedY=Math.max(target.y-halfView+45/zoom,Math.min(target.y-65*unit,target.y-target.h+halfView-18/zoom));
   const ease=reduced.matches?1:1-Math.exp(-dt*6);cx+=(target.x-cx)*ease;cy+=(wantedY-cy)*ease;
   }
   camera.left=cx-width/(2*zoom);camera.right=cx+width/(2*zoom);camera.top=-cy+height/(2*zoom);camera.bottom=-cy-height/(2*zoom);camera.updateProjectionMatrix();attr(scenery,'viewBox',`${cx-width/(2*zoom)} ${cy-height/(2*zoom)} ${width/zoom} ${height/zoom}`);attr(overlay,'viewBox',scenery.getAttribute('viewBox')!);
   let visible=0;for(const a of actors.values())if(a.raster){const x=(a.x-cx)*zoom+width/2,y=(a.y-a.h/2-cy)*zoom+height/2;if(x>a.w*zoom*.3&&x<width-a.w*zoom*.3&&y>a.h*zoom*.25&&y<height-a.h*zoom*.25)visible++;}
   const near=[...actors.values()].find(a=>!a.own&&a.raster&&Math.hypot(a.x-own.x,a.y-own.y)<86*unit);
   if(near&&!resting&&now-lastSocial>30000){lastSocial=now;near.sniffUntil=own.sniffUntil=now+2200;near.facing=own.x>near.x?-1:1;own.facing=near.x>own.x?-1:1;p.onSocialize();}
   renderer.render(scene,camera);canvas.dataset.frames=String(++frames);canvas.dataset.motionReady=String(own.motionFrames.length===MOTION_LAYOUT.frames);canvas.dataset.motionFrame=String(own.motionFrame);canvas.dataset.heading=String(own.heading);canvas.dataset.stride=String(own.stride);canvas.dataset.speed=String(own.speed);canvas.dataset.contacts=String(own.contacts.filter(c=>c.getAttribute('opacity')==='.18').length);canvas.dataset.focusX=String((target.x-cx)*zoom+width/2);canvas.dataset.focusY=String((target.y-target.h/2-cy)*zoom+height/2);canvas.dataset.focusWidth=String(target.w*zoom);canvas.dataset.focusHeight=String(target.h*zoom);canvas.dataset.zoom=zoom.toFixed(3);canvas.dataset.dogX=String((own.x-cx)*zoom+width/2);canvas.dataset.dogY=String((own.y-own.h/2-cy)*zoom+height/2);canvas.dataset.dogWidth=String(own.w*zoom);canvas.dataset.dogHeight=String(own.h*zoom);canvas.dataset.dogWorldX=String(own.x);canvas.dataset.dogWorldY=String(own.y);canvas.dataset.visibleDogs=String(visible);canvas.dataset.artPose=own.pose;canvas.dataset.artSource=own.mesh.material.uniforms.art.value?.userData.asset||'';canvas.dataset.dogCount=String(actors.size);canvas.dataset.smallestDogWidth=String(Math.min(...[...actors.values()].map(a=>a.w*zoom)));canvas.dataset.petDog=focus;canvas.dataset.lastPet=String(lastPet);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);
  };frame=requestAnimationFrame(animate);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('wheel',wheel);actors.forEach(a=>a.mesh.material.dispose());geometry.dispose();rasters.forEach(p=>p.then(r=>r.texture.dispose()).catch(()=>{}));renderer.dispose();canvas.remove();scenery.remove();overlay.remove();};
 },[props.dogId,props.name,props.appearance.avatarConfig.pattern,props.appearance.avatarConfig.baseColor,props.appearance.avatarConfig.secondaryColor,props.appearance.avatarConfig.maskColor,props.appearance.avatarConfig.customModelUrl]);
 return <div ref={mount} className="illustrated-park" aria-label="Illustrated dog park" aria-busy={!ready}>{!ready&&<p data-workspace-loading="true" className="park-loading" role="status">Opening the garden…</p>}</div>;
}
