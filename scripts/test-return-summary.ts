import assert from 'node:assert/strict';
import {createPetState,decay} from '../src/domain/pet';
import {describeAbsence} from '../src/domain/absence';
const now=new Date(2026,10,4,12).getTime(),fresh=createPetState(now);
assert.equal(describeAbsence(fresh,decay(fresh,now+20*60000)),null);
const later=decay(fresh,now+8*3600000),summary=describeAbsence(fresh,later);
assert(summary?.startsWith('While you were away (8 h):'));assert(summary.includes('food −'));
// A dog left alone holds on (dailyLife.ALONE_PACE): no mess in a working day, some after a full one.
assert(!summary.includes('new mess'),'Eight hours alone makes no mess');
const dayAway=describeAbsence(fresh,decay(fresh,now+30*3600000));assert(dayAway?.includes('new mess'),'A day and more alone does');
const dirty={...fresh,needs:{...fresh.needs,hygiene:5}};assert(decay(dirty,now+60000).needs.hygiene<=5,'Decay never heals a dirty dog');
assert(decay(fresh,now+48*3600000).needs.hygiene>=12,'Time decay leaves a recoverable hygiene floor');
const copy=JSON.stringify(fresh);describeAbsence(fresh,later);assert.equal(JSON.stringify(fresh),copy);
assert.equal(describeAbsence(fresh,{...later,updatedAt:NaN}),null);
console.log('PASS meaningful absence recap, quiet short returns, immutable comparison and hygiene floor without free healing');
