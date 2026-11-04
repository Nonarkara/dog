import assert from 'node:assert/strict';
import {createPetState} from '../src/domain/pet';
import {dailyLife} from '../src/domain/dailyLife';
import {gameState} from '../src/domain/companionGame';
import {finishParkOuting} from '../src/domain/parkOuting';

const now=new Date(2026,10,4,12).getTime(),fresh=createPetState(now);
const ready={...fresh,trust:40,lastCareAt:now-50*60000,wish:{day:'2026-11-04',kind:'walk' as const,done:false},life:{...dailyLife(fresh),bladder:90,boredom:70},call:{reason:'toilet' as const,since:now-1000}};
const trip=finishParkOuting(ready,now,12,180);
assert(trip.credited&&trip.wished);assert.equal(trip.state.careLog?.walk,1);assert.equal(trip.state.careLog?.answered,1);assert.equal(trip.state.call,undefined);assert.equal(trip.state.lastCareAt,now);assert.equal(trip.coinsAwarded,8);assert.equal(gameState(trip.state).coins,gameState(ready).coins+8);assert.equal(trip.trustAwarded,9);
const repeated=finishParkOuting(trip.state,now+1000,12,180);assert.equal(repeated.state,trip.state);assert(!repeated.credited&&!repeated.wished);assert.equal(repeated.coinsAwarded,0);assert.equal(repeated.note,null);
for(const evidence of [[0,0],[12,0],[0,180],[NaN,180],[12,Infinity]]){const nope=finishParkOuting(ready,now,...evidence as [number,number]);assert.equal(nope.state,ready);assert(!nope.credited);}
const fullCoins={...ready,trust:100,game:{...gameState(ready),coins:200}};const capped=finishParkOuting(fullCoins,now,12,180);assert(capped.credited&&capped.wished);assert.equal(capped.coinsAwarded,0);assert.equal(capped.trustAwarded,0);assert(!capped.note?.includes('paw coins'));
const stillBored={...ready,call:{reason:'bored' as const,since:now-1000},needs:{...ready.needs,hunger:20},life:{...dailyLife(ready),boredom:100}};const incomplete=finishParkOuting(stillBored,now,12,180);assert.equal(incomplete.state.call?.reason,'bored');assert.equal(incomplete.state.careLog?.answered,undefined);
const lonely={...ready,call:{reason:'lonely' as const,since:now-1000},life:{...dailyLife(ready),bladder:0,boredom:0}};const together=finishParkOuting(lonely,now,12,180);assert.equal(together.state.call,undefined);assert.equal(together.state.careLog?.answered,1);
console.log('PASS real outings log care, fulfill daily wish and relieved calls; rejected/capped/repeated outings never invent rewards');
