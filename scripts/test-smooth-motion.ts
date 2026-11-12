import assert from 'node:assert/strict';
import {poseSpring,poseSettling,smooth01} from '../src/components/parkMotion';
// Exact endpoints: no pop at the start or the end of a pose change.
for(const z of [1,.62]){assert.equal(poseSpring(0,z),0);assert.ok(Math.abs(poseSpring(1,z)-1)<1e-12);}
// Critically damped: monotone (never backs up), starts with ~zero speed, no overshoot.
let prev=0;for(let i=1;i<=200;i++){const v=poseSpring(i/200,1);assert.ok(v>=prev-1e-12,'monotone');assert.ok(v<=1+1e-12,'no overshoot');prev=v;}
assert.ok(poseSpring(.01,1)<.02,'gentle departure');
// Soft landing overshoots a little, and only a little.
let peak=0;for(let i=0;i<=200;i++)peak=Math.max(peak,poseSpring(i/200,.62));
assert.ok(poseSpring(.2,.62)>.76&&poseSpring(.2,.62)<.78,'spring shape '+poseSpring(.2,.62));assert.ok(peak>1.06&&peak<1.10,'landing overshoot '+peak);
// Settling vanishes at both ends; lowering rises first (anticipation), then sinks.
for(const l of [true,false]){assert.equal(poseSettling(0,l),0);assert.ok(Math.abs(poseSettling(1,l))<1e-12);}
assert.ok(poseSettling(.125,true)<-.25&&poseSettling(.125,true)>-.37,'anticipation rises first, by a hair');assert.ok(poseSettling(.5,true)>0,'then sinks');
assert.ok(poseSettling(.125,false)>=0,'only lowering anticipates');
// Dissolve ramp is 0 before its window and 1 after.
assert.equal(smooth01(.36,.64,.2),0);assert.equal(smooth01(.36,.64,.9),1);assert.ok(smooth01(.36,.64,.43)<.2,'eased, not linear');assert.ok(smooth01(.36,.64,.5)>.4&&smooth01(.36,.64,.5)<.6);
console.log('smooth-motion: ok');
