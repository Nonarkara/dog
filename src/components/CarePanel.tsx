import {MeterDeltas} from './MeterDeltas';
import {CloudSaveStatus} from './CloudSaveStatus';
import {downloadOwnedBackup} from '../utils/downloadOwnedBackup';
import {playMode} from '../utils/playMode';
import {PushOffer} from './PushOffer';
import {HOMES,isHome,type HomeId} from './homeScenes';
import {growthLabel,CHARACTER_TEXT,wishFor,WISH_SHORT} from '../domain/life';
import {recordSources} from '../utils/recordProvenance';
import { dailyLife, dailyMood } from '../domain/dailyLife';
import { calmNeed, calmRewardWait } from '../domain/calm';
import React, {useEffect,useRef,useState} from 'react';
import {Utensils, Battery, Sparkles, Smile, Heart, Activity, Clock, Leaf, Timer, Cookie} from 'lucide-react';
import type { DogProfile } from '../types/dog';
import type { PetState } from '../domain/types';
import {Help} from './Help';
import { happiness, readiness, sickCause, temperament } from '../domain/pet';
import { ANSWERS, CALL_TEXT, minutes } from '../domain/attention';
import {ILLUSTRATIONS} from '../data/dogIllustrations';
import {PhotoBooth} from './PhotoBooth';
import {Camera,ShoppingBag,Stethoscope} from 'lucide-react';
import {VitalsModal} from './VitalsModal';
import {THEME_CHOICES} from '../data/dogThemes';

interface CarePanelProps {
  dog: DogProfile;
  petState: PetState;
  detailView?:boolean;
  extras?:React.ReactNode;
  onPantry?:()=>void;
  onHome?:(home:HomeId)=>void;
  onPalette?:(palette:string)=>void;
  /** Offer quiet time, or reward the calm he has shown. */
  onCalm?:(action:'settle'|'rewardCalm')=>void;
}

type MeterKey = 'fullness' | 'energy' | 'hygiene' | 'happiness' | 'trust' | 'arousal';

interface Meter {
  key: MeterKey;
  label: string;
  value: number;
  /** What a LOW value means for this meter — some run out, some run high. */
  lowMeans: string;
  /** True when the number is the wrong way round (arousal is a band, not a tank). */
  inverted?: boolean;
}

const LOW_THRESHOLD = 30;

/**
 * THE CARE READOUT.
 *
 * Six numbers, all of them derived from one state: what the body needs, what
 * the relationship is worth, and how the animal is doing right now.
 *
 * "Happiness" is not stored anywhere — it is computed from the other five,
 * because a number kept in two places drifts and the reader ends up looking
 * at two truths.
 */
