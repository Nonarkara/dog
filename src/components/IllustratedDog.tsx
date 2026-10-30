import {PARK_VERTEX,PARK_FRAGMENT,MOTION_LAYOUT,frameArt,sourceRig,writeRig,type MotionArtName} from './parkMotion';
import {growthStage} from '../domain/growth';
import {chooseBehaviour,type DogBehaviour} from './dogBehaviour';
import {fetchLearned,touchPart,TOUCH_PREFERENCES,type TouchPart} from '../domain/companionGame';
import React, { useEffect, useRef, useState } from 'react';
import {createPortal} from 'react-dom';
import * as THREE from 'three';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';
import { dailyLife, dailyMood } from '../domain/dailyLife';
import type { Interaction } from '../domain/pet';
import type { AvatarPose, AvatarInteractionTrigger } from './DogAvatar3D';
import { DEFAULT_DOGS } from '../data/defaultDogs';
import { artPoseFor, landmarksFor, poseAnchors, type ArtPose } from './illustratedRig';
import {Hand,Heart,Music2,Wind,Bone,ChevronsDown,Moon,Thermometer,Droplets,Footprints,Utensils,Battery,Sparkles,Broom,RotateCw} from 'lucide-react';
import {TreatGame} from './TreatGame';
import {PLAY_PERSONALITIES,type Trick} from './dogPlay';
import { sound } from '../utils/proceduralAudio';
import {trainingMotion,type PerformanceProps} from './trainingMotion';

interface Props extends PerformanceProps {
  controlsHost?: HTMLElement|null;
  dog: DogProfile; petState: PetState; pose?: AvatarPose;
  interactionTrigger: AvatarInteractionTrigger; onInteractionEnd?: () => void;
  onCare?: (action: Interaction) => void;
  onBed?: () => void;
  onTeachFetch?:()=>void;
  onPet?: (part?:TouchPart) => void; onClean?: () => void; onMiniGameComplete?: (won: boolean,kind?:'catch'|'find-treat') => void;
  fallback: React.ReactNode;
}
export const ILLUSTRATIONS: Record<string, string> = {
  'expo-2021': '/dogs/expo.webp', 'mali-2022': '/dogs/mali.webp',
  'oreo-frenchie': '/dogs/oreo.webp', 'paolo-pug': '/dogs/paolo.webp', 'shiba-chai': '/dogs/hachiku.webp',
};

// A textured 2D skin, articulated on a fine mesh. The artwork stays one coherent
// character per authored pose; motion between display frames comes from the rig.
export {VERTEX,FRAGMENT} from './illustrationShaders';

export function IllustratedDog(props: Props) {
  const starter=DEFAULT_DOGS.find(d=>d.id===props.dog.id);
  const fields=['pattern','baseColor','secondaryColor','maskColor','pointColor','furFluff','earShape','tailShape'] as const;
  const customized=starter&&fields.some(k=>props.dog.avatarConfig[k]!==starter.avatarConfig[k]);
  const url=!customized&&ILLUSTRATIONS[props.dog.id];
  if(!url)return <>{props.fallback}</>;
  return <IllustratedStage key={props.dog.id+url} {...props} url={url}/>;
}

