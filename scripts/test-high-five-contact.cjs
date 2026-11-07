const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
const p=await b.newPage({viewport:{width:1280,height:720}});
await p.clock.setFixedTime(new Date(2026,10,4,12));
await p.addInitScript(()=>{Math.random=()=>.22;const tags=new WeakMap(),rig=new WeakSet(),proto=WebGL2RenderingContext.prototype,get=proto.getUniformLocation,put=proto.uniformMatrix4fv;
proto.getUniformLocation=function(program,name){if(name==='headPivot')rig.add(program);const loc=get.call(this,program,name);if(loc)tags.set(loc,{program,name});return loc;};
proto.uniformMatrix4fv=function(loc,t,m,...rest){const q=tags.get(loc);if(q?.name==='modelViewMatrix'&&rig.has(q.program))window.pawMatrix={x:m[12],sx:m[0]};return put.call(this,loc,t,m,...rest);};});
await p.goto((process.env.DOG_URL||'http://127.0.0.1:4205')+'/?mode=play');
await p.waitForFunction(()=>{const d=document.querySelector('canvas')?.dataset;return d?.turning==='false'&&(+d.motionFrame>=32&&+d.motionFrame<48||+d.motionFrame>=112)&&Math.abs(window.pawMatrix?.x)>.1;},null,{timeout:60000});
await p.getByRole('button',{name:'Pet Expo',exact:true}).click();
await p.waitForTimeout(1800);
const tip=p.getByRole('button',{name:'Close first-play tip'});if(await tip.count())await tip.click();
if(!await p.getByRole('button',{name:'High five',exact:true}).isVisible())await p.getByRole('button',{name:'Tricks and toys'}).click();await p.getByRole('button',{name:'High five',exact:true}).click();
await p.getByRole('button',{name:'Give Expo a high five'}).waitFor();await p.waitForTimeout(500);
const q=await p.evaluate(()=>{const c=document.querySelector('.region-stage canvas'),r=c.getBoundingClientRect(),target=document.querySelector('.paw-target').getBoundingClientRect(),v=Math.max(1.08,1/(r.width/r.height)),m=window.pawMatrix;return {actual:target.x+target.width/2,expected:r.x+r.width*(.5+(m.x-.58*m.sx)/(2*v*r.width/r.height)),root:m.x};});
assert(Math.abs(q.root)>.08,'Exercise a dog away from the original centre');assert(Math.abs(q.actual-q.expected)<2,`Paw target follows the rendered dog: ${JSON.stringify(q)}`);
await p.getByRole('button',{name:'Give Expo a high five'}).click();await p.waitForFunction(()=>!document.querySelector('.paw-target'));
console.log('PASS high-five touch target follows the moved and facing dog, and responds',q);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
