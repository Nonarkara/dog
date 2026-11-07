/**
 * THE GAIT.
 *
 * A dog that walks has to cover ground, step at a believable cadence, and
 * turn without the sprite snapping from one side to the other. None of that
 * was measured before: the dog used to shuffle inside a 0.18-unit band, take
 * roughly five seconds per stride, and mirror himself the instant he
 * reversed. Those are the three failures this script refuses.
 *
 * What it reads, from the stage's own instruments:
 *   data-travel-x where he is on the floor
 *   data-phase     the gait phase — one unit is one whole stride
 *   data-stride    the world distance one stride covers
 *   data-motion-frame which authored stride frame is showing
 *   data-facing    his smoothed facing (-1 left, +1 right)
 *   data-turning   he is playing the authored turn
 *   data-fps       the rate he is actually being drawn at
 *
 * Rules:
 *   1. He travels. A walk that stays inside a hand's width is a treadmill.
 *   2. The ground he covers and the stride he draws agree. The phase is
 *      advanced by distance, never by a clock, so a mismatch here is a foot
 *      sliding — the one thing that makes a drawn dog look like a puppet.
 *   3. A stride takes between 0.45 s and 1.7 s: a dog, not a slow pan.
 *   4. He never changes side except while the authored turn is playing.
 *      A mirror flip at any other moment is a pop.
 *   5. Awake and moving, he is drawn at sixty frames a second.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.DOG_URL || 'http://127.0.0.1:4198';

const WALK = [32, 48];
const RUN = [0, 32];

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    // Read real draw matrices: telemetry must describe the dog that was drawn.
    const installRigProbe=() => {
      Math.random=()=>.22;
      const locations=new WeakMap(),rig=new WeakSet(),proto=WebGL2RenderingContext.prototype;
      const get=proto.getUniformLocation,put=proto.uniformMatrix4fv;
      proto.getUniformLocation=function(program,name){
        if(name==='headPivot')rig.add(program);
        const loc=get.call(this,program,name);
        if(loc)locations.set(loc,{program,name});
        return loc;
      };
      proto.uniformMatrix4fv=function(loc,transpose,value,...args){
        const m=locations.get(loc);
        if(m?.name==='modelViewMatrix'&&rig.has(m.program))window.gaitMatrix={x:value[12],sx:value[0],sy:value[5]};
        return put.call(this,loc,transpose,value,...args);
      };
    };
    await p.addInitScript(installRigProbe);
    // Midday: a dog is awake, and awake is when the gait is judged.
    await p.clock.setFixedTime(new Date(2026, 10, 4, 12));
    await p.goto(base + '/?mode=play');
    await p.waitForFunction(() => +document.querySelector('canvas')?.dataset.frames > 5);
    await p.waitForFunction(() => document.querySelector('canvas')?.dataset.motionReady === 'true');

    await p.evaluate(() => {
      window.gait = [];
      const c = document.querySelector('canvas');
      const tick = () => {
        const d = c.dataset;
        window.gait.push({
          t: performance.now(),
          behaviour: d.behaviour,
          frame: +d.motionFrame,
          travel: +d.travelX,
          x: +d.x,
          facing: +d.facing,
          turning: d.turning === 'true',
          fps: +d.fps,
          target: +d.targetFps,
          phase: +d.phase,
          stride: +d.stride,
          matrix: window.gaitMatrix,
        });
        requestAnimationFrame(tick);
      };
      tick();
    });

    // Wait for the dog to actually get up and walk. He chooses his own day.
    await p.waitForFunction(
      () => window.gait.some((s) => s.behaviour === 'wandering' || s.behaviour === 'trotting'),
      null,
      { timeout: 90000 }
    );
    await p.waitForTimeout(16000);

    await p.waitForFunction(()=>{
      const d=document.querySelector('canvas').dataset;
      return (+d.motionFrame>=32&&+d.motionFrame<48||+d.motionFrame>=112)&&d.turning==='false';
    },null,{timeout:30000});
    await p.evaluate(()=>document.addEventListener('click',()=>{window.petX=window.gaitMatrix.x},{once:true,capture:true}));
    await p.getByRole('button',{name:'Pet Expo',exact:true}).click();
    await p.waitForTimeout(400);
    const afterPet=await p.evaluate(()=>window.gaitMatrix.x);
    const beforePet=await p.evaluate(()=>window.petX);
    assert(Math.abs(afterPet-beforePet)<.055,`Petting stops at the hand: ${beforePet}→${afterPet}`);
    const samples = await p.evaluate(() => window.gait);
    assert(samples.length > 300, `The stage must be sampled over many frames, got ${samples.length}`);

    const steps=samples.slice(1).map((s,i)=>({s,a:samples[i]})).filter(({s,a})=>s.matrix&&a.matrix&&s.t-a.t<80).map(({s,a})=>Math.abs(s.matrix.x-a.matrix.x));
    assert(Math.max(...steps)<.055,`No stop/interrupt root teleport; largest step was ${Math.max(...steps)}`);

    // ---- 1. he travels ---------------------------------------------------
    const walking = samples.filter((s) => s.behaviour === 'wandering' || s.behaviour === 'trotting');
    assert(walking.length > 60, `He must spend real time walking, got ${walking.length} frames`);
    const xs = walking.map((s) => s.travel);
    const span = Math.max(...xs) - Math.min(...xs);
    assert(span > 0.3, `A walk must cover ground, he moved ${span.toFixed(3)} units`);

    // ---- 2. the ground and the drawing agree ----------------------------
    // Over any window of frames, the distance he covered must equal the
    // phase he advanced multiplied by the stride he is drawing. If they
    // disagree, his feet are sliding against the floor.
    let checked = 0;
    for (let i = 1; i < walking.length; i++) {
      const a = walking[i - 1];
      const s = walking[i];
      if (a.behaviour !== s.behaviour || a.turning || s.turning) continue;
      if (!(s.stride > 0)) continue;
      const phaseStep = s.phase - a.phase;
      const groundStep = Math.abs(s.x - a.x);
      if (phaseStep <= 0) continue;
      const expected = phaseStep * s.stride;
      // The clamp at the edge of the floor can hold him still; that is a
      // wall, not a slide. Only a real mismatch counts.
      if (expected < 0.004) continue;
      const error = Math.abs(groundStep - expected) / expected;
      assert(
        error < 0.34,
        `His feet must not slide: he covered ${groundStep.toFixed(4)} but the stride says ${expected.toFixed(4)} ` +
          `(behaviour ${s.behaviour}, frame ${s.frame}, phase ${a.phase}→${s.phase}, stride ${s.stride}, x ${a.x}→${s.x})`
      );
      checked++;
    }
    assert(checked > 40, `The stride must be checked over many frames, got ${checked}`);

    // ---- 3. the cadence -------------------------------------------------
    const strides = [];
    for (let i = 1; i < walking.length; i++) {
      const a = walking[i - 1];
      const s = walking[i];
      if (a.behaviour !== s.behaviour || a.turning || s.turning) continue;
      const phaseStep = s.phase - a.phase;
      if (phaseStep <= 0) continue;
      const dt = (s.t - a.t) / 1000;
      if (dt <= 0) continue;
      // One unit of phase is one whole stride, so the stride takes
      // dt/phaseStep seconds.
      strides.push({ seconds: dt / phaseStep, run: s.frame < 32 });
    }
    assert(strides.length > 20, `The cadence must be sampled over many frames, got ${strides.length}`);
    const durations = strides.map((s) => s.seconds).filter((v) => v > 0.2 && v < 5).sort((a, b) => a - b);
    assert(durations.length > 10, `The cadence must be measurable, got ${durations.length} usable samples`);
    // A dog slowing to a stop takes longer than a dog at full pace, and the
    // frame where he changes gait carries one frame of the old speed. The
    // median is the honest measure; the tails are only bounds.
    const median = durations[Math.floor(durations.length / 2)];
    const tenth = durations[Math.floor(durations.length * 0.1)];
    const ninetieth = durations[Math.floor(durations.length * 0.9)];
    assert(median < 1.7, `A stride must take a believable time, the usual one was ${median.toFixed(3)} s`);
    assert(median > 0.45, `A stride must take a believable time, the usual one was ${median.toFixed(3)} s`);
    assert(tenth > 0.35, `A stride must never be a blur, a tenth of them were under ${tenth.toFixed(3)} s`);
    assert(ninetieth < 2.2, `A stride must not crawl, a tenth of them were over ${ninetieth.toFixed(3)} s`);

    // ---- 4. he never changes side outside the authored turn --------------
    const flips = [];
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const s = samples[i];
      if (Math.sign(a.facing) !== Math.sign(s.facing) && a.facing !== 0 && s.facing !== 0) flips.push(s);
    }
    assert(flips.length > 0, 'He must turn during a walk, or the test proved nothing');
    for (const f of flips) {
      assert(
        f.turning,
        `He changed side without the authored turn playing (frame ${f.frame}, behaviour ${f.behaviour})`
      );
    }

    // Interrupting/end of a stroll keeps the same dog on the same floor.
    // The old decay multiplier discarded 90% of the position in one frame.
    for(let i=1;i<samples.length;i++){
      const a=samples[i-1],s=samples[i];
      if(!a.matrix||!s.matrix||s.t-a.t>80)continue;
      assert(Math.abs(s.matrix.x-a.matrix.x)<.055,`No root teleport: ${a.behaviour}→${s.behaviour}, ${a.matrix.x}→${s.matrix.x}`);
      assert(Math.abs(Math.abs(s.matrix.sx/s.matrix.sy)-1)<.0001,'Every real draw preserves facial aspect ratio');
      if(s.frame>=48&&s.frame<80)assert(s.matrix.sx>0,'Authored turn views already contain both sides; mirroring them reverses the turn');
    }

    // ---- 5. he is drawn at sixty while awake and moving ------------------
    // The measured rate is a rolling three-second average, so the frame that
    // starts a walk still carries the idle it came from. The rate he is
    // being asked for, and the rate he reaches, are both checked.
    const asked = walking.map((s) => s.target).sort((a, b) => a - b);
    const askedMedian = asked[Math.floor(asked.length / 2)];
    assert(askedMedian === 60, `He must be asked for sixty frames a second while walking, the usual ask was ${askedMedian}`);
    const drawn = walking.map((s) => s.fps).filter((v) => v > 0).sort((a, b) => a - b);
    const drawnMedian = drawn[Math.floor(drawn.length / 2)];
    assert(drawnMedian >= 55, `He must be drawn at sixty frames a second while walking, the usual rate was ${drawnMedian}`);

    console.log('PASS the gait covers ground, keeps its stride honest, turns without a pop, and runs at sixty', {
      frames: samples.length,
      travelSpan: +span.toFixed(3),
      strideChecks: checked,
      strideSeconds: { tenth: +tenth.toFixed(3), usual: +median.toFixed(3), ninetieth: +ninetieth.toFixed(3) },
      sideChanges: flips.length,
      fps: +drawnMedian.toFixed(1),
      targetFps: askedMedian,
    });
    await p.close();
    // The original desktop-only test went green while phones showed a frozen
    // walking drawing. Exercise the actual narrow scene and save real pixels.
    for(const [width,height] of [[320,667],[390,844],[1024,768],[1440,900]]){
      const phone=await b.newPage({viewport:{width,height}});
      await phone.clock.setFixedTime(new Date(2026,10,4,12));
      await phone.addInitScript(installRigProbe);
      await phone.goto(base+'/?mode=play');
      await phone.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);
      const initial=await phone.locator('.region-stage canvas').evaluate(c=>({x:+c.dataset.x,frames:+c.dataset.frames}));
      await phone.waitForFunction(()=>document.querySelector('canvas')?.dataset.motionReady==='true');
      const loaded=await phone.locator('.region-stage canvas').evaluate(c=>({x:+c.dataset.x,frames:+c.dataset.frames}));
      assert(Math.abs(initial.x-loaded.x)<.02,'Loading optional motion cannot move a still dog');
      await phone.waitForTimeout(9000);
      const seen=await phone.evaluate(async()=>{
        const samples=[];
        for(let i=0;i<100;i++){
          await new Promise(r=>requestAnimationFrame(r));
          const d=document.querySelector('canvas').dataset;
          samples.push({behaviour:d.behaviour,frame:+d.motionFrame,x:+d.x});
        }
        return samples;
      });
      if(width<400){
        assert(seen.every(s=>s.behaviour!=='wandering'&&s.behaviour!=='trotting'),'A room too narrow for a stride offers sniffing, not treadmill walking');
        assert(seen.every(s=>s.frame<0),'No frozen gait artwork in a room with no walking space');
      }
      const stage=await phone.locator('.region-stage').boundingBox();
      assert(stage.height>=height*.5,'The dog keeps at least half of the phone screen');
      assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
      await phone.screenshot({path:`/tmp/dog-nov5-gait-${width}.png`});
      if(width<400){
        await phone.getByRole('button',{name:'Tricks and toys',exact:true}).click();
        await phone.getByRole('button',{name:'Zoomies',exact:true}).click();
        const zoom=await phone.evaluate(async()=>{
          const samples=[],start=performance.now();
          while(performance.now()-start<3400){
            await new Promise(r=>requestAnimationFrame(r));
            samples.push({x:window.gaitMatrix.x,frame:+document.querySelector('canvas').dataset.motionFrame});
          }
          return samples;
        });
        const travel=Math.max(...zoom.map(s=>s.x))-Math.min(...zoom.map(s=>s.x));
        const gaitFrames=new Set(zoom.filter(s=>s.frame>=0&&s.frame<32).map(s=>s.frame));
        assert(travel>.06,`Explicit phone Zoomies must cover floor, got ${travel}`);
        assert(gaitFrames.size>=4,`Explicit phone Zoomies must articulate legs, got ${gaitFrames.size} drawings`);
      }
      console.log('PASS actual scene',width,height,{stageHeight:stage.height,behaviours:[...new Set(seen.map(s=>s.behaviour))]});
      await phone.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
