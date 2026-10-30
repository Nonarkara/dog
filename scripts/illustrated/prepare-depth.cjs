const fs=require('node:fs'),sharp=require('sharp');
(async()=>{const name=process.argv[2];const {data,info}=await sharp(`design/reference/locomotion/${name}-depth.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=info,seen=new Uint8Array(w*h),queue=new Uint32Array(w*h),parts=[];
for(let seed=0;seed<w*h;seed++){if(seen[seed]||data[seed*4+3]<80)continue;let start=0,end=0,left=w,right=0,top=h,bottom=0;queue[end++]=seed;seen[seed]=1;while(start<end){const i=queue[start++],x=i%w,y=Math.floor(i/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&data[j*4+3]>=80){seen[j]=1;queue[end++]=j;}}if(end>10000)parts.push({left,right,top,bottom,indices:Uint32Array.from(queue.slice(0,end))});}
parts.sort((a,b)=>Math.floor((a.top+a.bottom)/h)-Math.floor((b.top+b.bottom)/h)||a.left-b.left);if(parts.length!==8)throw Error(`${name}: ${parts.length} depth sprites`);
const scale=312/Math.max(...parts.map(c=>c.bottom-c.top+1));for(const [row,kind]of ['toward','away'].entries()){const dir=`/tmp/dog-rife/${name}/${kind}/in`;fs.mkdirSync(dir,{recursive:true});for(let frame=0;frame<4;frame++){
 // Finish the diagonal exchange from the first two authored phases. Only the
 // lower leg region reflects: the face, ear asymmetry and coat remain unchanged.
 const c=parts[row*4+frame%2],cw=c.right-c.left+1,ch=c.bottom-c.top+1,raw=Buffer.alloc(cw*ch*4);for(const p of c.indices){const x=p%w,y=Math.floor(p/w),q=((y-c.top)*cw+x-c.left)*4;for(let k=0;k<4;k++)raw[q+k]=data[p*4+k];}
 const rw=Math.round(cw*scale),rh=Math.round(ch*scale),sprite=await sharp(raw,{raw:{width:cw,height:ch,channels:4}}).resize(rw,rh).png().toBuffer();
 const buf=await sharp({create:{width:384,height:384,channels:4,background:'#00000000'}}).composite([{input:sprite,left:Math.round((384-rw)/2),top:348-rh}]).raw().toBuffer();
 if(frame>=2){const copy=Buffer.from(buf);for(let y=0;y<384;y++){const t=Math.max(0,Math.min(1,(y/384-.65)/.075)),f=t*t*(3-2*t);if(!f)continue;for(let x=0;x<384;x++){const a=(y*384+x)*4,b=(y*384+383-x)*4;for(let k=0;k<4;k++)buf[a+k]=Math.round(copy[a+k]*(1-f)+copy[b+k]*f);}}}
 await sharp(buf,{raw:{width:384,height:384,channels:4}}).flatten({background:'#00ff00'}).png().toFile(`${dir}/0${frame}.png`);
 }}console.log('depth keys',name);})().catch(e=>{console.error(e);process.exit(1)});
