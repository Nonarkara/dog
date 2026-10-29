const {chromium}=require('playwright');const fs=require('fs');const assert=require('assert/strict');
const out=process.env.DOG_EVIDENCE||'/tmp/dog-motion';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:680,height:650},recordVideo:{dir:out,size:{width:680,height:650}}});p.setDefaultTimeout(60000);p.on('response',r=>{if(r.status()>=400)console.error('HTTP',r.status(),r.url());});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.goto((process.env.DOG_URL||'http://127.0.0.1:3189')+'/scripts/illustrated/fixture.html');await p.bringToFront();const samples=[];const cdp=await p.context().newCDPSession(p);const shot=async n=>{const{data}=await cdp.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,...p.viewportSize(),scale:1},captureBeyondViewport:true});fs.writeFileSync(`${out}/${n}.png`,Buffer.from(data,'base64'));};
for(const dog of ['Expo','Mali','Oreo','Paolo','Hachiku']){
 await p.getByRole('button',{name:dog,exact:true}).click();await p.waitForFunction(id=>document.querySelector('canvas')?.dataset.dog===id&&+document.querySelector('canvas').dataset.frames>5,({Expo:'expo-2021',Mali:'mali-2022',Oreo:'oreo-frenchie',Paolo:'paolo-pug',Hachiku:'shiba-chai'})[dog]);
 for(const pose of ['stand','sit','down','paw','sleep']){await p.getByRole('button',{name:pose,exact:true}).click();await p.waitForFunction(pose=>document.querySelector('canvas').dataset.pose===pose&&document.querySelector('canvas').dataset.artPose===pose,pose);await p.waitForFunction(()=>document.querySelector('canvas').dataset.transition==='0');await p.waitForTimeout(100);await shot(`${dog}-${pose}`);}
 await p.getByRole('button',{name:'stand',exact:true}).click();await p.waitForFunction(()=>document.querySelector('canvas').dataset.artPose==='stand');
 for(const action of ['walk','pet','groom','feed']){
  for(const frame of [0,1]){
   let captured=false;
   for(let attempt=0;attempt<3&&!captured;attempt++){
    await p.getByRole('button',{name:action,exact:true}).evaluate(async el=>{el.click();await new Promise(r=>setTimeout(r,100));});
    await p.waitForTimeout(attempt===0?(frame===0?50:250):0);
    const before=await p.locator('canvas').evaluate(c=>({...c.dataset}));
    await shot(`${dog}-${action}-${frame}`);
    const after=await p.locator('canvas').evaluate(c=>({...c.dataset}));
    captured=before.action===action&&after.action===action;
    if(captured)samples.push({dog,action,frame,before,after});
   }
   assert(captured,`${dog} ${action} ${frame}: screenshot must remain in the active action`);
  }
  await p.waitForTimeout(2300);
 }
 console.log('Motion captured:',dog);
}
fs.writeFileSync(`${out}/actions.json`,JSON.stringify(samples,null,2));assert.deepEqual(errors,[]);await p.close();await b.close();console.log('PASS all five poses/actions; video and frame pairs:',out);
})().catch(e=>{console.error(e);process.exit(1)});
