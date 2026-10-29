import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';
import type { AvatarPose, AvatarInteractionTrigger } from './DogAvatar3D';
import { DEFAULT_DOGS } from '../data/defaultDogs';
import { artPoseFor, landmarksFor, poseAnchors, type ArtPose } from './illustratedRig';
import {Hand,Heart,Music2,Wind,Bone,ChevronsDown} from 'lucide-react';
import {TreatGame} from './TreatGame';
import {PLAY_PERSONALITIES,type Trick} from './dogPlay';
import { sound } from '../utils/proceduralAudio';

interface Props {
  dog: DogProfile; petState: PetState; pose?: AvatarPose;
  interactionTrigger: AvatarInteractionTrigger; onInteractionEnd?: () => void;
  onPet?: () => void; onClean?: () => void; onMiniGameComplete?: (won: boolean,kind?:'catch'|'find-treat') => void;
  fallback: React.ReactNode;
}
export const ILLUSTRATIONS: Record<string, string> = {
  'expo-2021': '/dogs/expo.webp', 'mali-2022': '/dogs/mali.webp',
  'oreo-frenchie': '/dogs/oreo.webp', 'paolo-pug': '/dogs/paolo.webp', 'shiba-chai': '/dogs/hachiku.webp',
};

// A textured 2D skin, articulated on a fine mesh. The artwork stays one coherent
// character per authored pose; motion between display frames comes from the rig.
const VERTEX = `
  varying vec2 vUv;
  uniform float time, reduced;
  uniform vec2 morphFrom[8],morphTo[8];
  uniform float morphAmount;
  uniform vec2 profile;
  uniform vec4 motion, more, temperament, fun;
  uniform vec2 gaze, headPivot, tailPivot;
  uniform vec4 feet, eyes;
  uniform float legStart, resting, settling;
  float band(float x,float c,float r){return 1.-smoothstep(r*.45,r,abs(x-c));}
  vec2 turn(vec2 p,vec2 pivot,float a){float s=sin(a),c=cos(a);return pivot+mat2(c,-s,s,c)*(p-pivot);}
  void main(){
    vUv=uv;
    vec2 original=vec2(uv.x,1.-uv.y),p=original;
    float head=(1.-smoothstep(headPivot.y-.04,headPivot.y+.09,p.y))*(1.-smoothstep(headPivot.x+.03,headPivot.x+.14,p.x));
    float torso=smoothstep(.29,.45,p.y)*(1.-smoothstep(.64,.80,p.y));
    float legs=smoothstep(legStart,legStart+.14,p.y);
    float nearFront=band(p.x,feet.x,.05)*legs;
    float farFront=band(p.x,feet.y,.045)*legs;
    float farBack=band(p.x,feet.w,.05)*legs;
    float nearBack=band(p.x,feet.z,.05)*legs;
    float phase=time*7.*fun.w;
    float walk=motion.y*(1.-reduced)*(1.-resting);
    p.x+=walk*.018*(nearFront*sin(phase)+farFront*sin(phase+3.14159)+nearBack*sin(phase+3.14159)+farBack*sin(phase));
    p.y-=walk*.016*(nearFront*max(0.,sin(phase))+farFront*max(0.,sin(phase+3.14159))+nearBack*max(0.,sin(phase+3.14159))+farBack*max(0.,sin(phase)));
    float bodyBreath=sin(time*(1.4+temperament.y)*(1.-temperament.z*.35))*(.004-temperament.z*.002)*(1.-reduced);
    p.x+=fun.x*sin(time*11.*fun.w)*.009*torso*(1.-head)*(1.-reduced);
    p.y+=(bodyBreath+walk*abs(sin(phase))*.008)*torso*(1.-legs);
    p.x=.47+(p.x-.47)*profile.x;
    p.y+=profile.y*mix((.91-p.y)*.16,.08,head);
    // Sitting and resting anatomy comes from authored poses, not a flattened standing skin.
    p.y+=(settling*.028)*torso;

    float bow=motion.w*.035*(1.-reduced);
    p.y+=bow*head;
    float angle=fun.z*.13*sin(time*2.4)* (1.-reduced)+fun.x*.025*sin(time*8.*fun.w)*(1.-reduced)+temperament.w*sin(time*1.7)*.018*(1.-reduced)+motion.x*-.075+more.y*sin(time*1.5)*.07+gaze.x*.05+more.x*sin(time*19.)*.055;
    vec2 headPosition=turn(p,headPivot,angle);
    headPosition+=vec2(motion.x*.012,more.z*.012+temperament.z*.015);
    p=mix(p,headPosition,head);
    float muzzle=band(original.x,headPivot.x-.12,.095)*band(original.y,headPivot.y-.015,.06);
    p.y+=motion.z*abs(sin(time*16.))*.007*muzzle;
    float tail=band(original.x,tailPivot.x,.105)*band(original.y,tailPivot.y,.12);
    vec2 tailPosition=turn(p,tailPivot+vec2(-.035,.065),sin(time*(motion.x>0.1?13.:3.+temperament.y*5.))*(.012+temperament.x*.024+temperament.y*.025+motion.x*.11+motion.w*.08+fun.x*.07)*(1.-temperament.z*.65)*(1.-reduced)*(1.-resting));
    p=mix(p,tailPosition,tail);
    if(morphAmount>.001){
      vec2 shift=vec2(0.);float total=0.;
      for(int i=0;i<8;i++){float d=distance(original,morphFrom[i]);float w=1./(d*d*d*d+.00008);shift+=(morphTo[i]-morphFrom[i])*w;total+=w;}
      p+=shift/max(total,.001)*morphAmount;
    }
    gl_Position=projectionMatrix*modelViewMatrix*vec4((p.x-.5)*2.,(.5-p.y)*2.,0.,1.);
  }
`;
const FRAGMENT = `varying vec2 vUv; uniform sampler2D art;uniform float opacity;
 void main(){gl_FragColor=texture2D(art,vUv);gl_FragColor.a*=opacity;if(gl_FragColor.a<.02)discard;
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;

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
  const mount = useRef<HTMLDivElement>(null);
  const pawTarget=useRef<HTMLButtonElement>(null);
  const latest = useRef(props); latest.current = props;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
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
  const [finding,setFinding]=useState(false);const findingRef=useRef(false);
  const stopFun=()=>{if(funTimer.current)clearTimeout(funTimer.current);fun.current=null;setTrick(null);};
  const clearCheer=()=>{if(cheerTimer.current)clearTimeout(cheerTimer.current);setCheer(null);};
  const showCheer=(text:string)=>{if(cheerTimer.current)clearTimeout(cheerTimer.current);setCheer({id:performance.now(),text});cheerTimer.current=setTimeout(()=>setCheer(null),2000);};
  const canPlay=()=>{const p=latest.current;return readyRef.current&&!p.petState.sick&&!p.petState.sleep?.asleep&&(!p.pose||p.pose==='stand')&&!p.interactionTrigger&&p.petState.needs.energy>15;};
  const runTrick=(kind:Trick,fromGame=false)=>{
    const p=latest.current;if(!readyRef.current||p.petState.sick||p.petState.sleep?.asleep||p.pose&&p.pose!=='stand')return;
    if(!fromGame&&(!canPlay()||gameRef.current||findingRef.current))return;
    if(funTimer.current)clearTimeout(funTimer.current);
    const now=performance.now(),next={kind,started:now,until:now+(kind==='highfive'?8000:kind==='zoomies'?3100:2400)};
    fun.current=next;setTrick(next);
    const text=kind==='highfive'?'Tap my paw!':kind==='bow'?'Come on, let’s play!':kind==='zoomies'?(dog.id==='paolo-pug'?'Tiny pug zoomies!':'Zoomies!'):kind==='tilt'?'Did you say… treat?':personality.greeting;
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
    if(action!=='pet'||fun.current?.kind==='highfive')stopFun();
    if(action!=='pet')clearCheer();
    if(action==='pet'||action==='groom'||action==='communicate')sound.happyYip();
    if(action==='pet'){reaction.current.pets++;if(reaction.current.pets%3===0&&fun.current?.kind!=='wiggle')runTrick('wiggle',true);else if(!fun.current)showCheer(`${dog.name} loves that!`);}
    if(action==='groom')showCheer('Fresh and fluffy!');
    if(action==='feed')sound.eatCrunch();
    if(action==='walk')sound.bark();
    if(action==='clean')sound.sweepClean();
    if(action==='medicine')sound.medicineChime();
    if(action==='play'){
      if(gameTimer.current)clearTimeout(gameTimer.current);
      leap.current={direction:0,started:0};
      setGame({round:1,score:0,target:Math.random()<.5?'left':'right',busy:false,result:''});
      sound.ballBounce();
    }
    const timer=setTimeout(()=>latest.current.onInteractionEnd?.(),2200);
    return()=>clearTimeout(timer);
  },[props.interactionTrigger,ready,failed]);

  useEffect(()=>()=>{if(gameTimer.current)clearTimeout(gameTimer.current);},[]);

  const pet=(message=`${dog.name} loves that!`)=>{
    const now=performance.now();reaction.current.petUntil=now+1800;
    if(now-reaction.current.lastPet>2300){reaction.current.lastPet=now;latest.current.onPet?.();showCheer(message);}
  };
  const closeGame=()=>{
    if(gameTimer.current)clearTimeout(gameTimer.current);
    gameRef.current=null;setGame(null);leap.current={direction:0,started:0};
  };
  useEffect(()=>{if(failed){closeGame();closeFinding();stopFun();}},[failed]);
  useEffect(()=>{if(props.petState.sick||props.petState.sleep?.asleep){closeGame();closeFinding();stopFun();clearCheer();}else if(props.pose&&props.pose!=='stand'){closeFinding();stopFun();}},[props.petState.sick,props.petState.sleep?.asleep,props.pose]);
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
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{setFailed(true);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    renderer.setClearColor(0x000000,0);container.appendChild(renderer.domElement);
    const canvas=renderer.domElement;
    canvas.dataset.renderer='illustrated-2d';canvas.dataset.dog=dog.id;
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=3;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const rig=landmarksFor(dog.id,'stand');
    const uniforms={fun:{value:new THREE.Vector4(0,0,0,personality.pace)},morphFrom:{value:poseAnchors(dog.id,'stand').map(p=>new THREE.Vector2(...p))},morphTo:{value:poseAnchors(dog.id,'stand').map(p=>new THREE.Vector2(...p))},morphAmount:{value:0},opacity:{value:1},temperament:{value:new THREE.Vector4()},feet:{value:new THREE.Vector4(...rig.feet)},eyes:{value:new THREE.Vector4(...rig.eyes)},headPivot:{value:new THREE.Vector2(...rig.head)},tailPivot:{value:new THREE.Vector2(...rig.tail)},legStart:{value:rig.legStart},resting:{value:0},settling:{value:0},art:{value:null as THREE.Texture|null},time:{value:0},blink:{value:0},profile:{value:new THREE.Vector2(dog.id==='mali-2022'?1.08:dog.id==='paolo-pug'?1.05:1,dog.id==='mali-2022'?.65:0)},reduced:{value:reduced.matches?1:0},motion:{value:new THREE.Vector4()},more:{value:new THREE.Vector4()},gaze:{value:new THREE.Vector2()}};
    renderer.info.autoReset=false;
    const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms,transparent:true,depthTest:false,depthWrite:false});
    const geometry=new THREE.PlaneGeometry(2,2,96,96);
    const floorGeometry=new THREE.CircleGeometry(1,48);
    const stageInk=getComputedStyle(container.closest('.cockpit')||container).getPropertyValue('--text-main').trim()||'#294434';
    const floorMaterial=new THREE.MeshBasicMaterial({color:stageInk,transparent:true,opacity:.08,depthWrite:false});
    const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.scale.set(.63,.045,1);floor.position.y=-.85;floor.renderOrder=0;scene.add(floor);
    const outgoingUniforms=THREE.UniformsUtils.clone(uniforms) as typeof uniforms;
    const outgoingMaterial=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms:outgoingUniforms,transparent:true,depthTest:false,depthWrite:false});
    const outgoing=new THREE.Mesh(geometry,outgoingMaterial);outgoing.visible=false;outgoing.renderOrder=1;scene.add(outgoing);
    const skin=new THREE.Mesh(geometry,material);skin.renderOrder=2;scene.add(skin);
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
    for(const key of ['stand','sit','down','paw','sleep','feed','pet','bow'] as const){
      const source=key==='stand'?url:url.replace('.webp',`-${key}.webp`);
      loader.load(source,t=>{
        if(disposed){t.dispose();return;}t.colorSpace=THREE.SRGBColorSpace;renderer.initTexture(t);textures.set(key,t);
        const image=t.image as HTMLImageElement,mask=document.createElement('canvas');mask.width=image.width;mask.height=image.height;
        const context=mask.getContext('2d',{willReadFrequently:true});
        if(context){context.drawImage(image,0,0);masks.set(key,{pixels:context.getImageData(0,0,image.width,image.height).data,w:image.width,h:image.height});}
        if(key==='stand'){uniforms.art.value=t;const m=masks.get(key);if(m){pixels=m.pixels;imageW=m.w;imageH=m.h;}setReady(true);}
      },undefined,()=>{if(!disposed)setFailed(true);});
    }
    const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);const v=Math.max(1.08,1.0/(w/h));camera.left=-v*w/h;camera.right=v*w/h;camera.top=v;camera.bottom=-v;camera.updateProjectionMatrix();container.parentElement?.style.setProperty('--dog-floor',`${(.5+.82/(camera.top-camera.bottom))*h-8}px`);};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    const point=(event:PointerEvent)=>{const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)/r.width,y:(event.clientY-r.top)/r.height};};
    const hit=(event:PointerEvent)=>{
      const q=point(event),x=((q.x-.5)*(camera.right-camera.left)+1)/2,y=((q.y-.5)*(camera.top-camera.bottom)+1)/2;
      if(x<0||x>1||y<0||y>1||!pixels)return false;
      return pixels[(Math.min(imageH-1,Math.floor(y*imageH))*imageW+Math.min(imageW-1,Math.floor(x*imageW)))*4+3]>24;
    };
    let stroking=false;
    const down=(event:PointerEvent)=>{if(hit(event)){
      stroking=true;canvas.setPointerCapture(event.pointerId);pet();
      const q=point(event),x=((q.x-.5)*(camera.right-camera.left)+1)/2,y=((q.y-.5)*(camera.top-camera.bottom)+1)/2;
      if(x<uniforms.headPivot.value.x+.05&&y<uniforms.headPivot.value.y){runTrick('tilt',true);showCheer('Boop!');}
    }};
    const move=(event:PointerEvent)=>{const q=point(event);reaction.current.aimX=(q.x-.5)*2;reaction.current.aimY=(q.y-.5)*2;if(stroking&&hit(event))pet();};
    const up=()=>{stroking=false;};
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
    let renders=0,last=0,next=0,start=performance.now();
    const times:number[]=[];let nextGreeting=performance.now()+18000;
    const animate=(now:number)=>{
      frame=requestAnimationFrame(animate);if(document.hidden){last=0;next=0;times.length=0;return;}
      const interval=reduced.matches?1000/6:1000/30;
      if(!next)next=now;
      if(now+.5<next)return;
      const dt=last?Math.min((now-last)/1000,.1):1/30;last=now;next+=interval;
      if(next<now-interval)next=now+interval;
      if(!uniforms.art.value)return;
      const p=latest.current,asleep=!!p.petState.sleep?.asleep,t=(now-start)/1000;
      // The parent owns the care action lifecycle; avoid a second competing clock.
      const action=p.interactionTrigger;
      const activeFun=fun.current&&now<fun.current.until&&!asleep&&!p.petState.sick&&(!p.pose||p.pose==='stand')?fun.current:null;
      if(now>nextGreeting){nextGreeting=now+18000+Math.random()*12000;if(!reduced.matches&&canPlay()&&!gameRef.current&&!findingRef.current&&!activeFun&&p.petState.needs.energy>35&&p.petState.needs.hunger>35)runTrick(personality.idle);}
      const kind=activeFun?.kind,zoomies=kind==='zoomies',wiggling=kind==='wiggle';
      const petting=now<reaction.current.petUntil||action==='pet'||wiggling;
      uniforms.fun.value.lerp(new THREE.Vector4(wiggling?personality.wag:0,zoomies?1:0,kind==='tilt'?1:0,personality.pace),1-Math.exp(-dt*9));
      const play=!!gameRef.current||action==='play';
      const target=new THREE.Vector4(petting?1:0,action==='walk'||zoomies?1:0,action==='feed'?1:0,play?1:0);
      uniforms.temperament.value.lerp(new THREE.Vector4(p.petState.trust/100,p.petState.arousal/100,1-p.petState.needs.energy/100,1-p.petState.needs.hunger/100),1-Math.exp(-dt*3));
      uniforms.motion.value.lerp(target,1-Math.exp(-dt*10));
      uniforms.more.value.lerp(new THREE.Vector4(action==='groom'?1:0,action==='communicate'||action==='medicine'||action==='clean'?1:0,p.petState.sick?1:0,0),1-Math.exp(-dt*9));
      uniforms.gaze.value.lerp(new THREE.Vector2(asleep?0:reaction.current.aimX,asleep?0:reaction.current.aimY),.15);
      const requested:ArtPose=asleep?'sleep':action==='feed'?'feed':p.pose&&p.pose!=='stand'?artPoseFor(p.pose):kind==='highfive'?'paw':kind==='bow'?'bow':petting?'pet':'stand';
      desiredPose=requested;
      const complete=reduced.matches||now-poseChangedAt>=transitionDuration;
      let step=desiredPose;
      const path:ArtPose[]=['stand','sit','down','sleep'];
      const category=(v:ArtPose)=>v==='pet'?'stand':v==='paw'?'sit':v==='feed'?'down':v==='bow'?'stand':v;
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
      const eased=transition*transition*(3-2*transition);
      uniforms.morphAmount.value=1-eased;uniforms.opacity.value=1;
      outgoingUniforms.morphAmount.value=eased;outgoingUniforms.opacity.value=1;
      // A single opaque drawing carries each frame. Corresponding joints move
      // continuously; no transparent duplicate face or paws cross-fade.
      outgoing.visible=transition<1&&eased<.5;skin.visible=!outgoing.visible;
      uniforms.settling.value=transition<1?Math.sin(transition*Math.PI)*.5:0;
      outgoingUniforms.settling.value=uniforms.settling.value;
      outgoingUniforms.fun.value.copy(uniforms.fun.value);outgoingUniforms.motion.value.copy(uniforms.motion.value);outgoingUniforms.more.value.copy(uniforms.more.value);outgoingUniforms.temperament.value.copy(uniforms.temperament.value);outgoingUniforms.gaze.value.copy(uniforms.gaze.value);
      uniforms.reduced.value=reduced.matches?1:0;uniforms.time.value=reduced.matches?0:t;
      outgoingUniforms.reduced.value=uniforms.reduced.value;outgoingUniforms.time.value=uniforms.time.value;
      const jump=leap.current.direction?Math.min(1,(now-leap.current.started)/700):0;
      const zoom=uniforms.fun.value.y*(reduced.matches?0:1),zTime=activeFun?(now-activeFun.started)/1000*personality.pace:0;
      const size=1-zoom*.12,room=Math.max(.08,camera.right-.83*size-(camera.right-camera.left)*.09);
      const runX=Math.sin(zTime*5)*Math.min(.4,room)*zoom;
      skin.scale.set((zoom>.2?(Math.cos(zTime*5)>0?-1:1):leap.current.direction===1?-1:1)*size,size,1);
      skin.position.x=leap.current.direction*Math.sin(jump*Math.PI)*.24+runX;
      skin.position.y=(leap.current.direction&&!reduced.matches?Math.sin(jump*Math.PI)*.2:0)+Math.abs(Math.sin(zTime*7))*.055*zoom*personality.bounce-.82*(1-size);
      outgoing.position.copy(skin.position);outgoing.scale.copy(skin.scale);
      floor.position.x=skin.position.x;floor.scale.x=.63*size;floorMaterial.opacity=.08*(1-Math.sin(jump*Math.PI)*.55);
      if(pawTarget.current){const x=.5+(.21-.5)*2/(camera.right-camera.left),y=.5+(.53-.5)*2/(camera.top-camera.bottom);pawTarget.current.style.left=`${x*100}%`;pawTarget.current.style.top=`${y*100}%`;}
      renderer.info.reset();renderer.render(scene,camera);
      times.push(now);while(times.length&&now-times[0]>3000)times.shift();
      canvas.dataset.frames=String(++renders);canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.drawCalls=String(renderer.info.render.calls);
      canvas.dataset.fps=times.length>2?((times.length-1)*1000/(now-times[0])).toFixed(1):'0';
      canvas.dataset.trick=kind||'idle';canvas.dataset.personality=String(personality.pace);canvas.dataset.transitionMs=String(transitionDuration);canvas.dataset.transition=transition<1?transition.toFixed(3):'0';canvas.dataset.artPose=shownPose;canvas.dataset.action=action||'idle';canvas.dataset.pose=asleep?'sleep':p.pose||'stand';canvas.dataset.reduced=String(reduced.matches);
    };
    renderer.compile(scene,camera);
    frame=requestAnimationFrame(animate);
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);textures.forEach(t=>t.dispose());masks.clear();geometry.dispose();material.dispose();outgoingMaterial.dispose();floorGeometry.dispose();floorMaterial.dispose();renderer.dispose();canvas.remove();};
  },[dog.id,url,failed]);

  if(failed||!url)return <>{fallback}</>;
  const asleep=!!props.petState.sleep?.asleep;
  return <div className="relative w-full h-full overflow-hidden select-none illustrated-stage">
    <div ref={mount} className="w-full h-full cursor-pointer" role="img" aria-label={`${dog.name}, illustrated dog. Enter or space to pet.`} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pet();}}}/>
    {!ready&&<p className="absolute inset-0 flex items-center justify-center label">Loading {dog.name}’s illustration</p>}
    {game&&<div className="catch-hud absolute top-2 left-2 right-2 flex items-center justify-between bg-zinc-950 border-hairline px-2 py-1.5 text-[11px] z-10">
      <div><span className="label text-accent">Catch · ball {game.target==='left'?'◀ left':'right ▶'}</span><span className="data ml-2">Round {game.round}/5 · Score {game.score}</span>{game.result&&<span className="ml-2 text-accent">{game.result}</span>}</div>
      <div className="flex gap-1"><button className="btn btn-quiet px-2" disabled={game.busy} onClick={()=>choose('left')}>◀ Left</button><button className="btn btn-quiet px-2" disabled={game.busy} onClick={()=>choose('right')}>Right ▶</button><button className="btn btn-quiet px-2" title="Close mini-game" onClick={closeGame}>✕</button></div>
    </div>}
    {game?.busy&&<span key={game.round} className={`illustration-ball illustration-ball--${game.target}`} role="img" aria-label={`Ball toward ${game.target}`}/> }
    {finding&&<TreatGame key={dog.id} name={dog.name} onClose={closeFinding} onReact={(cup,hit)=>{reaction.current.aimX=(cup-1)*.8;runTrick(hit?'wiggle':'tilt',true);}} onComplete={won=>{closeFinding();stopFun();showCheer(won?'Clever nose!':'Good sniffing practice!');latest.current.onMiniGameComplete?.(won,'find-treat');}}/>}
    {!game&&!finding&&<div className="dog-toys" role="group" aria-label="Dog tricks and toys">{([{kind:'highfive',label:'High five',Icon:Hand},{kind:'bow',label:'Play bow',Icon:ChevronsDown},{kind:'wiggle',label:'Happy wiggle',Icon:Music2},{kind:'zoomies',label:'Zoomies',Icon:Wind}] as const).map(({kind,label,Icon})=><button key={kind} type="button" className="btn-quiet" aria-label={label} title={label} disabled={!canPlay()} aria-pressed={trick?.kind===kind} onClick={()=>runTrick(kind)}><Icon size={19} aria-hidden="true"/></button>)}<button type="button" className="btn-quiet" aria-label="Find the treat" title="Find the treat" disabled={!canPlay()} onClick={startFinding}><Bone size={20} aria-hidden="true"/></button></div>}
    {!game&&!finding&&cheer&&<div key={cheer.id} className="dog-cheer" role="status" aria-live="polite"><span>{cheer.text}</span><div aria-hidden="true">{[0,1,2].map(i=><Heart key={i} className="dog-love" style={{animationDelay:`${i*.12}s`,left:`${42+i*7}%`}} size={17} fill="currentColor"/>)}</div></div>}
    {!game&&!finding&&trick?.kind==='highfive'&&highFiveReady&&<button ref={pawTarget} className="paw-target" type="button" aria-label={`Give ${dog.name} a high five`} onClick={highFive}><Hand size={25} aria-hidden="true"/></button>}
    {asleep&&<span className="absolute top-[22%] left-[30%] data text-zinc-400" aria-label="Sleeping">z z</span>}
    {props.petState.sick&&<span className="absolute top-[25%] right-[30%] label text-accent">Needs rest</span>}
    {Array.from({length:Math.min(3,props.petState.poopCount||0)},(_,i)=><button key={i} className="illustration-mess" style={{left:`${65+i*9}%`}} onClick={()=>latest.current.onClean?.()} aria-label="Clean mess"><svg viewBox="0 0 40 36" width="30" height="28"><path d="M6 32Q-2 23 12 21Q3 12 19 11Q13 5 23 2Q22 11 27 14Q36 16 29 22Q44 26 34 32Z" fill="#786049" stroke="#33291f" strokeWidth="2"/></svg></button>)}
    <p className="absolute bottom-2 right-2 text-[11px] text-zinc-400 pointer-events-none">Stroke to pet</p>
  </div>;
}