function IllustratedStage(props: Props & {url:string}) {
  const { dog, fallback, url } = props;
  const dock=(node:React.ReactNode)=>props.controlsHost?createPortal(node,props.controlsHost):node;
  const mount = useRef<HTMLDivElement>(null);
  const pawTarget=useRef<HTMLButtonElement>(null);
  const latest = useRef(props); latest.current = props;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [motionReady,setMotionReady]=useState(false);
  const [game, setGame] = useState<{round:number; score:number; target:'left'|'right'; busy:boolean; result:string}|null>(null);
  const gameRef=useRef(game); gameRef.current=game;
  const gameTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const leap=useRef({direction:0,started:0});
  const reaction=useRef({petUntil:0,lastPet:-Infinity,aimX:0,aimY:0,pets:0});
  const readyRef=useRef(ready);readyRef.current=ready;
  const personality=PLAY_PERSONALITIES[dog.id]||PLAY_PERSONALITIES['expo-2021'];
  const fun=useRef<{kind:Trick;started:number;until:number}|null>(null);
  const [trick,setTrick]=useState<typeof fun.current>(null);
  const [highFiveReady,setHighFiveReady]=useState(false);
  const funTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const cheerTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [cheer,setCheer]=useState<{id:number;text:string}|null>(null);
  const [fetchConfused,setFetchConfused]=useState(false);
  const [touchMessage,setTouchMessage]=useState('');
  const touchTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const touchRef=useRef('');
  const [ambient,setAmbient]=useState('watching');
  const [toileting,setToileting]=useState(false);
  const toiletUntil=useRef(0),lastPee=useRef(dailyLife(props.petState).lastPeedAt);
  const mood=dailyMood(props.petState),life=dailyLife(props.petState);
  useEffect(()=>{
    const at=life.lastPeedAt;
    if(at&&at!==lastPee.current&&Date.now()-at<20000&&!props.petState.sleep?.asleep&&!props.petState.sick){
      toiletUntil.current=performance.now()+3200;setToileting(true);stopFun();closeGame();closeFinding();clearCheer();
      const timer=setTimeout(()=>setToileting(false),3200);lastPee.current=at;return()=>clearTimeout(timer);
    }
    lastPee.current=at;
  },[life.lastPeedAt]);
  const [finding,setFinding]=useState(false);const findingRef=useRef(false);
  const stopFun=()=>{if(funTimer.current)clearTimeout(funTimer.current);fun.current=null;setTrick(null);};
  const clearCheer=()=>{if(cheerTimer.current)clearTimeout(cheerTimer.current);setCheer(null);};
  const showCheer=(text:string)=>{if(cheerTimer.current)clearTimeout(cheerTimer.current);setCheer({id:performance.now(),text});cheerTimer.current=setTimeout(()=>setCheer(null),2000);};
  const canPlay=()=>{const p=latest.current;return readyRef.current&&!p.petState.sick&&!p.petState.sleep?.asleep&&p.petState.calmSince===undefined&&(!p.pose||p.pose==='stand')&&!p.interactionTrigger&&p.petState.needs.energy>15;};
  const runTrick=(kind:Trick,fromGame=false)=>{
    const p=latest.current;if(!readyRef.current||p.petState.sick||p.petState.sleep?.asleep||p.pose&&p.pose!=='stand')return;
    if(!fromGame&&(!canPlay()||gameRef.current||findingRef.current))return;
    if(funTimer.current)clearTimeout(funTimer.current);if(!fromGame)setFetchConfused(false);
    const now=performance.now(),next={kind,started:now,until:now+(kind==='highfive'?8000:kind==='zoomies'||kind==='come'?3100:kind==='turn'?1600:2400)};
    fun.current=next;setTrick(next);
    const text=kind==='highfive'?'Tap my paw!':kind==='bow'?'Come on, let’s play!':kind==='zoomies'?(dog.id==='paolo-pug'?'Tiny pug zoomies!':'Zoomies!'):kind==='tilt'?'Did you say… treat?':kind==='come'?'Let me have a sniff!':kind==='turn'?'A little look around.':personality.greeting;
    if(!findingRef.current)showCheer(text);
    funTimer.current=setTimeout(()=>{fun.current=null;setTrick(null);},next.until-now);
  };
  const highFive=()=>{
    if(!highFiveReady||fun.current?.kind!=='highfive'||performance.now()-fun.current.started<650)return;
    stopFun();runTrick('wiggle',true);pet('High five!');
  };
  const startFinding=()=>{if(!canPlay()||gameRef.current||findingRef.current)return;stopFun();setCheer(null);findingRef.current=true;setFinding(true);};
  const closeFinding=()=>{findingRef.current=false;setFinding(false);};
  useEffect(()=>{setHighFiveReady(false);if(trick?.kind!=='highfive')return;const t=setTimeout(()=>setHighFiveReady(true),650);return()=>clearTimeout(t);},[trick]);
  useEffect(()=>()=>{if(funTimer.current)clearTimeout(funTimer.current);if(cheerTimer.current)clearTimeout(cheerTimer.current);},[]);


  useEffect(() => {
    const action=props.interactionTrigger;
    if(!action||!ready||failed)return;
    closeFinding();
    if(action!=='play')setFetchConfused(false);
    if(action==='settle'||action==='scold'||action==='rewardCalm')closeGame();
    if(action!=='pet'||fun.current?.kind==='highfive')stopFun();
    if(action!=='pet')clearCheer();
    if(action==='pet'||action==='groom'||action==='communicate')sound.happyYip();
    if(action==='pet'){reaction.current.pets++;if(reaction.current.pets%3===0&&fun.current?.kind!=='wiggle')runTrick('wiggle',true);else if(!fun.current)showCheer(touchRef.current||`${dog.name} loves that!`);}
    if(action==='groom')showCheer('Fresh and fluffy!');
    if(action==='feed')sound.eatCrunch();
    if(action==='rewardCalm')sound.eatCrunch();
    if(action==='walk')sound.bark();
    if(action==='clean')sound.sweepClean();
    if(action==='medicine')sound.medicineChime();
    if(action==='play'){
      if(!fetchLearned(latest.current.petState)){setFetchConfused(true);reaction.current.aimX=.4;showCheer('…? What do I do with this ball?');sound.ballBounce();return;}
      setFetchConfused(false);
      if(gameTimer.current)clearTimeout(gameTimer.current);
      leap.current={direction:0,started:0};
      setGame({round:1,score:0,target:Math.random()<.5?'left':'right',busy:false,result:''});
      sound.ballBounce();
    }
    const timer=setTimeout(()=>latest.current.onInteractionEnd?.(),2200);
    return()=>clearTimeout(timer);
  },[props.interactionTrigger,ready,failed]);

  useEffect(()=>()=>{if(gameTimer.current)clearTimeout(gameTimer.current);},[]);

  const pet=(message=`${dog.name} loves that!`,part?:TouchPart)=>{
    const now=performance.now();reaction.current.petUntil=now+1800;
    if(now-reaction.current.lastPet>2300){reaction.current.lastPet=now;latest.current.onPet?.(part);showCheer(message);}
  };
  const closeGame=()=>{
    if(gameTimer.current)clearTimeout(gameTimer.current);
    gameRef.current=null;setGame(null);leap.current={direction:0,started:0};
  };
  useEffect(()=>{if(failed){closeGame();closeFinding();stopFun();}},[failed]);
  useEffect(()=>{if(props.petState.sick||props.petState.sleep?.asleep){setFetchConfused(false);closeGame();closeFinding();stopFun();clearCheer();}else if(props.pose&&props.pose!=='stand'){closeGame();closeFinding();stopFun();}},[props.petState.sick,props.petState.sleep?.asleep,props.pose]);
  const choose=(direction:'left'|'right')=>{
    const current=gameRef.current;if(!current||current.busy)return;
    const hit=current.target===direction,score=current.score+(hit?1:0);
    const next={...current,score,busy:true,result:hit?'Caught!':'Missed!'};
    gameRef.current=next;setGame(next);
    leap.current={direction:direction==='left'?-1:1,started:performance.now()};
    if(hit)sound.chimeSuccess();else sound.ballBounce();
    gameTimer.current=setTimeout(()=>{
      if(current.round===5){gameRef.current=null;setGame(null);latest.current.onMiniGameComplete?.(score>=3);}
      else{const round={round:current.round+1,score,target:Math.random()<.5?'left' as const:'right' as const,busy:false,result:''};gameRef.current=round;setGame(round);}
      leap.current={direction:0,started:0};
    },850);
  };

  useEffect(()=>{
    const container=mount.current;if(!container||!url||failed)return;
    let disposed=false,frame=0;
    const textures=new Map<ArtPose,THREE.Texture>();
    let shownPose:ArtPose='stand',desiredPose:ArtPose='stand',poseChangedAt=-Infinity,transitionDuration=420;
    let poseRun={id:0,settledAt:null as number|null,reported:false};
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{setFailed(true);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    renderer.setClearColor(0x000000,0);container.appendChild(renderer.domElement);
    const canvas=renderer.domElement;
    canvas.dataset.renderer='illustrated-2d';canvas.dataset.dog=dog.id;
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=3;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const rig=landmarksFor(dog.id,'stand');
    const uniforms={artTile:{value:new THREE.Vector4(1,1,0,0)},locomotion:{value:0},running:{value:0},runNeck:{value:new THREE.Vector2(.36,.72)},strideFrom:{value:Array.from({length:16},()=>new THREE.Vector2())},strideTo:{value:Array.from({length:16},()=>new THREE.Vector2())},puppy:{value:0},fun:{value:new THREE.Vector4(0,0,0,personality.pace)},morphFrom:{value:poseAnchors(dog.id,'stand').map(p=>new THREE.Vector2(...p))},morphTo:{value:poseAnchors(dog.id,'stand').map(p=>new THREE.Vector2(...p))},morphAmount:{value:0},opacity:{value:1},temperament:{value:new THREE.Vector4()},feet:{value:new THREE.Vector4(...rig.feet)},eyes:{value:new THREE.Vector4(...rig.eyes)},headPivot:{value:new THREE.Vector2(...rig.head)},tailPivot:{value:new THREE.Vector2(...rig.tail)},legStart:{value:rig.legStart},resting:{value:0},settling:{value:0},art:{value:null as THREE.Texture|null},time:{value:0},blink:{value:0},profile:{value:new THREE.Vector2(dog.id==='mali-2022'?1.08:dog.id==='paolo-pug'?1.05:1,dog.id==='mali-2022'?.65:0)},reduced:{value:reduced.matches?1:0},motion:{value:new THREE.Vector4()},lifeAct:{value:new THREE.Vector4()},more:{value:new THREE.Vector4()},gaze:{value:new THREE.Vector2()}};
    renderer.info.autoReset=false;
    const material=new THREE.ShaderMaterial({vertexShader:PARK_VERTEX,fragmentShader:PARK_FRAGMENT,uniforms,transparent:true,depthTest:false,depthWrite:false});
    const geometry=new THREE.PlaneGeometry(2,2,96,96);
    const floorGeometry=new THREE.CircleGeometry(1,48);
    const stageInk=getComputedStyle(container.closest('.cockpit')||container).getPropertyValue('--text-main').trim()||'#294434';
    const floorMaterial=new THREE.MeshBasicMaterial({color:stageInk,transparent:true,opacity:.08,depthWrite:false});
    const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.scale.set(.63,.045,1);floor.position.y=-.85;floor.renderOrder=0;scene.add(floor);
    const outgoingUniforms=THREE.UniformsUtils.clone(uniforms) as typeof uniforms;
    const outgoingMaterial=new THREE.ShaderMaterial({vertexShader:PARK_VERTEX,fragmentShader:PARK_FRAGMENT,uniforms:outgoingUniforms,transparent:true,depthTest:false,depthWrite:false});
    const outgoing=new THREE.Mesh(geometry,outgoingMaterial);outgoing.visible=false;outgoing.renderOrder=1;scene.add(outgoing);
    const skin=new THREE.Mesh(geometry,material);skin.renderOrder=2;scene.add(skin);
    const toyGeometry=new THREE.SphereGeometry(.055,10,8),toyMaterial=new THREE.MeshBasicMaterial({color:'#b37736',depthTest:false});
    const trainingToy=new THREE.Mesh(toyGeometry,toyMaterial);trainingToy.renderOrder=3;trainingToy.visible=false;scene.add(trainingToy);
    const setRig=(u:typeof uniforms,pose:ArtPose)=>{
      const r=landmarksFor(dog.id,pose);u.feet.value.set(...r.feet);u.eyes.value.set(...r.eyes);u.headPivot.value.set(...r.head);u.tailPivot.value.set(...r.tail);u.legStart.value=r.legStart;
      u.resting.value=['stand','sit','paw','pet','bow'].includes(pose)?0:1;
      u.profile.value.y=['stand','pet'].includes(pose)&&dog.id==='mali-2022'?.65:0;
    };
    const register=(u:typeof uniforms,from:ArtPose,to:ArtPose)=>{
      poseAnchors(dog.id,from).forEach((v,i)=>u.morphFrom.value[i].set(...v));
      poseAnchors(dog.id,to).forEach((v,i)=>u.morphTo.value[i].set(...v));
    };
    // Rear paws render behind the torso when the skin folds into a seated pose.
    const index=geometry.getIndex()!,uv=geometry.getAttribute('uv');
    const cells:Array<{indices:number[];order:number}>=[];
    for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);const x=(uv.getX(a)+uv.getX(b)+uv.getX(c))/3,y=1-(uv.getY(a)+uv.getY(b)+uv.getY(c))/3;cells.push({indices:[a,b,c],order:y>.6&&x>.55?0:y>.6?2:1});}
    cells.sort((a,b)=>a.order-b.order);geometry.setIndex(cells.flatMap(c=>c.indices));
    let pixels:Uint8ClampedArray|null=null,imageW=0,imageH=0;
    const masks=new Map<ArtPose,{pixels:Uint8ClampedArray,w:number,h:number}>();
    const loader=new THREE.TextureLoader();
    let atlas:{texture:THREE.Texture;alpha:Uint8ClampedArray;width:number;tile:number}|null=null,hitAtlasFrame=-1,motionPhase=0,lastMotionX=0;
    const artName=url.split('/').pop()!.replace('.webp','') as MotionArtName;
    // Load optional movement after the base dog is usable; actions never rebuild
    // the renderer or wait for this atlas, and a failed atlas preserves care.
    const atlasTimer=setTimeout(()=>loader.load(`/dogs/motion/${artName}-motion${renderer.capabilities.maxTextureSize>=3840?'':'-lite'}.webp`,texture=>{
      if(disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
      const image=texture.image as HTMLImageElement,mask=document.createElement('canvas');mask.width=480;mask.height=576;const context=mask.getContext('2d');
      if(!context){texture.dispose();return;}context.drawImage(image,0,0,mask.width,mask.height);const rgba=context.getImageData(0,0,mask.width,mask.height).data,alpha=new Uint8ClampedArray(mask.width*mask.height);for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];atlas={texture,alpha,width:mask.width,tile:mask.width/MOTION_LAYOUT.columns};setMotionReady(true);
    },undefined,()=>{/* Optional movement never replaces the approved base dog. */}),1200);
    for(const key of ['stand','sit','down','paw','sleep','feed','pet','bow','sick'] as const){
      const source=key==='stand'?url:url.replace('.webp',`-${key}.webp`);
      loader.load(source,t=>{
        if(disposed){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;renderer.initTexture(t);textures.set(key,t);
        const image=t.image as HTMLImageElement,mask=document.createElement('canvas');mask.width=image.width;mask.height=image.height;
        const context=mask.getContext('2d',{willReadFrequently:true});
        if(context){context.drawImage(image,0,0);masks.set(key,{pixels:context.getImageData(0,0,image.width,image.height).data,w:image.width,h:image.height});}
        if(key==='stand'){uniforms.art.value=t;const m=masks.get(key);if(m){pixels=m.pixels;imageW=m.w;imageH=m.h;}setReady(true);}
      },undefined,()=>{if(!disposed)setFailed(true);});
    }
    let pendingResize=false,lastWidth=0,lastHeight=0;
    const resize=()=>{pendingResize=false;const w=container.clientWidth,h=container.clientHeight;if(!w||!h||w===lastWidth&&h===lastHeight)return;lastWidth=w;lastHeight=h;renderer.setSize(w,h);const v=Math.max(1.08,1.0/(w/h));camera.left=-v*w/h;camera.right=v*w/h;camera.top=v;camera.bottom=-v;camera.updateProjectionMatrix();container.parentElement?.style.setProperty('--dog-floor',`${(.5+.82/(camera.top-camera.bottom))*h-8}px`);};
    const observer=new ResizeObserver(()=>{pendingResize=true;});observer.observe(container);resize();
    const point=(event:PointerEvent)=>{const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)/r.width,y:(event.clientY-r.top)/r.height};};
    const hit=(event:PointerEvent)=>{
      const q=point(event),x=(((q.x-.5)*(camera.right-camera.left)-skin.position.x)/skin.scale.x+1)/2,y=(((q.y-.5)*(camera.top-camera.bottom)+skin.position.y)/skin.scale.y+1)/2;
      if(x<0||x>1||y<0||y>1||!pixels)return false;
      if(hitAtlasFrame>=0&&atlas){const ox=(hitAtlasFrame%MOTION_LAYOUT.columns)*atlas.tile,oy=Math.floor(hitAtlasFrame/MOTION_LAYOUT.columns)*atlas.tile;return atlas.alpha[(Math.min(atlas.tile-1,Math.floor(y*atlas.tile))+oy)*atlas.width+Math.min(atlas.tile-1,Math.floor(x*atlas.tile))+ox]>24;}
      return pixels[(Math.min(imageH-1,Math.floor(y*imageH))*imageW+Math.min(imageW-1,Math.floor(x*imageW)))*4+3]>24;
    };
    const petAt=(event:PointerEvent)=>{
      const q=point(event),x=(((q.x-.5)*(camera.right-camera.left)-skin.position.x)/skin.scale.x+1)/2,y=(((q.y-.5)*(camera.top-camera.bottom)+skin.position.y)/skin.scale.y+1)/2;
      const part=touchPart(x,y),favorite=TOUCH_PREFERENCES[dog.id]??'chest';
      const message=part===favorite?`${dog.name} melts into those ${part} scratches!`:`A gentle ${part} stroke… try another spot?`;
      touchRef.current=message;pet(message,part);setTouchMessage(message);if(touchTimer.current)clearTimeout(touchTimer.current);touchTimer.current=setTimeout(()=>setTouchMessage(''),2200);
      if(part===favorite)reaction.current.petUntil=performance.now()+2400;
    };
    let stroking=false;
    const down=(event:PointerEvent)=>{if(hit(event)){
      stroking=true;canvas.setPointerCapture(event.pointerId);petAt(event);
      const q=point(event),x=(((q.x-.5)*(camera.right-camera.left)-skin.position.x)/skin.scale.x+1)/2,y=(((q.y-.5)*(camera.top-camera.bottom)+skin.position.y)/skin.scale.y+1)/2;
      if(x<uniforms.headPivot.value.x+.05&&y<uniforms.headPivot.value.y){runTrick('tilt',true);showCheer('Boop!');}
    }else{const parent=canvas.closest('.illustrated-stage');const button=parent?.querySelector<HTMLButtonElement>('.dog-daily-status button');if(button){const b=button.getBoundingClientRect();if(event.clientX>=b.left&&event.clientX<=b.right&&event.clientY>=b.top&&event.clientY<=b.bottom)button.click();}}};
    const move=(event:PointerEvent)=>{const q=point(event);reaction.current.aimX=(q.x-.5)*2;reaction.current.aimY=(q.y-.5)*2;if(stroking&&hit(event))petAt(event);};
    const up=()=>{stroking=false;};
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
    let renders=0,last=0,next=0,start=performance.now();
    const times:number[]=[];let ambientLabel='watching',dailyAct:DogBehaviour='watching',dailyUntil=4,wasSleeping=false,wakePending=false,wakeStarted=-Infinity;let driftX=0,nextGreeting=performance.now()+18000;
    const animate=(now:number)=>{
      frame=requestAnimationFrame(animate);if(document.hidden){last=0;next=0;times.length=0;return;}
      const interval=reduced.matches?1000/6:1000/30;
      if(!next)next=now;
      if(now+.5<next)return;
      const dt=last?Math.min((now-last)/1000,.1):1/30;last=now;next+=interval;
      if(next<now-interval)next=now+interval;
      if(!uniforms.art.value)return;if(pendingResize)resize();
      uniforms.art.value=textures.get(shownPose)||uniforms.art.value;uniforms.artTile.value.set(1,1,0,0);uniforms.locomotion.value=0;uniforms.running.value=0;hitAtlasFrame=-1;
      const p=latest.current,asleep=!!p.petState.sleep?.asleep,t=(now-start)/1000;
      // The parent owns the care action lifecycle; avoid a second competing clock.
      const action=p.interactionTrigger;
      const activeFun=fun.current&&now<fun.current.until&&!asleep&&!p.petState.sick&&(!p.pose||p.pose==='stand')?fun.current:null;
      const mood=dailyMood(p.petState),toilet=now<toiletUntil.current&&!asleep&&!p.petState.sick;
      const free=p.petState.calmSince===undefined&&!action&&!gameRef.current&&!findingRef.current&&!activeFun&&(!p.pose||p.pose==='stand')&&now>reaction.current.petUntil;
      // Keep the household's earlier spontaneous greetings alongside daily life.
      if(now>nextGreeting){nextGreeting=now+18000+Math.random()*12000;if(free&&mood==='content'&&!toilet&&!reduced.matches&&canPlay()&&p.petState.needs.energy>35)runTrick(personality.idle);}
      if(wasSleeping&&!asleep)wakePending=true;wasSleeping=asleep;
      if(asleep||p.petState.sick)wakePending=false;
      if(free&&!asleep&&!p.petState.sick&&wakePending){wakePending=false;wakeStarted=t;}
      if(free&&t>=dailyUntil){const act=chooseBehaviour(p.petState,dailyAct);dailyAct=act.kind;dailyUntil=t+act.duration/personality.pace;}
      let idle:string=free?(mood==='sleeping'?'sleeping':mood==='sick'?'sick':toilet?'toileting':mood==='toilet'?'toilet':t-wakeStarted<2.3?'stretching':t-wakeStarted<4.6?'yawning':dailyAct):'watching';
      if(reduced.matches&&!['sleeping','sick','resting','sitting'].includes(idle))idle='watching';
      const actEase=Math.min(1,Math.max(0,Math.min(dailyUntil-t,1)))*(!free||asleep||p.petState.sick||reduced.matches?0:1);
      uniforms.lifeAct.value.lerp(new THREE.Vector4(idle==='yawning'?actEase:0,idle==='ear-twitch'?actEase:0,idle==='scratch'?actEase:0,idle==='shake'?actEase:0),1-Math.exp(-dt*5));
      if(ambientLabel!==idle){ambientLabel=idle;setAmbient(idle);}
      const strolling=free&&!reduced.matches&&(idle==='wandering'||idle==='trotting'||idle==='toilet');
      const sniffing=free&&(idle==='sniffing'||idle==='toilet');
      const kind=activeFun?.kind,zoomies=kind==='zoomies',wiggling=kind==='wiggle';
      const petting=now<reaction.current.petUntil||action==='pet'||wiggling;
      uniforms.fun.value.lerp(new THREE.Vector4(wiggling||idle==='tail-wag'?personality.wag:0,zoomies?1:0,kind==='tilt'||idle==='head-tilt'?1:0,personality.pace),1-Math.exp(-dt*9));
      const play=!!gameRef.current||action==='play';
      const target=new THREE.Vector4(petting?1:0,(action==='walk'&&!p.petState.sick)||zoomies||strolling?(idle==='trotting'?1.6:1):0,action==='feed'?1:0,play||idle==='stretching'||idle==='play-bow'?1:0);
      uniforms.temperament.value.lerp(new THREE.Vector4(p.petState.trust/100,p.petState.arousal/100,1-p.petState.needs.energy/100,1-p.petState.needs.hunger/100),1-Math.exp(-dt*3));
      uniforms.motion.value.lerp(target,1-Math.exp(-dt*10));
      uniforms.more.value.lerp(new THREE.Vector4(action==='groom'||idle==='shake'?1:0,action==='communicate'||action==='medicine'||sniffing||idle==='nose-nudge'?1:0,p.petState.sick?1:0,0),1-Math.exp(-dt*9));
      uniforms.gaze.value.lerp(new THREE.Vector2(asleep?0:reaction.current.aimX,asleep?0:reaction.current.aimY),.15);
      if(idle==='looking')uniforms.gaze.value.lerp(new THREE.Vector2(Math.sin(t*.9)*.8,Math.sin(t*.6)*.3),.07);
      const requested:ArtPose=asleep?'sleep':p.petState.sick?'sick':action==='feed'||action==='rewardCalm'?'feed':p.petState.calmSince!==undefined?'down':p.pose&&p.pose!=='stand'?artPoseFor(p.pose):kind==='highfive'||idle==='paw-screen'?'paw':kind==='bow'||idle==='play-bow'?'bow':petting?'pet':toilet?'sit':free&&['sick','tired','resting','sighing'].includes(idle)?'down':free&&['sitting','bored'].includes(idle)?'sit':idle==='stretching'?'bow':'stand';
      desiredPose=requested;
      const complete=reduced.matches||now-poseChangedAt>=transitionDuration;
      let step=desiredPose;
      const path:ArtPose[]=['stand','sit','down','sleep'];
      const category=(v:ArtPose)=>v==='pet'?'stand':v==='paw'?'sit':v==='feed'?'down':v==='bow'?'stand':v==='sick'?'down':v;
      const a=path.indexOf(category(shownPose)),b=path.indexOf(category(desiredPose));
      if(!reduced.matches&&a>=0&&b>=0&&Math.abs(b-a)>1)step=path[a+Math.sign(b-a)];
      if(complete&&step!==shownPose&&textures.has(step)){
        outgoingUniforms.art.value=uniforms.art.value;setRig(outgoingUniforms,shownPose);
        register(outgoingUniforms,shownPose,step);register(uniforms,step,shownPose);
        transitionDuration=shownPose==='pet'||step==='pet'?260:420;
        shownPose=step;uniforms.art.value=textures.get(shownPose)!;setRig(uniforms,shownPose);poseChangedAt=now;
        outgoing.visible=!reduced.matches;
        const m=masks.get(shownPose);if(m){pixels=m.pixels;imageW=m.w;imageH=m.h;}
      }
      const transition=reduced.matches?1:Math.min(1,(now-poseChangedAt)/transitionDuration);
      const request=p.poseRequest;
      if((request?.id??0)!==poseRun.id)poseRun={id:request?.id??0,settledAt:null,reported:false};
      const posed=!!request&&!asleep&&!p.petState.sick&&!action&&shownPose===artPoseFor(request.pose)&&transition===1;
      if(posed&&poseRun.settledAt===null)poseRun.settledAt=now;
      const lesson=request?trainingMotion(request.pose,poseRun.settledAt===null?0:now-poseRun.settledAt,reduced.matches):null;
      if(lesson){uniforms.gaze.value.x=lesson.gaze;uniforms.motion.value.y=Math.max(uniforms.motion.value.y,lesson.run);}
      const eased=transition*transition*(3-2*transition);
      uniforms.morphAmount.value=1-eased;uniforms.opacity.value=1;
      outgoingUniforms.morphAmount.value=eased;outgoingUniforms.opacity.value=1;
      // A single opaque drawing carries each frame. Corresponding joints move
      // continuously; no transparent duplicate face or paws cross-fade.
      outgoing.visible=transition<1&&eased<.5;skin.visible=!outgoing.visible;
      uniforms.settling.value=transition<1?Math.sin(transition*Math.PI)*.5:0;
      outgoingUniforms.settling.value=uniforms.settling.value;
      outgoingUniforms.fun.value.copy(uniforms.fun.value);outgoingUniforms.motion.value.copy(uniforms.motion.value);outgoingUniforms.more.value.copy(uniforms.more.value);outgoingUniforms.lifeAct.value.copy(uniforms.lifeAct.value);outgoingUniforms.temperament.value.copy(uniforms.temperament.value);outgoingUniforms.gaze.value.copy(uniforms.gaze.value);
      uniforms.reduced.value=reduced.matches?1:0;uniforms.time.value=reduced.matches?0:t;
      outgoingUniforms.reduced.value=uniforms.reduced.value;outgoingUniforms.time.value=uniforms.time.value;
      const jump=leap.current.direction?Math.min(1,(now-leap.current.started)/700):0;
      const zoom=uniforms.fun.value.y*(reduced.matches?0:1),zTime=activeFun?(now-activeFun.started)/1000*personality.pace:0;
      const growth=growthStage(p.petState);uniforms.puppy.value=1-growth.progress;outgoingUniforms.puppy.value=uniforms.puppy.value;
      const size=growth.scale*(1-zoom*.12)*(lesson?.scale??1),room=Math.max(0,camera.right-(dog.id==='mali-2022'?1:.96)*size-(camera.right-camera.left)*.025);
      const runX=Math.sin(zTime*5)*Math.min(.4,room)*zoom;
      skin.scale.set((lesson?.facing??(zoom>.2?(Math.cos(zTime*5)>0?-1:1):leap.current.direction===1?-1:1))*size,size,1);
      const wanderTarget=strolling?Math.sin(t*personality.pace*(idle==='trotting'?2.5:.8))*Math.min(idle==='trotting'?.3:.18,room):0;
      driftX+=(wanderTarget-driftX)*(1-Math.exp(-dt*3));
      skin.position.x=THREE.MathUtils.clamp(leap.current.direction*Math.sin(jump*Math.PI)*Math.min(.24,room)+runX+driftX+(lesson?.x??0)*room,-room,room);
      skin.position.y=(leap.current.direction&&!reduced.matches?Math.sin(jump*Math.PI)*Math.min(.2,Math.max(0,camera.top-.94*size)):0)+Math.abs(Math.sin(zTime*7))*.055*zoom*personality.bounce-.82*(1-size);
      const movement=!!atlas&&!reduced.matches&&!asleep&&!p.petState.sick&&shownPose==='stand'&&transition===1&&(!request||request.pose==='stand')&&(!action||action==='walk')&&(zoomies||strolling||kind==='come'||kind==='turn');
      canvas.dataset.motionReady=String(!!atlas);canvas.dataset.motionFrame='-1';
      if(movement&&atlas){
        const elapsed=activeFun?(now-activeFun.started)/1000:0,delta=skin.position.x-lastMotionX;motionPhase+=Math.min(.1,Math.abs(delta))/.66;
        let index:number,face=1,scale=1;
        if(kind==='turn')index=MOTION_LAYOUT.turnStart+Math.min(31,Math.floor(elapsed/1.6*32));
        else if(kind==='come'){
          const approach=Math.min(1,elapsed/1.5);scale=.90+.10*approach;
          index=elapsed<1.5?MOTION_LAYOUT.towardStart+Math.floor(elapsed*22)%16:elapsed<2.2?56:48+Math.round(8*(1-Math.min(1,(elapsed-2.2)/.7)));
        }else{
          const d=zoomies?Math.cos(zTime*5):delta;
          const turning=zoomies&&Math.abs(d)<.35;
          if(turning)index=48+Math.round((Math.sin(zTime*5)>0?8:24)+(d/.35)*4)%32;
          else{const fast=zoomies||idle==='trotting';index=(fast?0:32)+Math.floor(motionPhase*(fast?32:16))%(fast?32:16);face=d>0?-1:1;scale=fast?1.30:1;}
        }
        index=Math.max(0,Math.min(MOTION_LAYOUT.frames-1,index));const art=frameArt(artName,index),from=sourceRig(artName,index);writeRig(uniforms.strideFrom.value,uniforms.strideTo.value,from,from);
        uniforms.art.value=atlas.texture;uniforms.artTile.value.set(.1,1/12,(index%10)/10,1-(Math.floor(index/10)+1)/12);uniforms.locomotion.value=1;uniforms.running.value=index<32?1:0;
        if(index<32){const necks=[[.36,.72],[.38,.73],[.40,.76],[.40,.72]],q=index/8,k=Math.floor(q),f=q-k;uniforms.runNeck.value.set(necks[k][0]*(1-f)+necks[(k+1)%4][0]*f,necks[k][1]*(1-f)+necks[(k+1)%4][1]*f);}
        const canvasBox=canvas.getBoundingClientRect(),toysBox=container.closest('.illustrated-stage')?.querySelector('.dog-toys')?.getBoundingClientRect();
        const ink=art.displayBox,barSpace=toysBox?(canvasBox.right-toysBox.left+6)/canvasBox.width*(camera.right-camera.left):.23;
        const verticalFit=(camera.top+.82-.07)/(2*(.90625-ink[1]));
        const horizontalFit=(camera.right-camera.left-barSpace-.10)/(2*ink[2]);
        scale=Math.min(size*scale,verticalFit,horizontalFit);
        skin.scale.set(face*scale,scale,1);skin.position.y=-.82+(.90625-.5)*2*scale;
        const minX=((face>0?ink[0]:1-ink[0]-ink[2])-.5)*2*scale,maxX=minX+ink[2]*2*scale;
        const lo=camera.left-minX+.05,hi=camera.right-maxX-barSpace;skin.position.x=THREE.MathUtils.clamp(skin.position.x,lo,Math.max(lo,hi));
        hitAtlasFrame=index;canvas.dataset.motionFrame=String(index);
      }
      lastMotionX=skin.position.x;
      outgoing.position.copy(skin.position);outgoing.scale.copy(skin.scale);
      const pickup=request?.pose==='fetch'&&poseRun.settledAt!==null?(now-poseRun.settledAt)/1800:0;
      trainingToy.visible=!!lesson?.toy&&!(pickup>.45&&pickup<.6);
      if(trainingToy.visible){
        const carry=!!lesson?.carrying;
        trainingToy.position.set(carry?skin.position.x-.56*size*(lesson?.facing??1):request?.pose==='fetch'?room*.65+.56:-Math.min(.72,camera.right-.1),carry?skin.position.y+.08*size:-.78,.02);
      }
      floor.position.x=skin.position.x;floor.scale.x=.63*size;floorMaterial.opacity=.08*(1-Math.sin(jump*Math.PI)*.55);
      if(pawTarget.current){const x=.5+(.21-.5)*2/(camera.right-camera.left),y=.5+(.53-.5)*2/(camera.top-camera.bottom);pawTarget.current.style.left=`${x*100}%`;pawTarget.current.style.top=`${y*100}%`;}
      renderer.info.reset();renderer.render(scene,camera);
      canvas.dataset.performanceId=String(request?.id??0);canvas.dataset.performancePose=request?.pose??'none';
      canvas.dataset.performanceDone=String(!!request&&poseRun.reported);
      if(posed&&lesson?.done&&!poseRun.reported){poseRun.reported=true;canvas.dataset.performanceDone='true';canvas.dataset.completedAt=String(now);p.onPoseComplete?.(request!.id,now);}
      times.push(now);while(times.length&&now-times[0]>3000)times.shift();
      canvas.dataset.frames=String(++renders);canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.drawCalls=String(renderer.info.render.calls);
      canvas.dataset.fps=times.length>2?((times.length-1)*1000/(now-times[0])).toFixed(1):'0';
      canvas.dataset.growth=growth.name;canvas.dataset.growthScale=growth.scale.toFixed(3);canvas.dataset.touchResponse=touchRef.current;canvas.dataset.dailyWeight=uniforms.lifeAct.value.length().toFixed(3);canvas.dataset.mood=mood;canvas.dataset.behaviour=toilet?'toileting':idle;canvas.dataset.travelX=driftX.toFixed(3);canvas.dataset.trick=kind||'idle';canvas.dataset.personality=String(personality.pace);canvas.dataset.transitionMs=String(transitionDuration);canvas.dataset.transition=transition<1?transition.toFixed(3):'0';canvas.dataset.artPose=shownPose;canvas.dataset.action=action||'idle';canvas.dataset.pose=asleep?'sleep':p.pose||'stand';canvas.dataset.reduced=String(reduced.matches);
    };
    renderer.compile(scene,camera);
    frame=requestAnimationFrame(animate);
    return()=>{disposed=true;clearTimeout(atlasTimer);atlas?.texture.dispose();if(touchTimer.current)clearTimeout(touchTimer.current);cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);textures.forEach(t=>t.dispose());masks.clear();geometry.dispose();material.dispose();outgoingMaterial.dispose();floorGeometry.dispose();floorMaterial.dispose();toyGeometry.dispose();toyMaterial.dispose();renderer.dispose();canvas.remove();};
  },[dog.id,url,failed]);

  if(failed||!url)return <>{fallback}</>;
  const asleep=!!props.petState.sleep?.asleep;
  const needs={
    sleeping:{Icon:Moon,text:'Dreaming…',action:undefined},
    sick:{Icon:Thermometer,text:'Feeling poorly · medicine',action:'medicine' as const},
    toilet:{Icon:Footprints,text:'Need to go! · walk',action:'walk' as const},
    bored:{Icon:Bone,text:'Bored… play with me?',action:'play' as const},
    hungry:{Icon:Utensils,text:'A little hungry · feed',action:'feed' as const},
    tired:{Icon:Battery,text:'Sleepy paws · bed time',action:undefined},
    dirty:{Icon:Broom,text:'A little cleanup?',action:((props.petState.poopCount??0)+life.peeCount>0?'clean':'groom') as 'clean'|'groom'},
    content:{Icon:Heart,text:'',action:undefined},
  }[mood];
  const ambientText:Record<string,string>={looking:'What was that?',yawning:'A little yawn…','ear-twitch':'Did I hear you?','head-tilt':'Hmm?','tail-wag':'Happy you’re here',shake:'Shake it off!',scratch:'An itchy spot…','paw-screen':'Are you there?','nose-nudge':'Hello, you.','play-bow':'Come play!',watching:'Keeping you company',sniffing:'So many interesting smells…',wandering:'A little wander',sitting:'Watching the world',trotting:'A quick dash!',stretching:'Biiig stretch',resting:'Just resting my paws',sighing:'Sigh…',bored:'Got anything fun?',toilet:'Sniff… need to go!',toileting:'Oops…',tired:'Time for a nap',sick:'Taking it easy',sleeping:'Dreaming…'};
  return <div className="relative w-full h-full overflow-hidden select-none illustrated-stage" data-mood={mood}>
    <div ref={mount} className="dog-art-layer w-full h-full cursor-pointer" role="img" aria-label={`${dog.name}, illustrated dog. Enter or space to pet.`} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pet();}}}/>
    {!ready&&<p data-workspace-loading="true" role="status" className="absolute inset-0 flex items-center justify-center label">Loading {dog.name}’s illustration</p>}
    {game&&dock(<div className="catch-hud flex items-center justify-between text-[11px]">
      <div><span className="label text-accent">Catch · ball {game.target==='left'?'◀ left':'right ▶'}</span><span className="data ml-2" title={`Round ${game.round} of 5 · Score ${game.score}`}><span className="sr-only">Round </span>{game.round}/5 · <span className="sr-only">Score </span>{game.score}</span>{game.result&&<span className="ml-2 text-accent">{game.result}</span>}</div>
      <div className="flex gap-1"><button className="btn btn-quiet px-2" disabled={game.busy} aria-label="◀ Left" title="Left" onClick={()=>choose('left')}>◀</button><button className="btn btn-quiet px-2" disabled={game.busy} aria-label="Right ▶" title="Right" onClick={()=>choose('right')}>▶</button><button className="btn btn-quiet px-2" title="Close mini-game" onClick={closeGame}>✕</button></div>
    </div>)}
    {fetchConfused&&dock(<div className="fetch-first"><span>{dog.name} watches the ball drop…</span><button type="button" className="btn-quiet" onClick={()=>{setFetchConfused(false);latest.current.onTeachFetch?.();}}>Teach fetch ↗</button><button type="button" className="btn-quiet" aria-label="Close fetch introduction" onClick={()=>setFetchConfused(false)}>×</button></div>)}
    {(game?.busy||fetchConfused)&&<span key={game?.round??0} className={`illustration-ball illustration-ball--${game?.target??'left'} ${fetchConfused?'illustration-ball--untrained':''}`} role="img" aria-label={`Tennis ball toward ${game?.target??'left'}`}/> }
    {finding&&dock(<TreatGame key={dog.id} name={dog.name} onClose={closeFinding} onReact={(cup,hit)=>{reaction.current.aimX=(cup-1)*.8;runTrick(hit?'wiggle':'tilt',true);}} onComplete={won=>{closeFinding();stopFun();showCheer(won?'Clever nose!':'Good sniffing practice!');latest.current.onMiniGameComplete?.(won,'find-treat');}}/>)}
    {!game&&!finding&&<div className="dog-toys" role="group" aria-label="Dog tricks and toys">{([{kind:'highfive',label:'High five',Icon:Hand},{kind:'bow',label:'Play bow',Icon:ChevronsDown},{kind:'wiggle',label:'Happy wiggle',Icon:Music2},{kind:'zoomies',label:'Zoomies',Icon:Wind},{kind:'come',label:'Come closer',Icon:Footprints},{kind:'turn',label:'Turn around',Icon:RotateCw}] as const).map(({kind,label,Icon})=><button key={kind} type="button" className="btn-quiet" aria-label={label} title={label} disabled={!canPlay()||((kind==='come'||kind==='turn')&&!motionReady)} aria-pressed={trick?.kind===kind} onClick={()=>runTrick(kind)}><Icon size={19} aria-hidden="true"/></button>)}<button type="button" className="btn-quiet" aria-label="Find the treat" title="Find the treat" disabled={!canPlay()} onClick={startFinding}><Bone size={20} aria-hidden="true"/></button></div>}
    {!game&&!finding&&cheer&&<div key={cheer.id} className="dog-cheer" role="status" aria-live="polite"><span>{cheer.text}</span><div aria-hidden="true">{[0,1,2].map(i=><Heart key={i} className="dog-love" style={{animationDelay:`${i*.12}s`,left:`${42+i*7}%`}} size={17} fill="currentColor"/>)}</div></div>}
    {!game&&!finding&&trick?.kind==='highfive'&&highFiveReady&&<button ref={pawTarget} className="paw-target" type="button" aria-label={`Give ${dog.name} a high five`} onClick={highFive}><Hand size={25} aria-hidden="true"/></button>}
    {!game&&!finding&&!cheer&&mood!=='content'&&<div className={`dog-daily-status dog-daily-status--${mood}`} role="status">{needs.action?<button type="button" disabled={!!props.interactionTrigger} onClick={()=>latest.current.onCare?.(needs.action!)}><needs.Icon size={16} aria-hidden="true"/>{needs.text}</button>:mood==='tired'?<button type="button" onClick={()=>latest.current.onBed?.()}><needs.Icon size={16} aria-hidden="true"/>{needs.text}</button>:<span><needs.Icon size={16} aria-hidden="true"/>{needs.text}</span>}</div>}
    {!game&&!finding&&!cheer&&!trick&&<span className="dog-ambient-caption" aria-live="off">{touchMessage|| (toileting?'Oops…':ambientText[ambient])}</span>}
    {toileting&&!asleep&&!props.petState.sick&&<span className="dog-pee-drops" aria-label="Having a wee"><Droplets size={20}/></span>}
    {asleep&&<svg className="dog-blanket" viewBox="0 0 300 90" aria-label="Tucked into a blanket"><path d="M12 25 Q80 8 142 24 Q216 5 286 30 L280 82 L18 82 Z" fill="var(--bg-elevated)" stroke="var(--border-strong)" strokeWidth="2"/><path d="M14 33 Q90 17 147 34 Q218 16 284 38 M58 39 L64 76 M234 39 L230 76" fill="none" stroke="var(--border-dim)" strokeWidth="2"/></svg>}
    {asleep&&<span className="absolute top-[22%] left-[30%] data text-zinc-400" aria-label="Sleeping">z z</span>}

    {Array.from({length:Math.min(3,props.petState.poopCount||0)},(_,i)=><button key={i} className="illustration-mess" style={{left:`${65+i*9}%`}} onClick={()=>latest.current.onClean?.()} aria-label="Clean mess"><svg viewBox="0 0 40 36" width="30" height="28"><path d="M6 32Q-2 23 12 21Q3 12 19 11Q13 5 23 2Q22 11 27 14Q36 16 29 22Q44 26 34 32Z" fill="#786049" stroke="#33291f" strokeWidth="2"/></svg></button>)}
    {Array.from({length:life.peeCount},(_,i)=><button key={`pee-${i}`} type="button" className="illustration-puddle" style={{left:`${58-i*14}%`}} onClick={()=>latest.current.onClean?.()} aria-label="Clean puddle" title="Clean puddle"><svg viewBox="0 0 64 32" width="48" height="28" aria-hidden="true"><path d="M5 20C1 13 12 11 19 12C14 2 37 2 41 11C62 6 67 20 55 25C38 31 12 30 5 20Z" fill="#dfc577" stroke="#9b7a36" strokeWidth="1.5"/><path d="M12 20Q25 24 42 19M35 13l5-1" fill="none" stroke="#fff4c3" strokeWidth="2"/></svg></button>)}
    {!game&&!finding&&<p className="dog-pet-hint absolute bottom-2 right-2 text-[11px] text-zinc-400 pointer-events-none">Stroke to pet</p>}
  </div>;
}
