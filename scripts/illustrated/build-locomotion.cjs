// Crop the authored sprites without redrawing them. Keep connected alpha silhouettes;
// register a fixed scale/floor (never fit each frame to a different rectangle).
const sharp=require('sharp'),fs=require('node:fs');
fs.mkdirSync('/tmp/dog-rife/source-poses',{recursive:true});
const names=['expo','mali','oreo','paolo','hachiku'],N=384;
(async()=>{const manifest={};for(const name of names){
 const {data,info}=await sharp(`design/reference/locomotion/${name}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=info;
 const seen=new Uint8Array(w*h),queue=new Uint32Array(w*h),components=[];
 for(let seed=0;seed<w*h;seed++){if(seen[seed]||data[seed*4+3]<80)continue;let start=0,end=0,left=w,right=0,top=h,bottom=0;queue[end++]=seed;seen[seed]=1;
  while(start<end){const i=queue[start++],x=i%w,y=Math.floor(i/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&data[j*4+3]>=80){seen[j]=1;queue[end++]=j;}}
  if(end>5000)components.push({left,right,top,bottom,indices:Uint32Array.from(queue.slice(0,end))});
 }
 components.sort((a,b)=>Math.floor((a.top+a.bottom)/2/(h/3))-Math.floor((b.top+b.bottom)/2/(h/3))||a.left-b.left);
 if(components.length!==12)throw Error(`${name}: expected12 dog silhouettes, got ${components.length}`);
 const scale=Math.min(318/Math.max(...components.slice(0,8).map(c=>c.right-c.left)),312/Math.max(...components.map(c=>c.bottom-c.top)));
 const records=[];
 for(const [i,c]of components.entries()){
  const cw=c.right-c.left+1,ch=c.bottom-c.top+1,raw=Buffer.alloc(cw*ch*4);let sumX=0,mass=0;
  for(const p of c.indices){const x=p%w,y=Math.floor(p/w),q=((y-c.top)*cw+x-c.left)*4;for(let k=0;k<4;k++)raw[q+k]=data[p*4+k];if(y>c.top+ch*.28&&y<c.top+ch*.64){sumX+=x-c.left;mass++;}}
  const center=mass?sumX/mass:cw/2,rw=Math.round(cw*scale),rh=Math.round(ch*scale),left=Math.round(N/2-center*scale),top=348-rh;
  const resized=await sharp(raw,{raw:{width:cw,height:ch,channels:4}}).resize(rw,rh).png().toBuffer();
  const canvas=await sharp({create:{width:N,height:N,channels:4,background:'#00000000'}}).composite([{input:resized,left,top}]).webp({quality:88,alphaQuality:100}).toBuffer();
  fs.writeFileSync(`/tmp/dog-rife/source-poses/${name}-${i}.webp`,canvas);
  const zones=i<8?[[.27,.53],[0,.27],[.78,1],[.53,.78]]:[[.15,.45],[.4,.5],[.55,.85],[.5,.6]];
  const feet=zones.map(([lo,hi])=>{let bottom=-1,total=0,xsum=0;for(let y=Math.floor(ch*.6);y<ch;y++)for(let x=Math.floor(cw*lo);x<Math.floor(cw*hi);x++)if(raw[(y*cw+x)*4+3]>100)bottom=Math.max(bottom,y);for(let y=Math.max(0,bottom-6);y<=bottom;y++)for(let x=Math.floor(cw*lo);x<Math.floor(cw*hi);x++)if(raw[(y*cw+x)*4+3]>100){xsum+=x;total++;}return [(left+(total?xsum/total:cw*(lo+hi)/2)*scale)/N,(top+Math.max(bottom,0)*scale)/N];});
  records.push({i,source:[c.left,c.top,cw,ch],box:[left/N,top/N,rw/N,rh/N],feet});
 }
 manifest[name]={size:N,floor:348/N,frames:records};console.log(name,records.map(r=>r.source));
 }
 fs.writeFileSync('design/reference/locomotion/crops.json',JSON.stringify(manifest,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
