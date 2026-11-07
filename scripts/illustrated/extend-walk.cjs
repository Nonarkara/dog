// Authoring only. Doubles every dog's walk from 16 to 32 drawings WITHOUT touching
// a single existing drawing's index: RIFE in-betweens are appended as frames
// 112..127 (the drawing after authored walk frame j is 112+j). Atlas becomes
// 12 columns x 11 rows (3840x3520, under the 4096 texture limit of older phones).
//
//   RIFE_BIN=.../rife-ncnn-vulkan RIFE_MODEL=.../rife-v4.6 node scripts/illustrated/extend-walk.cjs [dog...]
//
// Re-running is safe: it reads walk tiles 32..47 and the first 112 tiles, so an
// already extended atlas (12 columns) is read with its own layout.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),{execFileSync}=require('node:child_process');
const bin=process.env.RIFE_BIN,model=process.env.RIFE_MODEL;
if(!bin||!model)throw Error('Set RIFE_BIN and RIFE_MODEL.');
const names=process.argv.slice(2).length?process.argv.slice(2):['expo','mali','oreo','paolo','hachiku'];
const N=320,COLS=12,ROWS=11,BASE=112,MID=16,WORK=process.env.WALK_WORK||'/tmp/dog-walk';
const jsonPath='src/components/parkLocomotionArt.json';
function feetOf(data){
  const feet=[];
  for(const [lo,hi] of [[.27,.53],[0,.27],[.78,1],[.53,.78]]){
    let max=-1,xsum=0,mass=0;
    for(let y=Math.floor(N*.65);y<N;y++)for(let x=Math.floor(N*lo);x<Math.floor(N*hi);x++)if(data[(y*N+x)*4+3]>100)max=Math.max(max,y);
    for(let y=Math.max(0,max-3);y<=max;y++)for(let x=Math.floor(N*lo);x<Math.floor(N*hi);x++)if(data[(y*N+x)*4+3]>100){mass++;xsum+=x;}
    feet.push([(mass?xsum/mass:N*(lo+hi)/2)/N,Math.max(max,0)/N]);
  }
  return feet;
}
// Same chroma-key un-mix the original atlas builder uses, so in-betweens match.
function unkey(data){
  let left=N,right=0,top=N,bottom=0;
  for(let p=0;p<N*N;p++){
    const o=p*4,r=data[o],g=data[o+1],b=data[o+2],a=1-Math.max(0,g-Math.max(r,b))/255;
    if(a<.025){data[o+3]=0;continue;}
    data[o]=Math.min(255,Math.round(r/a));
    // No dog here has green fur, so any green left over from the green screen is spill: cap it.
    data[o+1]=Math.max(0,Math.min(Math.max(data[o],Math.round(b/a)),Math.round((g-(1-a)*255)/a)));
    data[o+2]=Math.min(255,Math.round(b/a));
    data[o+3]=Math.round(a*255);
    if(a>.3){const x=p%N,y=Math.floor(p/N);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  const box=[left/N,top/N,(right-left+1)/N,(bottom-top+1)/N];
  return {box,feet:feetOf(data),kind:'walk',displayBox:[left/N,top/N,(right-left+1)/N,(bottom-top+1)/N]};
}
(async()=>{
  const art=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
  for(const name of names){
    const file=`public/dogs/motion/${name}-motion.webp`;
    const {data:atlas,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const cols=info.width/N;
    if(![10,COLS].includes(cols))throw Error(`${name}: unexpected atlas width ${info.width}`);
    const tile=async i=>sharp(atlas,{raw:info}).extract({left:(i%cols)*N,top:Math.floor(i/cols)*N,width:N,height:N}).raw().toBuffer();
    const root=`${WORK}/${name}`;fs.rmSync(root,{recursive:true,force:true});fs.mkdirSync(`${root}/in`,{recursive:true});fs.mkdirSync(`${root}/out`,{recursive:true});
    // RIFE runs at the tile's own 320 px: no resampling, so in-betweens stay as sharp as their neighbours.
    for(let i=0;i<=16;i++){const t=await tile(32+(i%16));await sharp(t,{raw:{width:N,height:N,channels:4}}).flatten({background:'#00ff00'}).png().toFile(`${root}/in/${String(i).padStart(2,'0')}.png`);}
    execFileSync(bin,['-i',`${root}/in`,'-o',`${root}/out`,'-n','34','-m',model,'-j','1:2:2'],{stdio:['ignore','ignore','inherit']});
    const outs=fs.readdirSync(`${root}/out`).filter(f=>f.endsWith('.png')).sort().slice(0,32);
    if(outs.length!==32)throw Error(`${name}: RIFE gave ${outs.length} frames`);
    const mids=[],metas=[];
    for(let j=0;j<MID;j++){
      const {data}=await sharp(`${root}/out/${outs[2*j+1]}`).resize(N).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      metas.push(unkey(data));mids.push(Buffer.from(data));
    }
    // feetOf() reports y=0 when no paw pixel sits in a band. An in-between's true foot is
    // the midpoint of its two neighbours' feet; use whichever neighbour is valid.
    // The authored walk has the same gap in a few frames (a paw hidden behind another leg):
    // repair those from the nearest valid drawings either side, so no neighbour is itself invalid.
    for(let leg=0;leg<4;leg++)for(let j=0;j<16;j++){const f=art[name][32+j].feet[leg];if(f[1]>0)continue;
      const near=d=>{for(let s=1;s<16;s++){const q=art[name][32+(j+d*s+16)%16].feet[leg];if(q[1]>0)return q;}return null;},p=near(-1),n=near(1);
      if(p&&n)art[name][32+j].feet[leg]=[(p[0]+n[0])/2,(p[1]+n[1])/2];}
    for(let j=0;j<MID;j++){const a=art[name][32+j].feet,b=art[name][32+(j+1)%16].feet;
      metas[j].feet=metas[j].feet.map((f,leg)=>{if(f[1]>0)return f;const ok=[a[leg],b[leg]].filter(q=>q[1]>0);
        return ok.length===2?[(ok[0][0]+ok[1][0])/2,(ok[0][1]+ok[1][1])/2]:ok.length?ok[0]:f;});}
    const layers=[];
    for(let i=0;i<BASE;i++)layers.push({input:await sharp(await tile(i),{raw:{width:N,height:N,channels:4}}).png().toBuffer(),left:(i%COLS)*N,top:Math.floor(i/COLS)*N});
    for(let j=0;j<MID;j++){const i=BASE+j;layers.push({input:await sharp(mids[j],{raw:{width:N,height:N,channels:4}}).png().toBuffer(),left:(i%COLS)*N,top:Math.floor(i/COLS)*N});}
    const out=`public/dogs/motion/${name}-motion.webp`;
    await sharp({create:{width:N*COLS,height:N*ROWS,channels:4,background:'#00000000'}}).composite(layers).webp({quality:92,alphaQuality:100,smartSubsample:false}).toFile(out+'.tmp');
    await sharp(out+'.tmp').resize(N*COLS/2,N*ROWS/2).webp({quality:90,alphaQuality:100}).toFile(`public/dogs/motion/${name}-motion-lite.webp.tmp`);
    fs.renameSync(out+'.tmp',out);fs.renameSync(`public/dogs/motion/${name}-motion-lite.webp.tmp`,`public/dogs/motion/${name}-motion-lite.webp`);
    art[name]=[...art[name].slice(0,BASE),...metas];
    // Atlas and metadata move together, one dog at a time: a failure on dog 3 never leaves dogs 1-2 half-updated.
    fs.writeFileSync(jsonPath,JSON.stringify(art,(key,value)=>typeof value==='number'?Math.round(value*10000)/10000:value));
    console.log('EXTENDED',name,art[name].length,fs.statSync(out).size);
  }
})().catch(e=>{console.error(e);process.exit(1)});
