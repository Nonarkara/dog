// Neighbours walk up to an idle, well-fed own dog, bow and sniff; the own dog is never dragged off.
const{chromium}=require('playwright'),assert=require('node:assert/strict');
const url=process.env.DOG_URL||'http://127.0.0.1:4178/?mode=play';
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true}),errors=[];try{
 const p=await b.newPage({viewport:{width:1024,height:768}});p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
 await p.clock.setFixedTime(new Date(2026,9,30,12));await p.goto(url);await p.waitForFunction(()=>+document.querySelector('canvas')?.dataset.frames>4);
 await p.getByRole('button',{name:'Open Commons park'}).dispatchEvent('click');
 await p.waitForFunction(()=>document.querySelector('canvas')?.dataset.renderer==='illustrated-park'&&+document.querySelector('canvas').dataset.visibleDogs>=4);
 const pos=()=>p.locator('.park-world canvas').evaluate(c=>[+c.dataset.dogWorldX,+c.dataset.dogWorldY]);
 const start=await pos();
 try{await p.waitForFunction(()=>document.querySelector('.park-world canvas')?.dataset.greetedOwn==='true',null,{timeout:150000});}catch(e){console.error('diag',JSON.stringify(await p.locator('.park-world canvas').evaluate(c=>({...c.dataset}))));throw e;}
 const end=await pos(),moved=Math.hypot(end[0]-start[0],end[1]-start[1]);
 assert(moved<80,`own dog must not be dragged away by a greeting (moved ${moved.toFixed(0)})`);
 assert(+(await p.locator('.park-world canvas').evaluate(c=>c.dataset.greetings))>=1);
 await p.close();assert.deepEqual(errors,[]);console.log('PASS a neighbour greeted the idle own dog; own dog moved',moved.toFixed(0));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
