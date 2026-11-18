const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
/* THE PARK HAS DEPTH, AND A FINGER CAN STILL REACH EVERY DOG.
 *
 * Dogs and props are sized by where their feet stand (src/domain/parkDepth.ts):
 * a dog at the back draws smaller than one in front. A far dog may draw smaller
 * than a finger, so it gets a 120 px touch box; a full-size dog does not, so a
 * tap just beside it still walks your dog there instead of petting it.
 * The canvas publishes each dog's on-screen box (data-dog-boxes, CSS px).
 */
const base=(process.env.DOG_URL||'http://127.0.0.1:4178').replace(/\/?\?.*$/,'').replace(/\/$/,'');
const out=process.env.DOG_EVIDENCE||'/tmp/dog-park-perspective';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true,args:process.env.DOG_NATIVE_GL?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1440,height:900}});p.setDefaultTimeout(60000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/?mode=play');
  await p.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);
  await p.getByRole('button',{name:'Open Commons park'}).click();
  const park=p.locator('.park-world canvas');
  const boxes=()=>park.evaluate(c=>JSON.parse(c.dataset.dogBoxes||'[]'));
  await p.waitForFunction(()=>JSON.parse(document.querySelector('.park-world canvas')?.dataset.dogBoxes||'[]').length>=4);
  await p.waitForTimeout(2500);
  let rect=await park.boundingBox();

  // 1. Depth: the dog furthest back draws smaller than the dog furthest forward.
  {const d=await boxes(),back=d.reduce((a,c)=>c.y<a.y?c:a),front=d.reduce((a,c)=>c.y>a.y?c:a);
   assert(back.w<front.w,`back dog ${back.id} (${back.w}px) must draw smaller than front dog ${front.id} (${front.w}px)`);}

  // 2. A full-size dog: a tap 24 px beside its drawn edge, clear of every other dog, does not pet it.
  {const d=await boxes(),free=(t,x,y)=>d.every(q=>q===t||Math.abs(x-q.x)>q.w/2+30||y>q.y+30||y<q.y-q.h-30);
   const big=d.filter(o=>o.w>=120).map(o=>({o,x:o.x+o.w/2+24,y:o.y-o.h/2})).find(t=>t.x<rect.width-20&&free(t.o,t.x,t.y));
   assert(big,'a full-size dog with open lawn beside it');
   await p.mouse.click(rect.x+big.x,rect.y+big.y);await p.waitForTimeout(150);
   assert(!(await boxes()).some(o=>o.pet),`a tap beside ${big.o.id} walks, it must not pet`);}

  // 3. Watch mode zooms out to fit the pack, so dogs draw under a finger's width there.
  //    A tap just outside such a dog's drawing, but inside 120 px of it, still pets it.
  await p.close();
  const q=await b.newPage({viewport:{width:390,height:844}});q.setDefaultTimeout(60000);q.on('pageerror',e=>errors.push(e.message));
  await q.goto(base+'/?mode=play');await q.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>5);
  await q.getByRole('button',{name:'Open Commons park'}).click();
  await q.waitForFunction(()=>JSON.parse(document.querySelector('.park-world canvas')?.dataset.dogBoxes||'[]').length>=4);
  await q.getByRole('button',{name:'Watch the park full screen'}).click();
  await q.waitForFunction(()=>JSON.parse(document.querySelector('.park-world canvas')?.dataset.dogBoxes||'[]').some(o=>o.w<100),null,{timeout:20000});
  await q.waitForTimeout(1500);
  rect=await q.locator('.park-world canvas').boundingBox();
  {const d=await q.locator('.park-world canvas').evaluate(c=>JSON.parse(c.dataset.dogBoxes||'[]')),spot=o=>{const x=o.x+o.w/2+Math.min(14,(120-o.w)/2-4),y=o.y-Math.max(8,o.h*.4);return {o,x,y};};
   // the tap lands outside this dog's drawing and clear of every other dog's drawing
   const t=d.filter(o=>o.w<100&&o.w>=24).map(spot).find(t=>d.every(q=>q===t.o||Math.abs(t.x-q.x)>q.w/2+12||t.y>q.y+12||t.y<q.y-q.h-12));
   assert(t,'watch mode leaves a dog drawn under 100 px with open lawn beside it');
   const small=t.o,x=t.x,y=t.y;
   assert(Math.abs(x-small.x)>small.w/2&&Math.abs(x-small.x)<60,'the tap is outside the drawing, inside the 120 px box');
   await q.mouse.click(rect.x+x,rect.y+y);
   await q.waitForFunction(id=>JSON.parse(document.querySelector('.park-world canvas').dataset.dogBoxes||'[]').some(o=>o.id===id&&o.pet),small.id,{timeout:3000});
   await q.screenshot({path:out+'/small-dog-pet.png'});}
  assert.deepEqual(errors,[]);
  console.log('PASS park depth: back dogs draw smaller; a tap beside a full-size dog walks; a tap within 120 px of a small far dog pets it.',out);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
