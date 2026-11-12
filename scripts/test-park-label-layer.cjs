const {chromium}=require('playwright'),assert=require('node:assert/strict');
/* A dog's NAME must never be painted over.
 *
 * The park is three layers: the scenery (ground, props), the WebGL canvas
 * (the dogs), and the overlay. The name used to live in the scenery, so any
 * dog standing in front of it drew OVER it — a neighbour's head cut the
 * first letter off "Expo", and a prop's beam cut through "Hachiku". A name
 * is how you know who is in the park, so it belongs in the layer above the
 * canvas. The shadow stays below, because a shadow belongs under the dog.
 */
const url=process.env.DOG_URL||'http://127.0.0.1:4178/?mode=play';
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true,args:process.env.DOG_NATIVE_GL?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const p=await b.newPage({viewport:{width:390,height:844}});
    p.setDefaultTimeout(60000);
    await p.goto(url,{waitUntil:'domcontentloaded'});
    await p.waitForSelector('canvas',{timeout:60000});
    await p.waitForTimeout(4000);
    await p.getByRole('button',{name:'Open Commons park'}).click();
    await p.waitForFunction(()=>document.querySelector('.park-dog-labels text'),{timeout:60000});
    const layers=await p.evaluate(()=>{
      const host=document.querySelector('.illustrated-park');
      const names=document.querySelector('.park-dog-labels');
      const canvas=host.querySelector('canvas');
      const overlay=document.querySelector('.park-overlay');
      const ground=document.querySelector('.park-dog-ground');
      const z=(el)=>el?parseInt(getComputedStyle(el).zIndex||'0',10):0;
      return {
        nameParent:names?.parentElement?.getAttribute('class'),
        overlayZ:z(overlay), canvasZ:z(canvas),
        groundParent:ground?.parentElement?.getAttribute('class'),
        names:names?[...names.querySelectorAll('text')].map(t=>t.textContent):[],
        shadows:ground?ground.querySelectorAll('.park-contact-shadow').length:0,
      };
    });
    assert(layers.nameParent==='park-overlay','The dog names must live in the overlay, above the canvas');
    assert(layers.overlayZ>layers.canvasZ,'The overlay must paint above the canvas');
    assert(layers.groundParent==='park-scenery','The contact shadows must stay in the scenery, below the dogs');
    assert(layers.names.length>0,'The park must show the dogs by name');
    assert(layers.shadows>0,'The dogs must still cast their contact shadows on the ground');
    console.log('PASS dog names paint above the canvas and the contact shadows below it;',layers.names.join(', '));
  }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