function since(at: number | undefined): string {
  if (!at) return 'never';
  const mins = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/** A clock time, for the hour a thing happened. */
function clockTime(at: number | null | undefined): string {
  if (!at) return '—';
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const CarePanel: React.FC<CarePanelProps> = ({ dog, petState, detailView=false, extras, onPantry, onHome, onPalette, onCalm }) => {
  const details=useRef<HTMLDialogElement>(null);
  const [backupNote,setBackupNote]=useState('');
  const [booth,setBooth]=useState(false);
  const [vitalsOpen,setVitalsOpen]=useState(false);
  /* QUIET TIME.
     The calm practice is a real mechanic and the care copy tells the reader
     to offer quiet time — so the score that names it is the control. A leaf
     is quiet time, a timer and visible seconds are the observation, a
     biscuit is the reward; the count ticks while he is being watched, and
     only then, because the wait is the method. */
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{
    if(petState.calmSince===undefined)return;
    const id=window.setInterval(()=>setClock(Date.now()),1000);
    return ()=>window.clearInterval(id);
  },[petState.calmSince]);
  const calmWatching=petState.calmSince!==undefined&&!calmNeed(petState)&&petState.arousal<=55;
  const calmWait=calmWatching?Math.ceil(calmRewardWait(petState,clock)/1000):0;
  const calmLabel=calmWatching?(calmWait?`Watch calm · ${calmWait}s`:'Reward calm'):'Quiet time';
  const calmBlocked=calmNeed(petState);
  const isSick = petState.sick ?? false;
  const poops = (petState.poopCount ?? 0)+dailyLife(petState).peeCount;
  const disciplineVal = Math.round(petState.discipline ?? 60);

  const meters: Meter[] = [
    /* lowMeans words render inside the value slot of a 49px-wide meter cell,
       so they stay short: a long word would wrap and change the care
       console's height, reflowing the whole cockpit below it. */
    { key: 'fullness', label: 'Fullness', value: petState.needs.hunger, lowMeans: 'empty' },
    { key: 'energy', label: 'Energy', value: petState.needs.energy, lowMeans: 'tired' },
    { key: 'hygiene', label: 'Hygiene', value: petState.needs.hygiene, lowMeans: 'dirty' },
    { key: 'happiness', label: 'Happiness', value: happiness(petState), lowMeans: isSick ? 'sick' : 'low' },
    { key: 'trust', label: 'Trust', value: petState.trust, lowMeans: 'wary' },
    { key: 'arousal', label: 'Arousal', value: petState.arousal, lowMeans: 'flat', inverted: true },
  ];

  const ready = readiness(petState);
  const asleep = petState.sleep?.asleep ?? false;

  const CARE_LOG = [
    { key: 'fed', label: 'Fed', at: dog.tamagotchi?.lastFed },
    { key: 'played', label: 'Played', at: dog.tamagotchi?.lastPlayed },
    { key: 'walked', label: 'Walked', at: dog.tamagotchi?.lastWalked },
    { key: 'groomed', label: 'Groomed', at: dog.tamagotchi?.lastGroomed },
  ];

  /**
   * THE ONE THING TO DO NEXT.
   *
   * Six numbers are data. A sentence is advice. The app owes the reader the
   * sentence — otherwise the panel is a dashboard nobody can act on.
   */
  const nextAction = (): string => {
    const mood=dailyMood(petState);
    if(mood==='sick')return sickCause(petState)==='mess'?`${dog.name} is ill from lying in mess. Clean up (broom), then give medicine.`:sickCause(petState)==='hunger'?`${dog.name} is ill from going hungry. Give medicine, then a meal.`:`${dog.name} is still unwell. Give medicine.`;
    if(mood==='sleeping')return `${dog.name} is sleeping. Quiet time while energy returns.`;
    if(mood==='toilet')return `${dog.name} needs a toilet break. Take a walk before an accident.`;
    if(mood==='hungry')return `${dog.name} is hungry. Food first.`;
    if(mood==='tired')return `${dog.name} is tired. Tuck ${dog.sex==='female'?'her':'him'} in.`;
    if(mood==='dirty')return poops?`${dog.name}'s stage has ${poops} mess. Scoop and clean to protect health.`:`${dog.name} needs a groom.`;
    if(mood==='bored')return `${dog.name} is bored. Play, a sniff walk or a little company helps.`;
    if (petState.calmSince!==undefined) return `${dog.name} is resting quietly. Watch the relaxed posture, then reward calm.`;
    if (petState.trust < 35) return `${dog.name} needs gentle company. Care and patient practice build trust.`;
    if (disciplineVal < 40) return `${dog.name} can practise calm. Offer quiet time, then reward relaxed posture.`;
    if (petState.arousal > 80) return `${dog.name} is wound up. A walk brings the arousal down.`;
    if (petState.arousal < 20) return `${dog.name} is flat. Play wakes him up.`;
    if (ready > 0.7) return `${dog.name} is ready to work. The coach will tell you what to mark.`;
    return `${dog.name} is comfortable. Nothing is urgent.`;
  };

  return (
    <section className={`panel region-care care-console h-full ${detailView?'care-detail-view':''} ${extras?'care-console--extras':''}`} aria-label="Care">
      <header className="panel-head">
        <h2 className="label text-zinc-300">Care</h2>{!detailView&&playMode()==='own'&&<CloudSaveStatus/>}
        <Help label="How care works" text="Six bars: food, energy, clean, happiness, trust, excitement. A red bar needs you. The line under Now says the one thing to do next."/>
        <span className="care-identity truncate text-[11px] text-zinc-500">
          {dog.name} / {dog.breed}
        </span>
        {!detailView&&onPantry&&<button type="button" className="btn-quiet care-pantry-toggle" aria-label="Open food pantry" title="Pantry" onClick={onPantry}><ShoppingBag size={16} aria-hidden="true"/></button>}
        {detailView&&<button type="button" className="care-vitals-toggle btn-quiet text-[11px] px-1.5" aria-label={`Inspect ${dog.name} game vitals`} title="Game vitals" onClick={()=>setVitalsOpen(true)}><Stethoscope size={14} className="text-accent inline mr-1" aria-hidden="true"/>Vitals</button>}
        {!detailView&&<button type="button" className="care-details-toggle btn-quiet" aria-label="History and care details" onClick={()=>details.current?.showModal()}>History & details ↗</button>}
        {!detailView&&<button type="button" className="btn-quiet care-photo-toggle" aria-label={`Take a photo with ${dog.name}`} title={`Photo with ${dog.name}`} onClick={()=>setBooth(true)}><Camera size={16} aria-hidden="true"/></button>}
      </header>

      <div className="panel-body care-body @container">
        {/* The meters follow the width the panel was given */}
        <div className="care-meter-grid">
          {meters.map((m) => {
            const isLow = m.inverted
              ? m.value > 75 || m.value < 20
              : m.value < LOW_THRESHOLD;
            const value = Math.round(m.value);
            const warningLabel=m.inverted&&m.value>75?'Wired':m.lowMeans;
            return (
              <div key={m.key} className="care-meter care-meter-reading min-w-0">
                <div className="care-meter-symbols">
                  <span className="meter-symbol" title={m.label}>{React.createElement(({fullness:Utensils,energy:Battery,hygiene:Sparkles,happiness:Smile,trust:Heart,arousal:Activity})[m.key],{size:18,'aria-hidden':true})}<span className="sr-only">{m.label}</span></span>
                </div>
                {/* A low meter reads as its word, in the value's own slot. The
                    word never takes a second row: a taller meter would change
                    the care console's height and reflow the record below. The
                    exact number stays on the bar and in the meter's aria-label. */}
                <div className="care-meter-value flex items-baseline gap-1">
                  {isLow ? (
                    <span className="label text-rose-400 truncate" title={warningLabel}>{warningLabel}</span>
                  ) : (
                    <>
                      <span className="data text-[17px] leading-none text-zinc-100">{value}</span>
                      <span className="data text-[10px] leading-none text-faint">%</span>
                    </>
                  )}
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${m.label}, ${value} percent${isLow ? `, ${warningLabel}` : ''}`}
                  className="h-1 w-full overflow-hidden bg-zinc-900"
                >
                  <div
                    className={`h-full ${isLow ? 'bg-rose-500' : 'bg-accent'}`}
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {!detailView&&<MeterDeltas petState={petState} dogId={dog.id}/>}
        {extras}

        {/* The sentence: advice, health, discipline and time together */}
        <div className="care-now border-hairline-t">
          <p className="label">Now</p>
          {petState.call&&!isSick&&!asleep&&(dailyMood(petState)!=='tired'||!['bored','lonely','tantrum'].includes(petState.call.reason)) ? (
            <p className="text-[12px] leading-snug text-accent mt-0.5" role="status">
              {dog.name} {CALL_TEXT[petState.call.reason]}. Answer with {ANSWERS[petState.call.reason].join(' or ')}.
            </p>
          ) : (
            <p className={`text-[12px] leading-snug mt-0.5 ${isSick?'text-accent':'text-zinc-200'}`} role={isSick?'status':undefined}>{nextAction()}</p>
          )}
          <p className="care-summary text-[11px] text-faint mt-1">
            <span className="data">Ready {Math.round(ready * 100)}%</span>
            <span className="data" title="Virtual calm-practice score; not a real-dog assessment">Calm {disciplineVal}%</span>
            {/* The calm score is the control. It sits where the reader is
                already looking, it costs no row, and its name says what it
                does. */}
            {onCalm&&<button
              type="button"
              onClick={()=>onCalm(calmWatching?'rewardCalm':'settle')}
              disabled={!!calmBlocked||calmWait>0}
              aria-label={`${calmLabel}. ${dog.name}`}
              title={calmBlocked||`${calmLabel}: watch relaxed body language, then give a small reward`}
              className="care-calm-btn btn-quiet shrink-0 px-1 text-[11px] whitespace-nowrap"
            >
              {calmWait>0
                ? <span className="inline-flex items-center gap-1"><Timer size={13} aria-hidden="true"/><span className="data">{calmWait}s</span></span>
                : <span className="inline-flex items-center gap-1">{calmWatching?<Cookie size={13} aria-hidden="true"/>:<Leaf size={13} aria-hidden="true"/>}<span className="sr-only">{calmLabel}</span></span>}
            </button>}
            <span>{temperament(petState)}</span>
            {isSick ? <span>Sick</span> : poops > 0 ? <span>{poops} mess</span> : null}
          </p>
          <p className="care-together data text-[10px] text-zinc-300 mt-1" title="Counted only while this page is in front of you and you are using it">
            Today {minutes(petState.together?.todaySec ?? 0)} · {petState.together?.streak ?? 0}-day streak ·{' '}
            Total {minutes(petState.together?.totalSec ?? 0)}
            {(()=>{const w=wishFor(petState,Date.now());return <> · Wish: {WISH_SHORT[w.kind]}{w.done?' ✓':''}</>;})()}
          </p>
          <PushOffer name={dog.name} answered={petState.careLog?.answered??0} detail={!!detailView}/>
        </div>

        {detailView&&playMode()==='own'&&<div className="owned-diary"><p>{growthLabel(petState)} · your {dog.name}</p><p>{petState.character?`${dog.name} grew up ${CHARACTER_TEXT[petState.character.name]}`:'One minute of active attention on a new day helps your puppy grow. How you raise him decides who he becomes.'}</p><button type="button" className="btn-quiet" onClick={()=>{try{downloadOwnedBackup(dog.name);setBackupNote('Backup downloaded. Restore it from the mode screen.');}catch{setBackupNote('Could not create a complete backup yet. Please try again.');}}}>Export your dog ↗</button>{backupNote&&<p role="status">{backupNote}</p>}</div>}
        {detailView&&onHome&&<label className="home-pick">Home <select value={isHome(petState.home)?petState.home:'house'} onChange={e=>onHome(e.target.value as HomeId)}>{HOMES.map(h=><option key={h.id} value={h.id}>{h.label}</option>)}</select></label>}
        {detailView&&onPalette&&<label className="home-pick">Palette <select value={dog.avatarConfig.palette||dog.id} onChange={e=>onPalette(e.target.value)}>{THEME_CHOICES.map(t=><option key={t.id} value={t.id}>{t.name} · {t.plate}</option>)}</select></label>}
        {/* THE CARE LOG */}
        <div className="care-history border-hairline-t">
          <p className="label">Last</p>
          <dl className="care-history-times mt-1">
            {CARE_LOG.map((row) => (
              <div key={row.key} className="flex items-baseline justify-between gap-1 min-w-0">
                <dt className="label truncate" title={row.label}>{React.createElement(({fed:Utensils,played:Smile,walked:Activity,groomed:Sparkles})[row.key]||Clock,{size:14,'aria-hidden':true})}<span className="sr-only">{row.label}</span></dt>
                <dd className="data text-[10px] text-zinc-300 shrink-0">{since(row.at)}</dd>
              </div>
            ))}
          </dl>
          <p className="care-health data text-[10px] text-faint mt-1 flex flex-wrap items-center justify-between gap-x-2">
            <span className="truncate">
              {asleep
                ? `Asleep since ${clockTime(petState.sleep?.fellAsleepAt)}`
                : petState.sleep?.wakeCount
                  ? `Awake · woken ${petState.sleep.wakeCount}× tonight`
                  : 'Awake'}
            </span>
            <span className="text-zinc-400 shrink-0 ml-2">
              {dog.weightKg > 0 ? recordSources(dog).fields.includes('weightKg')?'Weight example':`${dog.weightKg} kg owner/imported` : 'Virtual companion'}
              {isSick ? ' · Game: sick' : poops > 0 ? ` · Game: ${poops} mess` : ' · Game: well'}
            </span>
          </p>
        </div>
      </div>
      {!detailView&&<dialog ref={details} className="care-details-dialog" aria-label={`${dog.name} care details`} onClick={e=>{if(e.target===e.currentTarget)details.current?.close();}}>
        <button type="button" className="btn-quiet care-details-close" onClick={()=>details.current?.close()}>Close ×</button>
        <CarePanel dog={dog} petState={petState} detailView onHome={onHome} onPalette={onPalette}/>
      </dialog>}
      {booth&&<PhotoBooth dog={dog} artUrl={ILLUSTRATIONS[dog.id]??''} onClose={()=>setBooth(false)}/>}
      {vitalsOpen&&<VitalsModal dog={dog} petState={petState} onClose={()=>setVitalsOpen(false)}/>}
    </section>
  );
};
