import {downloadOwnedBackup} from './utils/downloadOwnedBackup';
import { validRoom } from './domain/parkProtocol';
import {FirstPlayTip,useFirstPlayTips} from './components/FirstPlayTips';
import {householdDefaults,playMode,modeKey} from './utils/playMode';
import {growCompanion,growthStage} from './domain/growth';
import {sound} from './utils/proceduralAudio';
import {CareExtras} from './components/CareExtras';
import {TOUCH_PREFERENCES,gameState,buyFood,discoverTouch,socialize,completeParkWalk,type TouchPart} from './domain/companionGame';
import {recordSources} from './utils/recordProvenance';
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { DogProfile } from './types/dog';
import type { PetState } from './domain/types';
import { dailyLife } from './domain/dailyLife';
import type { AvatarInteractionTrigger } from './components/DogAvatar3D';
import type {PoseRequest,AvatarPose,PerformPose} from './components/trainingMotion';
import {calmNeed} from './domain/calm';
import { addTogether, answerCall, tickCall } from './domain/attention';
import type { CoatPattern } from './domain/coat';
import { dogTheme, DOG_THEMES } from './data/dogThemes';
import { DEFAULT_DOGS } from './data/defaultDogs';
import {
  loadStoredDogs,
  loadActiveDogId,
  saveActiveDogId,
  calculateDogAge,
  loadPetState,
} from './utils/dogCalculators';
import {mutatePet,mutateDogs,resetProgress,type PetMutation,type DogMutation} from './utils/progressStore';
import {SAVE_KEY} from './utils/saveFormat';
import { CommandBar,ControlLegend } from './components/CommandBar';
import type { CareAction } from './components/CommandBar';
import { CarePanel } from './components/CarePanel';
import {DogChooser} from './components/DogChooser';
import { Dog, Plus, X, ChevronDown, RotateCcw, Heart, GraduationCap, BookOpen, Trees, ShieldCheck, Download } from 'lucide-react';
import {
  interact,
  communicate,
  decay,
  settleSleep,
  willSettle,
} from './domain/pet';

/**
 * THE COCKPIT.
 *
 * ONE SCREEN. The document does not scroll, because a Tamagotchi did not
 * scroll: the animal, the indicators and the buttons were all there, and
 * anything that came up came up as a bar.
 *
 * So this is a fixed frame with three parts and nothing else:
 *
 *   HEADER      one band — what this is, which dog, which facts.
 *   WORKSPACE   the regions. On a wide screen all five are on screen at once,
 *               which is what a dashboard is. On a narrow screen the animal is
 *               on top and one region is below it, chosen from a strip.
 *   COMMAND BAR the five things you can do to a dog, and the one thing you
 *               can say. They never leave the bottom of the frame.
 *
 * There is no page to scroll to, because there is no second page.
 */

const IllustratedDog = lazy(() => import('./components/IllustratedDog').then(m => ({ default: m.IllustratedDog })));

const DogAvatar3D = lazy(() =>
  import('./components/DogAvatar3D').then((m) => ({ default: m.DogAvatar3D }))
);
// A REAL MODEL, when the record has one attached. The drawn animal is the
// fallback, so a record with no model still gets a dog.
const RiggedAvatar = lazy(() =>
  import('./components/RiggedAvatar').then((m) => ({ default: m.RiggedAvatar }))
);
const CommonsPanel = lazy(() =>
  import('./components/CommonsPanel').then((m) => ({ default: m.CommonsPanel }))
);
const CoachPanel = lazy(() =>
  import('./components/CoachPanel').then((m) => ({ default: m.CoachPanel }))
);
const RecordPanel = lazy(() =>
  import('./components/RecordPanel').then((m) => ({ default: m.RecordPanel }))
);

/** Coat starting points for a new dog; every colour can then be changed. */
const COAT_PRESETS: { label: string; coat: { pattern: CoatPattern; base: string; light: string; dark: string; point: string } }[] = [
  { label: 'Bangkaew', coat: { pattern: 'bangkaew', base: '#ece7de', light: '#f8f6f1', dark: '#211c18', point: '#9a6c43' } },
  { label: 'Solid', coat: { pattern: 'solid', base: '#d9a441', light: '#f5e6c8', dark: '#5a3a1a', point: '#d9a441' } },
  { label: 'Saddle', coat: { pattern: 'saddle', base: '#8a4a22', light: '#f0e2d0', dark: '#2b1a0e', point: '#8a4a22' } },
  { label: 'Mask', coat: { pattern: 'mask', base: '#c98a2e', light: '#f7efe2', dark: '#2a1a10', point: '#c98a2e' } },
  { label: 'Spotted', coat: { pattern: 'spotted', base: '#f2efe8', light: '#ffffff', dark: '#1d1a17', point: '#f2efe8' } },
];

type RegionKey = 'care' | 'coach' | 'record' | 'commons';

const REGIONS: { key: RegionKey; label: string }[] = [
  { key: 'care', label: 'Care' },
  { key: 'coach', label: 'Coach' },
  { key: 'record', label: 'Record' },
  { key: 'commons', label: 'Commons' },
];

/** How long a note stays on screen before it lets the content back. */
const NOTE_TTL_MS = 7000;

/**
 * TRUE when the frame is wide enough to be a dashboard.
 *
 * The width is read from `innerWidth` rather than a media query, because a
 * media query is a statement about the LAYOUT, and what this needs to know is
 * how much room the frame has been given. They usually agree; when they do
 * not, the frame is the truth.
 */
