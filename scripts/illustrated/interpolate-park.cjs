// Authoring only: generate 30fps-capable animation textures with local RIFE4.6.
// RIFE_BIN points to the official portable executable, RIFE_MODEL to rife-v4.6.
// Generated source pictures stay in design/reference/locomotion. Browser gets WebP.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),{execFileSync}=require('node:child_process');
const bin=process.env.RIFE_BIN,model=process.env.RIFE_MODEL;if(!bin||!model)throw Error('Set RIFE_BIN and RIFE_MODEL. See design/park-locomotion.md.');
const names=process.argv.slice(2).length?process.argv.slice(2):['expo','mali','oreo','paolo','hachiku'],N=320,manifest={};
(async()=>{execFileSync(process.execPath,['scripts/illustrated/build-locomotion.cjs'],{stdio:'inherit'});for(const name of names){const root=`/tmp/dog-rife/${name}`;execFileSync(process.execPath,['scripts/illustrated/prepare-run.cjs',name],{stdio:'inherit'});
 execFileSync(process.execPath,['scripts/illustrated/prepare-depth.cjs',name],{stdio:'inherit'});
 const kinds=[['run',4,32],['walk',8,16],['turn',8,32],['toward',4,16],['away',4,16]];
 if(!process.env.RIFE_SKIP)for(const [kind,count,total]of kinds){const dir=`${root}/${kind}`;fs.mkdirSync(`${dir}/in`,{recursive:true});fs.mkdirSync(`${dir}/out`,{recursive:true});for(let i=0;i<count;i++){
  if(kind==='toward'||kind==='away')continue;
  let source;if(kind==='run')source=sharp(`${root}/keys/${i}.png`);
  else if(kind==='walk')source=sharp(`/tmp/dog-rife/source-poses/${name}-${i}.webp`);
  else if(i===0||i===4)source=sharp(`public/dogs/${name}.webp`);
  else source=sharp(`/tmp/dog-rife/source-poses/${name}-${({1:8,2:9,3:8,5:11,6:10,7:11})[i]}.webp`);
  // Mali's rear-three-quarter source faces right; all other source art faces left.
  if(kind==='turn'&&(i===3||i===4||i===5||(name==='mali'&&i===7)))source=source.flop();
  if(kind==='turn'&&name==='mali'&&i===5)source=source.flop(false);
  await source.resize(384,384).flatten({background:'#00ff00'}).png().toFile(`${dir}/in/${String(i).padStart(2,'0')}.png`);
 }fs.copyFileSync(`${dir}/in/00.png`,`${dir}/in/${String(count).padStart(2,'0')}.png`);
 execFileSync(bin,['-i',`${dir}/in`,'-o',`${dir}/out`,'-n',String((count+1)*total/count),'-m',model,'-j','1:2:2'],{stdio:['ignore','ignore','inherit']});
 }
 const layers=[],frames=[];let index=0;
 for(const [kind,,total]of kinds){const files=fs.readdirSync(`${root}/${kind}/out`).filter(f=>f.endsWith('.png')).sort().slice(0,total);if(files.length!==total)throw Error(`${name}/${kind}: incomplete interpolation`);
  for(const f of files){const {data,info}=await sharp(`${root}/${kind}/out/${f}`).resize(N).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let left=N,right=0,top=N,bottom=0;for(let p=0;p<N*N;p++){const o=p*4,r=data[o],g=data[o+1],b=data[o+2],a=1-Math.max(0,g-Math.max(r,b))/255;if(a<.025){data[o+3]=0;continue;}data[o]=Math.min(255,Math.round(r/a));data[o+1]=Math.max(0,Math.min(255,Math.round((g-(1-a)*255)/a)));data[o+2]=Math.min(255,Math.round(b/a));data[o+3]=Math.round(a*255);if(a>.3){const x=p%N,y=Math.floor(p/N);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
   const feet=[];for(const [lo,hi]of [[.27,.53],[0,.27],[.78,1],[.53,.78]]){let max=-1,xsum=0,mass=0;for(let y=Math.floor(N*.65);y<N;y++)for(let x=Math.floor(N*lo);x<Math.floor(N*hi);x++)if(data[(y*N+x)*4+3]>100)max=Math.max(max,y);for(let y=Math.max(0,max-3);y<=max;y++)for(let x=Math.floor(N*lo);x<Math.floor(N*hi);x++)if(data[(y*N+x)*4+3]>100){mass++;xsum+=x;}feet.push([(mass?xsum/mass:N*(lo+hi)/2)/N,Math.max(max,0)/N]);}
   let inkLeft=left/N,inkRight=(right+1)/N,inkTop=top/N,inkBottom=(bottom+1)/N;
   if(kind==='run'){inkLeft=1;inkRight=0;inkTop=1;inkBottom=0;const phase=index/8,k=Math.floor(phase),t=phase-k,necks=[[.36,.72],[.38,.73],[.40,.76],[.40,.72]],nx=necks[k][0]*(1-t)+necks[(k+1)%4][0]*t,ny=necks[k][1]*(1-t)+necks[(k+1)%4][1]*t;const smooth=(lo,hi,v)=>{const t=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return t*t*(3-2*t);};
    for(let p=0;p<N*N;p++)if(data[p*4+3]>80){const x=(p%N)/N,y=Math.floor(p/N)/N,mask=(1-smooth(nx-.035,nx+.065,x))*(1-smooth(ny-.07,ny+.035,y)),xx=x+(x-nx)*.4*mask,yy=y+(y-ny)*.4*mask;inkLeft=Math.min(inkLeft,xx);inkRight=Math.max(inkRight,xx+1/N);inkTop=Math.min(inkTop,yy);inkBottom=Math.max(inkBottom,yy+1/N);}
   }
   const displayBox=[inkLeft,inkTop,inkRight-inkLeft,inkBottom-inkTop];
   layers.push({input:await sharp(data,{raw:info}).png().toBuffer(),left:(index%10)*N,top:Math.floor(index/10)*N});frames.push({box:[left/N,top/N,(right-left+1)/N,(bottom-top+1)/N],feet,kind,displayBox});index++;
  }
 }
 if(index!==112)throw Error('Atlas layout mismatch');await sharp({create:{width:N*10,height:N*12,channels:4,background:'#00000000'}}).composite(layers).webp({quality:87,alphaQuality:100}).toFile(`public/dogs/motion/${name}-motion.webp`);await sharp(`public/dogs/motion/${name}-motion.webp`).resize(1920,2304).webp({quality:87,alphaQuality:100}).toFile(`public/dogs/motion/${name}-motion-lite.webp`);manifest[name]=frames;console.log('BUILT',name,index,fs.statSync(`public/dogs/motion/${name}-motion.webp`).size);
 }
 const previous=fs.existsSync('src/components/parkLocomotionArt.json')?JSON.parse(fs.readFileSync('src/components/parkLocomotionArt.json','utf8')):{};fs.writeFileSync('src/components/parkLocomotionArt.json',JSON.stringify({...previous,...manifest},(key,value)=>typeof value==='number'?Math.round(value*10000)/10000:value));
})().catch(e=>{console.error(e);process.exit(1)});
