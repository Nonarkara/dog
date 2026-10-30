// Build-time registration and chroma staging for the local RIFE CLI. No model runs
// in the browser. Input drawings are preserved, not painted or reconstructed.
const fs=require('node:fs'),sharp=require('sharp');
const names=process.argv.slice(2).length?process.argv.slice(2):['expo','mali','oreo','paolo','hachiku'];
(async()=>{for(const name of names){
 const {data,info}=await sharp(`design/reference/locomotion/${name}-run.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width:w,height:h}=info,seen=new Uint8Array(w*h),queue=new Uint32Array(w*h),parts=[];
 for(let seed=0;seed<w*h;seed++){if(seen[seed]||data[seed*4+3]<80)continue;let start=0,end=0,left=w,right=0,top=h,bottom=0;queue[end++]=seed;seen[seed]=1;while(start<end){const i=queue[start++],x=i%w,y=Math.floor(i/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!seen[j]&&data[j*4+3]>=80){seen[j]=1;queue[end++]=j;}}if(end>10000)parts.push({left,right,top,bottom,indices:Uint32Array.from(queue.slice(0,end))});}
 parts.sort((a,b)=>Math.floor((a.top+a.bottom)/h)-Math.floor((b.top+b.bottom)/h)||a.left-b.left);if(parts.length!==4)throw Error(`${name}: ${parts.length} parts`);
 console.log(name,parts.map(p=>[p.left,p.top,p.right-p.left,p.bottom-p.top]));const scale=Math.min(318/Math.max(...parts.map(c=>c.right-c.left+1)),290/Math.max(...parts.map(c=>c.bottom-c.top+1))),dir=`/tmp/dog-rife/${name}`;fs.mkdirSync(`${dir}/keys`,{recursive:true});fs.mkdirSync(`${dir}/out`,{recursive:true});
 for(const [i,c]of parts.entries()){const cw=c.right-c.left+1,ch=c.bottom-c.top+1,raw=Buffer.alloc(cw*ch*4);for(const p of c.indices){const x=p%w,y=Math.floor(p/w),q=((y-c.top)*cw+x-c.left)*4;for(let k=0;k<4;k++)raw[q+k]=data[p*4+k];}
  // All key poses share one scale. Only suspension poses lift above the floor.
  const rw=Math.round(cw*scale),rh=Math.round(ch*scale),top=(i===0||i===2?328:348)-rh;
  const sprite=await sharp(raw,{raw:{width:cw,height:ch,channels:4}}).resize(rw,rh).png().toBuffer();
  const rgba=await sharp({create:{width:384,height:384,channels:4,background:'#00000000'}}).composite([{input:sprite,left:Math.floor((384-rw)/2),top}]).png().toBuffer();
  await sharp(rgba).flatten({background:'#00ff00'}).png().toFile(`${dir}/keys/${i}.png`);
  await sharp(rgba).png().toFile(`${dir}/key-alpha-${i}.png`);
 }
 console.log(name,parts.map(p=>[p.left,p.top,p.right-p.left,p.bottom-p.top]));
 }} )().catch(e=>{console.error(e);process.exit(1)});