function useWide(): boolean {
  // The dashboard needs WIDTH and HEIGHT. Five regions side by side is a
  // dashboard; five regions in a 768px-tall window are five letterboxes,
  // each one scrolling to show what it was built to show. So the switch is
  // made on the space the frame was actually given, not on the width alone.
  const read = () =>
    typeof window === 'undefined'
      ? true
      : window.innerWidth >= 1024 && window.innerHeight >= 820;
  const [wide, setWide] = useState(read);
  useEffect(() => {
    const onResize = () => setWide(read());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return wide;
}

export const App: React.FC = () => {
  const workspaceRef=useRef<HTMLElement|null>(null);
  const [workspaceReady,setWorkspaceReady]=useState(false);
  useEffect(()=>{
    const el=workspaceRef.current;if(!el)return;
    const update=()=>setWorkspaceReady(!el.querySelector('[data-workspace-loading]'));
    const observer=new MutationObserver(update);observer.observe(el,{childList:true,subtree:true});update();
    return()=>observer.disconnect();
  },[]);
  const firstGuide=useFirstPlayTips();
  const [dogs, setDogsView] = useState<DogProfile[]>(() => loadStoredDogs(householdDefaults()));
  const [activeDogId, setActiveDogId] = useState<string>(() => {const id=loadActiveDogId(householdDefaults()[0].id);return dogs.some(dog=>dog.id===id)?id:dogs[0].id;});
  const [careExtra,setCareExtra]=useState<'food'|'bed'|null>(null);
  const [coachRequest,setCoachRequest]=useState<'fetch'|undefined>();
  // A live park invite (?park=<room>) opens straight into the park.
  const [liveRoom,setLiveRoom]=useState<string|null>(()=>{const room=new URLSearchParams(location.search).get('park');return room&&validRoom(room)?room:null;});
  const [activeRegion, setActiveRegion] = useState<RegionKey>(()=>liveRoom?'commons':'care');
  useEffect(()=>{const url=new URL(location.href);if(liveRoom)url.searchParams.set('park',liveRoom);else url.searchParams.delete('park');if(url.href!==location.href)history.replaceState(history.state,'',url);},[liveRoom]);
  const outing=useRef({distance:0,seconds:0});
  useEffect(()=>{outing.current={distance:0,seconds:0};},[activeRegion,activeDogId]);

  // The dog's inner life — trust, arousal, personality, associations, the
  // observation log and the ledger of behaviours being taught. One state per
  // dog, so Expo, Mali and Bangal never share a memory.
  const [petState, setPetView] = useState<PetState>(() => loadPetState(activeDogId));
  const activeDogRef=useRef(activeDogId);
  const [saveError,setSaveError]=useState<string|null>(null);
  const [legacyWarning,setLegacyWarning]=useState(false);
  const refresh=useCallback(()=>{
    const latest=loadStoredDogs(householdDefaults());setDogsView(latest);
    if(!latest.some(dog=>dog.id===activeDogRef.current)){
      activeDogRef.current=latest[0].id;setActiveDogId(latest[0].id);
    }
    setPetView(loadPetState(activeDogRef.current));
  },[]);
  const failedSave=useCallback((error:unknown)=>{
    console.error('Progress save failed',error);
    setSaveError(error instanceof Error&&/recovery|could not be read/.test(error.message)?'Saved progress could not be read. It has not been replaced.':'Could not save this action. Previous progress is intact. Please try again.');
  },[]);
  const commitPet=useCallback(async(update:PetMutation,care?:'feed'|'play'|'walk'|'groom'):Promise<PetState|null>=>{
    try{const next=await mutatePet(activeDogId,update,care);refresh();setSaveError(null);return next;}
    catch(error){failedSave(error);return null;}
  },[activeDogId,refresh,failedSave]);
  const commitDogs=useCallback(async(update:(latest:DogProfile[])=>DogProfile[]):Promise<boolean>=>{
    try{await mutateDogs(update);refresh();setSaveError(null);return true;}
    catch(error){failedSave(error);return false;}
  },[refresh,failedSave]);

  const isWide = useWide();

  // Interactive 3D triggers
  /** What the practice field asked the dog's body to do. */
  const [gameControlsHost,setGameControlsHost]=useState<HTMLDivElement|null>(null);
  const [poseRequest,setPoseRequest]=useState<PoseRequest|null>(null);
  const avatarPose:AvatarPose=poseRequest?.pose??'stand';
  const poseCounter=useRef(0);
  const pendingPose=useRef<{id:number;resolve:(at:number|null)=>void;timer:ReturnType<typeof setTimeout>}|null>(null);
  const stageContext=useRef({blocked:false,model:false});
  const performPose:PerformPose=useCallback((pose:AvatarPose)=>{
    if(pendingPose.current){clearTimeout(pendingPose.current.timer);pendingPose.current.resolve(null);pendingPose.current=null;}
    if(pose==='stand'){setPoseRequest(null);return Promise.resolve(null);}
    if(stageContext.current.blocked||stageContext.current.model)return Promise.resolve(null);
    const id=++poseCounter.current;
    return new Promise<number|null>(resolve=>{
      const timer=setTimeout(()=>{if(pendingPose.current?.id===id){pendingPose.current=null;setPoseRequest(null);resolve(null);}},6000);
      pendingPose.current={id,resolve,timer};setPoseRequest({id,pose});
    });
  },[]);
  const completePose=useCallback((id:number,at:number)=>{
    const pending=pendingPose.current;if(!pending||pending.id!==id)return;
    clearTimeout(pending.timer);pendingPose.current=null;pending.resolve(at);
  },[]);
  useEffect(()=>()=>{if(pendingPose.current){clearTimeout(pendingPose.current.timer);pendingPose.current.resolve(null);}},[]);
  useEffect(()=>{
    if(avatarPose!=='stand')void commitPet(prev=>({...prev,calmSince:undefined}));
  },[avatarPose,commitPet]);
  const [interactionTrigger, setInteractionTrigger] = useState<AvatarInteractionTrigger>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionBusy=useRef(false);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (actionTimer.current) clearTimeout(actionTimer.current); }, []);
  const [pendingAction, setPendingAction] = useState<CareAction | null>(null);

  // The note — what the dog just did, said once, under the animal.
  const [note, setNote] = useState<{ text: string; id: number } | null>(null);
  const noteTimer = useRef<number | null>(null);

  const [isDogMenuOpen, setIsDogMenuOpen] = useState(false);
  const [labelsVisible,setLabelsVisible]=useState(false);
  const regionBeforeLabels=useRef<RegionKey>('care');
  const closeLabels=()=>{setLabelsVisible(false);setActiveRegion(regionBeforeLabels.current);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[aria-label="Show control labels"]')?.focus());};
  const toggleLabels=()=>{
    if(labelsVisible){closeLabels();return;}
    regionBeforeLabels.current=isDogMenuOpen?regionBeforeChooser.current:activeRegion;
    setIsDogMenuOpen(false);setActiveRegion('care');setLabelsVisible(true);
    requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[aria-label="Close control labels"]')?.focus());
  };
  const regionBeforeChooser=useRef<RegionKey>('care');
  // Park <-> home. Coming home from a real outing credits the walk.
  const togglePark=()=>{setIsDogMenuOpen(false);setLabelsVisible(false);if(activeRegion==='commons'){const trip={...outing.current};outing.current={distance:0,seconds:0};if(trip.seconds>=10&&trip.distance>=120)void commitPet(base=>completeParkWalk(base,Date.now(),trip.seconds,trip.distance)).then(saved=>{if(saved&&saved.game?.lastOutingAt&&Date.now()-saved.game.lastOutingAt<1500)say('Home from a sniff walk: calmer, closer, less bored. +3 paw coins.');});}setActiveRegion(activeRegion==='commons'?'care':'commons');};
  const closeDogChooser=()=>{setIsDogMenuOpen(false);setActiveRegion(regionBeforeChooser.current);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[aria-controls="dog-switcher"]')?.focus());};
  const toggleDogChooser=()=>{
    if(isDogMenuOpen){closeDogChooser();return;}
    regionBeforeChooser.current=labelsVisible?regionBeforeLabels.current:activeRegion;setLabelsVisible(false);setActiveRegion('care');setIsDogMenuOpen(true);
  };
  useEffect(()=>{
    if(!isDogMenuOpen&&!labelsVisible)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();if(labelsVisible){closeLabels();return;}setIsDogMenuOpen(false);setActiveRegion(regionBeforeChooser.current);document.querySelector<HTMLButtonElement>('[aria-controls="dog-switcher"]')?.focus();}};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[isDogMenuOpen,labelsVisible]);
  const [isAddDogOpen, setIsAddDogOpen] = useState(false);
  const enrollmentBusy=useRef(false);
  const [isEnrolling,setIsEnrolling]=useState(false);

  const [newDogName, setNewDogName] = useState('');
  const [newDogBreed, setNewDogBreed] = useState('');
  const [newDogBirth, setNewDogBirth] = useState('');
  const [newDogSex, setNewDogSex] = useState<'male' | 'female'|''>('');
  const [newDogCoat, setNewDogCoat] = useState(COAT_PRESETS[1].coat);

  const currentDog = dogs.find((d) => d.id === activeDogId) || dogs[0];
  stageContext.current={blocked:!!calmNeed(petState,'training')||isInteracting||isAddDogOpen,model:!!currentDog.avatarConfig.customModelUrl};
  useEffect(()=>{if(stageContext.current.blocked)void performPose('stand');},[petState.sleep.asleep,petState.sick,petState.needs.energy,petState.needs.hunger,petState.needs.hygiene,petState.life?.bladder,petState.life?.peeCount,petState.poopCount,isInteracting,isAddDogOpen,performPose]);
  // While a new dog is being enrolled, the stage shows the coat being chosen.
  const previewDog: DogProfile = {
    ...currentDog,
    id: 'preview',
    name: newDogName.trim() || 'New dog',
    breed: newDogBreed.trim() || 'Your dog',
    avatarConfig: {
      ...currentDog.avatarConfig,
      pattern: newDogCoat.pattern,
      baseColor: newDogCoat.base,
      secondaryColor: newDogCoat.light,
      maskColor: newDogCoat.dark,
      pointColor: newDogCoat.point,
      furFluff: 0.6,
      customModelUrl: undefined,
    },
  };
  const starterAge=recordSources(currentDog).fields.includes('birthDate');
  const age = calculateDogAge(currentDog.birthDate, currentDog.weightKg);
  const subject = { name: currentDog.name, sex: currentDog.sex } as const;

  // Switch identity and state in one React batch, before the save effect runs.
  const selectDog = (id: string) => {
    interactionBusy.current=false;
    if (actionTimer.current) clearTimeout(actionTimer.current);
    setActiveDogId(id);
    activeDogRef.current=id;
    setPetView(loadPetState(id));
    setInteractionTrigger(null);
    setIsInteracting(false);
    setPendingAction(null);
    void performPose('stand');
    setNote(null);
  };

  useEffect(()=>{void commitPet(state=>({...state,game:gameState(state,activeDogId)}));},[commitPet,activeDogId]);
  useEffect(()=>{
    const changed=(event:StorageEvent)=>{
      if(event.key===SAVE_KEY)refresh();
      else if([modeKey('canine_os_pet_states_v1'),modeKey('canine_os_dogs_v1')].includes(event.key??'')&&localStorage.getItem(SAVE_KEY))setLegacyWarning(true);
    };
    window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
  },[refresh]);

  useEffect(() => {
    saveActiveDogId(activeDogId);
  }, [activeDogId]);

  /**
   * THE DRIFT.
   *
   * One model governs the needs, and it is the model's own: the dog drifts
   * whether anyone is watching. The old build ran a second, simpler timer
   * that subtracted a point a minute from a different copy of the same
   * numbers, and the two fought. Now there is one decay, applied here and
   * again on load, so the figures on screen are the figures for right now.
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      void commitPet((prev) => {
        const drifted = decay(prev);
        // HE GOES TO BED ON HIS OWN.
        //
        // A Tamagotchi does not wait to be put down: at night, or when he is
        // spent, he finds his bed. You can wake him — and pay for it — but
        // you cannot make him stay awake.
        if (willSettle(drifted)) {
          const settled = settleSleep(drifted);
          return { ...settled.state, call: undefined };
        }
        // HE CALLS YOU. A need runs low, or nobody has been near him for a
        // while, and he asks. Ignored, the call fades on its own.
        // The Care sentence and on-stage need own automatic calls. A second
        // bottom overlay would hide the floor precisely when a puddle appears.
        const { call } = tickCall(drifted);
        return { ...drifted, call };
      });
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [commitPet]);

  /**
   * TIME TOGETHER — the currency.
   *
   * Counted in 15-second slices, and only while the page is in front of you
   * and you have touched it in the last half minute. Leaving the tab open
   * overnight earns nothing.
   */
  useEffect(() => {
    let lastActive = Date.now();
    const touch = () => (lastActive = Date.now());
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const SLICE = 15;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastActive > 30_000) return;
      void commitPet(prev=>{
        const now=Date.now(),seconds=Math.max(0,Math.min(SLICE,(now-(prev.lastTogetherAt??now-SLICE*1000))/1000));
        return seconds?growCompanion({...prev,together:addTogether(prev.together,seconds,now),lastTogetherAt:now},seconds,now):prev;
      });
    }, SLICE * 1000);
    return () => {
      window.clearInterval(id);
      events.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [commitPet]);

  // A call shows in the tab title too, so it reaches you in another tab.
  useEffect(() => {
    const base = 'Tama-Dog-Chi — dog.nonarkara.org';
    document.title = petState.call ? `● ${currentDog.name} is calling — ${base}` : base;
  }, [petState.call, currentDog.name]);

  const priorSleep=useRef({id:activeDogId,asleep:petState.sleep.asleep});
  useEffect(()=>{const prev=priorSleep.current;if(prev.id===activeDogId&&prev.asleep&&!petState.sleep.asleep&&gameState(petState,activeDogId).wakeBark&&document.visibilityState==='visible')sound.bark();priorSleep.current={id:activeDogId,asleep:petState.sleep.asleep};},[activeDogId,petState.sleep.asleep,petState.game?.wakeBark]);

  /** Say a note once, and then let the content back. */
  const say = (text: string) => {
    setNote({ text, id: Date.now() });
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), NOTE_TTL_MS);
  };

  useEffect(() => () => {
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
  }, []);

  /**
   * THE VISIBLE MIRROR OF THE STATE.
   *
   * The dog's record carries the meters too, and the record is what gets
   * exported. So the record follows the model — it is a copy of the truth,
   * written when the truth changes, never a second opinion about it.
   */
  const handleInteract = async (action: CareAction,part?:TouchPart) => {
    if(isAddDogOpen)return;
    if (interactionBusy.current) return;
    if(action==='pet')firstGuide.show('pet');
    interactionBusy.current=true;
    const id=activeDogId;
    setIsInteracting(true);setPendingAction(action);
    let message='',trigger:AvatarInteractionTrigger=action;
    const care=['feed','play','walk','groom'].includes(action)?action as 'feed'|'play'|'walk'|'groom':undefined;
    const next=await commitPet(latest=>{
      if((action==='play'||action==='walk')&&latest.sick){message=`${currentDog.name} needs rest. We can play again after recovery.`;trigger=null;return latest;}
      const touched=part?discoverTouch(latest,id,part):latest;
      const result=interact(touched,action,Date.now(),subject);
      const answer=answerCall(latest,action);
      message=answer.answered?`${result.note} You came when ${subject.sex==='female'?'she':'he'} called. Trust +${answer.trustBonus}.`:result.note;
      if(action==='rewardCalm'&&result.state.lastCalmRewardAt===latest.lastCalmRewardAt)trigger=null;
      if(action==='feed'&&result.state.needs.hunger<=latest.needs.hunger)trigger=null;
      if(part&&part===(TOUCH_PREFERENCES[id]??'chest'))result.state={...result.state,trust:Math.min(100,result.state.trust+1)};
      if(action==='play'&&(latest.sick||result.state.sleep.asleep))trigger=null;
      return answer.answered?{...result.state,call:undefined,trust:Math.min(100,result.state.trust+answer.trustBonus)}:result.state;
    },care);
    if(activeDogRef.current!==id)return;
    if(!next){interactionBusy.current=false;setIsInteracting(false);setPendingAction(null);return;}
    setInteractionTrigger(trigger);say(message);
    if(action==='walk'&&trigger){setCareExtra(null);setActiveRegion('commons');}
    actionTimer.current=setTimeout(()=>{interactionBusy.current=false;setIsInteracting(false);setPendingAction(null);setInteractionTrigger(null);},2000);
  };

  const handleMiniGameComplete = async (won: boolean, kind:'catch'|'find-treat'='catch') => {
    if(isAddDogOpen)return;
    const id=activeDogId;let accepted=false;
    const next=await commitPet(base=>{
      if(base.sick||base.sleep.asleep)return base;
      accepted=true;
      if(kind==='find-treat')return {...base,needs:{...base.needs,energy:Math.max(0,base.needs.energy-4)},trust:Math.min(100,base.trust+(won?3:1)),arousal:Math.min(80,base.arousal+6),life:{...dailyLife(base),boredom:Math.max(0,dailyLife(base).boredom-50)},lastCareAt:Date.now(),calmSince:undefined,call:['lonely','bored'].includes(base.call?.reason||'')?undefined:base.call};
      return won?{...base,arousal:Math.max(20,Math.min(80,base.arousal+15)),trust:Math.min(100,base.trust+5),weightKg:Math.max(15,(base.weightKg??24.8)-.1),calmSince:undefined}:base;
    },'play');
    if(!next||activeDogRef.current!==id)return;
    if(!accepted){say(`${currentDog.name} needs rest. We can play again later.`);return;}
    say(kind==='find-treat'?(won?`${currentDog.name} found the treats. Clever nose! Trust +3.`:`A little sniffing practice together. Trust +1.`):(won?`Agility catch victory! ${currentDog.name} caught the balls with joyful barks. Trust +5!`:`Good effort! ${currentDog.name} burned energy and enjoyed the practice.`));
  };

  const handleCommunicate = async (cue: string) => {
    if(isAddDogOpen)return;
    if(interactionBusy.current)return;
    interactionBusy.current=true;
    setIsInteracting(true);
    const id=activeDogId;let message='';
    const next=await commitPet(latest=>{const result=communicate(latest,cue,Date.now(),subject);message=result.note;return result.state;});
    if(activeDogRef.current!==id)return;
    if(!next){interactionBusy.current=false;setIsInteracting(false);return;}
    say(message);
    if(message.includes('knows')){
      setInteractionTrigger('communicate');setIsInteracting(true);
      actionTimer.current=setTimeout(()=>{interactionBusy.current=false;setIsInteracting(false);setInteractionTrigger(null);},2000);
    }else{interactionBusy.current=false;setIsInteracting(false);}
  };

  const handleBed = async () => {
    if(isAddDogOpen)return;
    if(interactionBusy.current)return;
    interactionBusy.current=true;setIsInteracting(true);
    const id=activeDogId;let message='';
    const next=await commitPet(latest=>{const result=settleSleep({...latest,game:gameState(latest,id)},Date.now(),subject);message=result.note;return result.state;});
    if(activeDogRef.current!==id)return;
    interactionBusy.current=false;setIsInteracting(false);
    if(next)say(message);
  };

  const handleUpdateCurrentDog = (update:DogMutation) => {
    const id=currentDog.id;
    return commitDogs(latest=>{
      if(!latest.some(dog=>dog.id===id))throw new Error('This dog is no longer in the saved record.');
      return latest.map(dog=>dog.id===id?update(dog):dog);
    });
  };

  const handleAddPhotoToDog = async (url:string,angle:'front'|'side'|'closeup'|'body') => {
    const photo={id:`photo-${crypto.randomUUID()}`,url,angle,dateTaken:new Date().toISOString().split('T')[0],notes:`User uploaded ${angle} view`};
    return handleUpdateCurrentDog(latest=>({...latest,photos:[...latest.photos,photo]}));
  };

  const handleCreateNewDog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDogName.trim()||!newDogSex) return;
    if(enrollmentBusy.current)return;
    enrollmentBusy.current=true;setIsEnrolling(true);

    const newDog: DogProfile = {
      id: `dog-${crypto.randomUUID()}`,
      name: newDogName.trim(),
      callName: newDogName.trim(),
      breed: newDogBreed.trim() || 'Mixed Breed',
      birthDate: newDogBirth,
      sex: newDogSex,
      isNeutered: null,
      microchipId: '',
      weightKg: 0,
      coatColor: `${COAT_PRESETS.find((c) => c.coat.pattern === newDogCoat.pattern)?.label ?? 'Custom'} coat`,
      distinctiveMarks: [],
      personalityTraits: [],
      favoriteFood: '',
      favoriteToy: '',
      quirks: [],
      primaryVetClinic: '',
      emergencyPhone: '',
      primaryPhotoUrl: '',
      photos: [],
      vaccinations: [],
      parasiteControl: [],
      medicalHistory: [],
      tamagotchi: {
        hunger: 80,
        happiness: 85,
        energy: 80,
        hygiene: 80,
        lastFed: 0,
        lastPlayed: 0,
        lastWalked: 0,
        lastGroomed: 0,
      },
      metaverseTribe: 'The Roaming Pack',
      metaverseBio: 'Ready to explore the canine commons.',
      avatarConfig: {
        pattern: newDogCoat.pattern,
        baseColor: newDogCoat.base,
        secondaryColor: newDogCoat.light,
        maskColor: newDogCoat.dark,
        pointColor: newDogCoat.point,
        furFluff: 0.6,
        earShape: 'pricked',
        tailShape: 'curl',
      },
    };

    const enrolled=await commitDogs(latest=>[...latest,newDog]);
    enrollmentBusy.current=false;setIsEnrolling(false);
    if(!enrolled)return;
    selectDog(newDog.id);
    setIsAddDogOpen(false);
    setNewDogName('');
    setNewDogBreed('');
    setNewDogBirth('');setNewDogSex('');
    say(`${newDog.name.trim()} is enrolled.`);
  };

  const resetToFactoryDefaults = async () => {
    if (window.confirm('Reset all dog profiles to the factory defaults?')) {
      try{await resetProgress();refresh();}catch(error){failedSave(error);return;}
      selectDog(householdDefaults()[0].id);
      say('Profiles reset to the factory defaults.');
    }
  };

  /**
   * THE REGIONS.
   *
   * On a wide screen every region is on screen, because that is what a
   * dashboard is. On a narrow screen the animal is on top and one region sits
   * below it — chosen from the strip, not by scrolling to it.
   */
  const renderRegion = (key: RegionKey) => {
    switch (key) {
      case 'care':
        if(careExtra&&!isDogMenuOpen&&!labelsVisible)return <CareExtras kind={careExtra} dog={currentDog} state={petState} busy={isInteracting} onClose={()=>setCareExtra(null)} onBuy={async()=>{let note='';const saved=await commitPet(base=>{const result=buyFood(base);note=result.note;return result.state;});if(saved)say(note);}} onFeed={()=>handleInteract('feed')} onBed={handleBed} onPreference={async(wakeMinute,wakeBark)=>{const next=await commitPet(base=>({...base,game:{...gameState(base,currentDog.id),wakeMinute,wakeBark}}));if(next&&wakeBark)sound.bark();}}/>;
        if(labelsVisible)return <ControlLegend onClose={closeLabels}/>;
        return isDogMenuOpen?<DogChooser dogs={dogs} activeId={activeDogId} onClose={closeDogChooser} onSelect={id=>{selectDog(id);closeDogChooser();}} onEnroll={()=>{closeDogChooser();setIsAddDogOpen(true);}}/>:<CarePanel dog={currentDog} petState={petState} />;
      case 'coach':
        return (
          <Suspense fallback={<RegionLoading label="Coach" />}>
            <CoachPanel
              dog={currentDog}
              petState={petState}
              key={activeDogId}
              onPetStateChange={commitPet}
              onPose={performPose}
              requestedBehaviour={coachRequest}
              busy={isInteracting||isAddDogOpen}
            />
          </Suspense>
        );
      case 'record':
        return (
          <Suspense fallback={<RegionLoading label="Record" />}>
            <RecordPanel key={activeDogId}
              dog={currentDog}
              onUpdateDog={handleUpdateCurrentDog}
              onAddPhoto={handleAddPhotoToDog}
            />
          </Suspense>
        );
      case 'commons':
        return (
          <Suspense fallback={<RegionLoading label="Commons" />}>
            <CommonsPanel guide={firstGuide.tip?<FirstPlayTip tip={firstGuide.tip} onClose={firstGuide.close}/>:null} myDog={currentDog} petState={petState} onSocialize={()=>commitPet(base=>socialize(base,Date.now()))} onWalk={(distance,seconds)=>{outing.current.distance+=distance;outing.current.seconds+=seconds;}} onPet={()=>handleInteract('pet')} onGoHome={togglePark} liveRoom={liveRoom} onLiveRoom={setLiveRoom} />
          </Suspense>
        );
    }
  };

  const stageNote=saveError?{text:saveError,id:-1}:legacyWarning?{text:'An older dog tab is open. Reload it before playing there; this tab’s progress is protected.',id:-2}:note;

  return (
    <div className="cockpit" onClickCapture={firstGuide.capture} style={dogTheme(currentDog.id)} data-dog-theme={currentDog.id} data-vw={typeof window === 'undefined' ? 0 : window.innerWidth}>
      {/* ---- one band of chrome -------------------------------------------- */}
      <header className="border-hairline-b bg-surface shrink-0 no-print">
        <div className="h-11 px-2 sm:px-3 flex items-center gap-2 sm:gap-3">
          <span className="app-brand font-display text-[15px] text-white shrink-0">
            <a href="/" aria-label="Tama-Dog-Chi modes">Tama-Dog-Chi</a>
          </span>

          {playMode()==='own'&&<span className="owned-growth" title="Game growth: one minute of active attention on each of seven different days.">{growthStage(petState).name} · {petState.growth?.careDays?.length??0}/7</span>}
          {/* The chooser uses the existing Care region instead of covering the dog. */}
          <div className="relative shrink-0">
            <button
              onClick={toggleDogChooser}
              onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();if(!isDogMenuOpen)toggleDogChooser();requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('#dog-switcher [aria-selected="true"]')?.focus());}}}
              aria-haspopup="listbox"
              aria-expanded={isDogMenuOpen}
              aria-controls="dog-switcher"
              className="btn-quiet min-h-10 px-2 text-[13px] whitespace-nowrap"
            >
              <Dog size={13} aria-hidden="true" />
              {currentDog.name}
              <ChevronDown size={13} aria-hidden="true" />
            </button>


          </div>

          <button type="button" className={`btn-quiet park-navigation ${activeRegion==='commons'?'park-navigation--home':''}`} aria-label={activeRegion==='commons'?'Back to dog':'Open Commons park'} onClick={()=>togglePark()}><Trees size={20}/><span>{activeRegion==='commons'?'Home':'Park'}</span></button>
          {/* The facts about the dog you are with. */}
          <p className="header-dog-facts min-w-0 flex-1 truncate text-[12px] text-zinc-400">
            <span className="text-zinc-300">{currentDog.breed}</span>
            {!starterAge&&currentDog.birthDate&&<><span className="text-zinc-600"> / </span><span className="data">{age.formattedCalendarAge} / {age.dogYears} dog years</span></>}
          </p>

          <span title="Color palette for this dog; not a measured personality" className="hidden lg:inline text-[11px] text-faint shrink-0">
            Palette · {DOG_THEMES[currentDog.id]?.name || 'Your companion'}
          </span>

          <button
            onClick={resetToFactoryDefaults}
            className="btn-quiet min-h-10 px-2 shrink-0"
            aria-label="Reset all dog profiles to the factory defaults"
            title="Reset profiles to defaults"
          >
            <RotateCcw size={13} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ---- the regions ----------------------------------------------------- */}
      <main
        ref={workspaceRef}
        aria-busy={!workspaceReady}
        data-study-ready={workspaceReady}
        className={`cockpit-workspace ${
          activeRegion==='commons' ? 'cockpit-workspace--park' : isWide ? 'cockpit-workspace--wide' : 'cockpit-workspace--tall'
        }`}
      >
        {activeRegion==='commons' ? renderRegion('commons') : <>
        {/* The animal. The biggest region on the screen, and the one the
            reader came for. */}
        <section className="panel region-stage" aria-label={`${currentDog.name}, live avatar`}>
          {/* The page's heading. The dog's name is VISIBLE in the header band —
              but there it is a control, a disclosure you open to change dogs.
              A control is not a heading, so the document still needs one: this
              is the same name, said once, as the subject of the page. It is
              hidden because it is already on the screen; it is not hidden
              because it is unimportant. */}
          <h1 className="sr-only">
            {currentDog.name}, {currentDog.breed}
          </h1>
          <div className="panel-body">
            <div className="stage-frame" data-feedback={!!note}>
              <div className="stage-canvas">
              <Suspense fallback={<StageLoading name={currentDog.name} />}>
                {!isAddDogOpen && currentDog.avatarConfig.customModelUrl ? (
                  <RiggedAvatar
                    dog={currentDog}
                    petState={petState}
                    url={currentDog.avatarConfig.customModelUrl}
                    interactionTrigger={interactionTrigger}
                    onInteractionEnd={() => setInteractionTrigger(null)}
                  />
                ) : (
                  <IllustratedDog
                    key={currentDog.id}
                    dog={isAddDogOpen ? previewDog : currentDog}
                    petState={petState}
                    pose={avatarPose}
                    poseRequest={poseRequest}
                    onPoseComplete={completePose}
                    onPet={(part) => handleInteract('pet',part)}
                    onTeachFetch={()=>{setCareExtra(null);setCoachRequest('fetch');setActiveRegion('coach');}}
                    onClean={() => handleInteract('clean')}
                    controlsHost={gameControlsHost}
                    onCare={handleInteract}
                    onBed={handleBed}
                    onMiniGameComplete={handleMiniGameComplete}
                    interactionTrigger={interactionTrigger}
                    fallback={
                      <DogAvatar3D
                        key={currentDog.id}
                        dog={isAddDogOpen ? previewDog : currentDog}
                        petState={petState}
                        pose={avatarPose}
                        poseRequest={poseRequest}
                        onPoseComplete={completePose}
                        onPet={() => handleInteract('pet')}
                        onClean={() => handleInteract('clean')}
                        controlsHost={gameControlsHost}
                        onMiniGameComplete={handleMiniGameComplete}
                        interactionTrigger={interactionTrigger}
                        onInteractionEnd={() => setInteractionTrigger(null)}
                      />
                    }
                    onInteractionEnd={() => setInteractionTrigger(null)}
                  />
                )}
              </Suspense>
            </div>

            {/* Feedback has its own row: never place text over the dog. */}
            <div className={`stage-note-slot ${firstGuide.tip&&!saveError?'stage-note-slot--guide':''}`} data-open={!!stageNote||!!firstGuide.tip}>
            {firstGuide.tip&&!saveError&&<FirstPlayTip tip={firstGuide.tip} onClose={firstGuide.close}/>}
            {stageNote && (
              <div className="bar bar--note" role="status" key={stageNote.id}>
                <p className="text-[12px] leading-snug text-zinc-100 flex-1 min-w-0 truncate" title={stageNote.text}>
                  {stageNote.text}
                </p>
                <button
                  onClick={() => {setNote(null);setSaveError(null);setLegacyWarning(false);}}
                  className="btn-quiet px-1.5 shrink-0"
                  aria-label="Dismiss"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            )}
            </div>
            </div>
            {petState.growth&&<div className="growth-caption"><span className="growth-days" role="progressbar" aria-label="Care days toward adulthood" aria-valuemin={0} aria-valuemax={7} aria-valuenow={petState.growth.careDays.length}>{Array.from({length:7},(_,i)=><i key={i} data-earned={i<petState.growth!.careDays.length}/>)}</span><span>1 min × 7 care days → adult</span><button type="button" className="growth-backup" aria-label={`Back up ${currentDog.name}`} title="Stored in this browser. Download a backup to keep your dog if you clear site data or change devices." onClick={()=>{try{downloadOwnedBackup(currentDog.name);say('Backup ready. Restore it from the mode screen.');}catch{setSaveError('Could not create a complete backup yet. Please try again.');}}}><Download size={16}/><span>Backup</span></button></div>}
            <div className="stage-game-dock" hidden={isDogMenuOpen} ref={setGameControlsHost} aria-label="Dog game controls"/>
          </div>
        </section>

        {isWide ? (
          <>
            {renderRegion('care')}
            <div className="desktop-region-tabs" role="tablist" aria-label="Desktop tools">{(['coach','record'] as const).map(key=><button key={key} type="button" role="tab" aria-label={key==='coach'?'Coach':'Record'} aria-selected={(activeRegion==='record'?'record':'coach')===key} onClick={()=>setActiveRegion(key)}>{key==='coach'?<GraduationCap size={18}/>:<BookOpen size={18}/>}<span>{key==='coach'?'Coach':'Record'}</span></button>)}</div>
            <div className="desktop-detail">{renderRegion(activeRegion==='record'?'record':'coach')}</div>
          </>
        ) : (
          <>
            {/* Which region, on a screen that can only show one. */}
            <div role="tablist" aria-label="Regions" className="flex border-hairline bg-surface">
              {REGIONS.map((r) => {
                const active = r.key === activeRegion;
                return (
                  <button
                    key={r.key}
                    role="tab"
                    type="button"
                    aria-label={r.label}
                    title={r.label}
                    aria-selected={active}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => {setIsDogMenuOpen(false);setLabelsVisible(false);setCareExtra(null);setActiveRegion(r.key);}}
                    className={`flex-1 min-h-9 px-1 text-[11px] border-hairline-r last:border-hairline-r-0 ${
                      active ? 'bg-zinc-900 text-accent font-semibold' : 'text-zinc-400'
                    }`}
                  >
                    {React.createElement(({care:Heart,coach:GraduationCap,record:BookOpen,commons:Trees})[r.key],{size:20,'aria-hidden':true})}
                    <span className="sr-only">{r.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="region-frame">{renderRegion(activeRegion)}</div>
          </>
        )}

        </>}
        {/* ---- enroll a dog, as a bar ---------------------------------------
            It lives INSIDE the workspace, so it sits on top of the content
            and directly above the command bar — never over the controls, and
            never over the whole screen. */}
        {isAddDogOpen && (
          <form
            onSubmit={handleCreateNewDog}
            className="bar bar--stack max-w-2xl"
            role="dialog"
            aria-label="Enroll a new dog"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="label shrink-0">Enroll a dog</span>
              <input
                type="text"
                value={newDogName}
                onChange={(e) => setNewDogName(e.target.value)}
                placeholder="Name"
                aria-label="Dog name"
                className="flex-1 min-w-0 px-2 py-1 text-xs"
                required
                autoFocus
              />
              <input
                type="text"
                value={newDogBreed}
                onChange={(e) => setNewDogBreed(e.target.value)}
                placeholder="Breed"
                aria-label="Breed"
                className="flex-1 min-w-0 px-2 py-1 text-xs"
                required
              />
              <input
                type="date"
                value={newDogBirth}
                onChange={(e) => setNewDogBirth(e.target.value)}
                aria-label="Birth date (optional)"
                title="Birth date, if known"
                className="px-2 py-1 text-xs shrink-0"
              />
              <select
                value={newDogSex}
                onChange={(e) => setNewDogSex(e.target.value as 'male' | 'female')}
                aria-label="Sex"
                required
                className="px-2 py-1 text-xs shrink-0"
              >
                <option value="" disabled>Sex</option>
                <option value="male">He</option>
                <option value="female">She</option>
              </select>
            </div>
            {/* The coat, previewed on the stage as you choose it. */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="label shrink-0">Coat</span>
              {COAT_PRESETS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setNewDogCoat(c.coat)}
                  aria-pressed={newDogCoat.pattern === c.coat.pattern}
                  className={`btn min-h-0 h-[24px] px-2 py-0 text-[10px] ${
                    newDogCoat.pattern === c.coat.pattern ? 'btn-accent' : 'btn-quiet border-hairline'
                  }`}
                >
                  {c.label}
                </button>
              ))}
              {(['base', 'light', 'dark', 'point'] as const).map((k) => (
                <label key={k} className="flex items-center gap-1 text-[10px] text-zinc-400">
                  {k === 'base' ? 'Main' : k === 'light' ? 'Light' : k === 'dark' ? 'Dark' : 'Tan'}
                  <input
                    type="color"
                    value={newDogCoat[k]}
                    onChange={(e) => setNewDogCoat({ ...newDogCoat, [k]: e.target.value })}
                    className="h-[24px] w-[28px] p-0 border-hairline bg-transparent"
                  />
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isEnrolling}
                onClick={() => setIsAddDogOpen(false)}
                className="btn btn-quiet text-[11px]"
              >
                Cancel
              </button>
              <button type="submit" disabled={isEnrolling} className="btn btn-accent text-[11px]">
                Create profile
              </button>
            </div>
          </form>
        )}
      </main>

      {/* ---- the controls ---------------------------------------------------- */}
      {activeRegion!=='commons'&&<CommandBar
        labelsVisible={labelsVisible}
        onToggleLabels={toggleLabels}
        dog={currentDog}
        petState={petState}
        isInteracting={isInteracting||isAddDogOpen}
        pendingAction={pendingAction}
        onInteract={action=>{if(action==='feed'){setCareExtra('food');setActiveRegion('care');setLabelsVisible(false);setIsDogMenuOpen(false);}else void handleInteract(action);}}
        onCommunicate={handleCommunicate}
        onBed={()=>{setCareExtra('bed');setActiveRegion('care');setLabelsVisible(false);setIsDogMenuOpen(false);}}
      />}
    </div>
  );
};

/** A region that has not arrived yet. A quiet plate, not a hole. */
const RegionLoading: React.FC<{ label: string }> = ({ label }) => (
  <div data-workspace-loading="true" role="status" className="flex-1 min-h-0 flex items-center justify-center bg-zinc-950">
    <div className="region-loading-lines" aria-hidden="true"><i/><i/><i/></div><span className="sr-only">{label} — loading</span>
  </div>
);

/** The scene has not arrived yet. */
const StageLoading: React.FC<{ name: string }> = ({ name }) => {
  const file=({Expo:'expo',Mali:'mali',Oreo:'oreo',Paolo:'paolo',Hachiku:'hachiku'} as Record<string,string>)[name];
  return <div data-workspace-loading="true" role="status" className="absolute inset-0 flex items-center justify-center bg-black">
    {file?<img src={`/dogs/${file}.webp`} className="stage-loading-art" alt=""/>:<div className="region-loading-lines" aria-hidden="true"><i/><i/><i/></div>}<span className="sr-only">{name} — loading</span>
  </div>;
};
