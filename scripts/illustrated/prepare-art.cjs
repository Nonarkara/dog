// Authoring utility: white-backed illustration -> normalized alpha WebP.
// Uses sharp in the authoring environment; generated game files are committed.
const sharp=require('sharp');
const fs=require('node:fs');
(async()=>{
 const [input,output,quadrant]=process.argv.slice(2);
 if(!input||!output)throw Error('Usage: node prepare-art.cjs input output [quadrant 0..3 or left,top,width,height]');
 let source=sharp(input); const meta=await source.metadata();
 if(quadrant?.includes(',')){const [left,top,width,height]=quadrant.split(',').map(Number);source=source.extract({left,top,width,height});}
 else if(quadrant!==undefined){const q=+quadrant,w=Math.floor(meta.width/2),h=Math.floor(meta.height/2);source=source.extract({left:(q%2)*w,top:Math.floor(q/2)*h,width:w,height:h});}
 const {data,info}=await source.ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info; const seen=new Uint8Array(w*h),queue=new Uint32Array(w*h);let start=0,end=0;
 const background=i=>data[i*4]>242&&data[i*4+1]>242&&data[i*4+2]>242;
 const add=i=>{if(!seen[i]&&background(i)){seen[i]=1;queue[end++]=i;}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
 while(start<end){const i=queue[start++],x=i%w,y=(i/w)|0;data[i*4+3]=0;if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w);}
 // A neighboring cell may contribute a detached ear at the crop edge. Keep
 // the dog's connected silhouette, not those stray fragments or paper specks.
 const labels=new Int32Array(w*h);let label=0,largest=0,largestSize=0;
 for(let seed=0;seed<w*h;seed++){
  if(!data[seed*4+3]||labels[seed])continue;
  label++;start=0;end=0;queue[end++]=seed;labels[seed]=label;
  while(start<end){const i=queue[start++],x=i%w,y=(i/w)|0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy,n=ny*w+nx;
    if(nx>=0&&nx<w&&ny>=0&&ny<h&&!labels[n]&&data[n*4+3]){labels[n]=label;queue[end++]=n;}
   }
  }
  if(end>largestSize){largestSize=end;largest=label;}
 }
 for(let i=0;i<w*h;i++)if(labels[i]!==largest)data[i*4+3]=0;
 let minX=w,minY=h,maxX=0,maxY=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(data[i+3]){minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);}}
 if(maxX<=minX||maxY<=minY)throw Error('No foreground found');
 const crop=await sharp(data,{raw:info}).extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1}).resize(620,620,{fit:'inside'}).png().toBuffer();
 const size=await sharp(crop).metadata();
 await sharp({create:{width:768,height:768,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:crop,left:Math.round((768-size.width)/2),top:Math.round(700-size.height)}]).webp({quality:90,alphaQuality:100}).toFile(output);
 console.log(output,fs.statSync(output).size,'bytes',`${size.width}x${size.height}`);
})().catch(e=>{console.error(e);process.exit(1)});
