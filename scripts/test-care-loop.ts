import assert from 'node:assert/strict';
import {createPetState, interact} from '../src/domain/pet';
import {dailyLife, advanceDailyLife, dailyMood} from '../src/domain/dailyLife';
import {whyCalling, tickCall, answerCareCall, addTogether, CALL_FADES_MS} from '../src/domain/attention';
import {computeCanineVitals} from '../src/domain/canineVitals';
import {DEFAULT_DOGS} from '../src/data/defaultDogs';
import {grantWish, wishFor, WISH_COINS} from '../src/domain/life';
import {gameState} from '../src/domain/companionGame';

const now=new Date(2026,10,4,12).getTime();
const fresh=createPetState(now);
const cases:[string,()=>void][]=[
 ['The care call agrees with the visible hunger need even when cleanup is also due',()=>{
  const hungry={...fresh,needs:{...fresh.needs,hunger:20},poopCount:1};
  assert.equal(dailyMood(hungry),'hungry');assert.equal(whyCalling(hungry,now),'hungry');
  const called={...hungry,call:tickCall(hungry,now).call};
  const fed=interact(called,'feed',now+1000).state;
  assert(fed.needs.hunger>hungry.needs.hunger);
  assert(answerCareCall(called,fed,'feed',now+1000).answered);
  assert(!answerCareCall(called,called,'feed',now+1000).answered,'An unserved meal cannot answer a call');
  assert(!answerCareCall(called,fed,'feed',now+CALL_FADES_MS+1).answered,'An expired call cannot pay a bonus');
 }],
 ['Care streaks follow consecutive local dates through daylight saving time',()=>{
  const tz=process.env.TZ;
  try{
   process.env.TZ='America/New_York';
   const first=addTogether(undefined,60,new Date(2026,2,8,12).getTime());
   const second=addTogether(first,60,new Date(2026,2,9,0,30).getTime());
   assert.equal(second.streak,2);
  }finally{
   if(tz===undefined)delete process.env.TZ;
   else process.env.TZ=tz;
  }
 }],
 ['Game vitals preserve unknown profile weight',()=>{
  assert.equal(computeCanineVitals({...DEFAULT_DOGS[0],weightKg:0},fresh).physique.weightKg,null);
  assert.equal(computeCanineVitals({...DEFAULT_DOGS[0],weightKg:12},fresh).physique.weightKg,12);
 }],
 ['Fatigue does not call for play or company',()=>{
  const tired={...fresh,needs:{...fresh.needs,energy:10},life:{...dailyLife(fresh),boredom:90}};
  assert.equal(dailyMood(tired),'tired');
  assert.equal(whyCalling(tired,now),null);
  assert.equal(whyCalling({...tired,needs:{...tired.needs,hunger:20}},now),'hungry');
 }],
 ['A newly initialized dog receives the promised daily-wish coins',()=>{
  const accrued={...fresh,together:{day:'2026-11-04',todaySec:120,totalSec:120,streak:1}};
  const before=gameState(accrued).coins,wish=wishFor(accrued,now);
  const granted=grantWish(accrued,wish.kind,now);
  assert(granted.granted);assert.equal(gameState(granted.state).coins,before+WISH_COINS);
  assert.equal(gameState(grantWish(granted.state,wish.kind,now+1000).state).coins,before+WISH_COINS);
  assert.equal(accrued.game,undefined,'granting a wish must not mutate the original state');
 }],
 ['Time away adds at most two new puddles and piles',()=>{
  const advanced=advanceDailyLife(fresh,8*60,now+8*3600000);
  assert.equal(advanced.life.peeCount,2);assert.equal(advanced.poopCount,2);
  const after=advanceDailyLife({...fresh,...advanced},8*60,now+16*3600000);
  assert.equal(after.life.peeCount,2);assert.equal(after.poopCount,2);
 }],
 ['The new mess cap does not erase legacy mess before the owner cleans it',()=>{
  const legacy={...fresh,poopCount:3,life:{...dailyLife(fresh),peeCount:3}};
  const advanced=advanceDailyLife(legacy,60,now+3600000);
  assert.equal(advanced.life.peeCount,3);assert.equal(advanced.poopCount,3);
  const clean=interact({...legacy,...advanced},'clean',now+3600000).state;
  assert.equal(dailyLife(clean).peeCount,0);assert.equal(clean.poopCount,0);
 }],
];
let failures=0;
for(const [name,check] of cases){try{check();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e instanceof Error?e.message:e);}}
if(failures)process.exitCode=1;
