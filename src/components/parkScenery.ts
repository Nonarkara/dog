/** One small park seen from a single 3/4 front view, sun from the upper left.
 * Pigments reuse the household's credited Wada colors: Forest guardian294
 * (lawn, leaf, ink), Lemon explorer60 (water), Biscuit dreamer11 (timber).
 * Depth is cel, never gradient: mown bands widen toward the viewer, a hedge and
 * post-and-rail fence close the back, pale far trees sit behind them. Every
 * object touches the ground with a small flat ellipse, cast to the lower right.
 * World y is depth; dogs are drawn over this at their feet. Scale is dog-first:
 * a bench seats a dog, a bowl is a bowl, a tree crown is a tree.
 * Contracts read by parkCanopy.ts, selftest.ts and IllustratedPark.tsx: four
 * tree groups `translate(x y) scale(s)"><ellipse cy="65" rx="90"` with the crown
 * path `M-83-55...` fill #386344; pond ellipse (-275,90) 180x115; `.park-landmarks`. */
const INK='#614c37',SHADE='#b9c6a6',TIMBER='#845a2f',CREAM='#fbfaee';
const rnd=(i:number)=>{const s=Math.sin(i*127.1+311.7)*43758.5453;return s-Math.floor(s);};
const f=(n:number)=>Math.round(n*10)/10;
/** Contact shadow: a flat ellipse, nudged right and down to match the sun. */
const contact=(x:number,y:number,rx:number,ry=rx*.28)=>`<ellipse cx="${f(x+rx*.14)}" cy="${f(y+ry*.2)}" rx="${f(rx)}" ry="${f(ry)}" fill="${SHADE}"/>`;
const cr=(p:number[][],i:number,t:number)=>{const a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],d=p[Math.min(p.length-1,i+2)],t2=t*t,t3=t2*t;
 return [0,1].map(k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3));};
/** Path centreline: from the gate in the back fence to the front, widening as it nears. */
const CENTRE=[[-10,-252],[5,-180],[40,-60],[90,60],[135,200],[150,380],[160,560],[165,780]];
const half=(y:number)=>18+(y+252)*.085;
const pathPts=(()=>{const L:number[][]=[],R:number[][]=[];let n=0;for(let i=0;i<CENTRE.length-1;i++)for(let k=0;k<8;k++){const [x,y]=cr(CENTRE,i,k/8),h=half(y),w=(rnd(n++)-.5)*3;L.push([x-h+w,y]);R.push([x+h-w,y]);}
 const e=CENTRE[CENTRE.length-1];L.push([e[0]-half(e[1]),e[1]]);R.push([e[0]+half(e[1]),e[1]]);return {L,R};})();
const poly=(p:number[][])=>p.map(([x,y],i)=>`${i?'L':'M'}${f(x)} ${f(y)}`).join('');
const stripes=(()=>{let y=-252,h=34,i=0,s='';while(y<1300){if(i++%2)s+=`<rect x="-3000" y="${f(y)}" width="6000" height="${f(h)}" fill="#dae4cc"/>`;y+=h;h*=1.17;}return s;})();
const pebbles=Array.from({length:34},(_,i)=>{const y=-210+rnd(i*3+1)*960,c=cr(CENTRE,Math.min(CENTRE.length-2,Math.max(0,Math.floor((y+252)/146))),((y+252)%146)/146),h=half(y)*.82;return `<ellipse cx="${f(c[0]+(rnd(i*3+2)-.5)*2*h)}" cy="${f(y)}" rx="${f(2+rnd(i)*2.6)}" ry="1.4" fill="#e3dcc0"/>`;}).join('');
const scallops=(x0:number,x1:number,yb:number,w:number,up:number,seed:number)=>{let d=`M${x0} ${yb}V${f(yb-up*.55)}`;for(let x=x0,i=0;x<x1;x+=w,i++)d+=`q${w/2} ${f(-up*(.5+rnd(seed+i)*.5))} ${w} 0`;return d+`V${yb}Z`;};
const hedgeTicks=(x0:number,x1:number,yb:number,seed:number,skip:(x:number)=>boolean)=>{let s='';for(let x=x0,i=0;x<x1;x+=26,i++){const xx=x+rnd(seed+i)*14;if(skip(xx))continue;const y=yb-14-rnd(seed+i+9)*26;s+=`M${f(xx)} ${f(y)}q9-6 18-2`;}return `<path d="${s}" fill="none" stroke="#6f9678" stroke-width="3.2" stroke-linecap="round"/>`;};
const farTrees=Array.from({length:26},(_,i)=>{const x=-1330+i*104+rnd(i)*40,r=34+rnd(i+30)*24,y=-312;return `<g transform="translate(${f(x)} ${y})"><path d="M-3 0V-22h6V0Z" fill="#a9b994"/><circle cy="${f(-22-r*.7)}" r="${f(r)}" fill="#bfcfb0"/><circle cx="${f(-r*.35)}" cy="${f(-22-r*.95)}" r="${f(r*.5)}" fill="#cddabd"/></g>`;}).join('');
const pondRing=(k:number,dy=0)=>{let d='';for(let i=0;i<72;i++){const a=i/72*Math.PI*2,r=k*(.965+.035*Math.sin(3*a+1)),x=-275+180*r*Math.cos(a),y=90+dy+115*r*Math.sin(a);d+=`${i?'L':'M'}${f(x)} ${f(y)}`;}return d+'Z';};
const onRing=(deg:number,k:number)=>{const a=deg*Math.PI/180;return [-275+180*k*Math.cos(a),90+115*k*Math.sin(a)];};
const stones=[28,52,76,100,124,148,172].map((deg,i)=>{const [x,y]=onRing(deg,1.075),r=7+rnd(i+5)*5;return `${contact(x,y+r*.55,r*1.15,r*.34)}<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r*.62)}" fill="#e1dac2" stroke="${INK}" stroke-width="1.6"/>`;}).join('');
const reeds=[-128,-118,-108,-98].map((deg,i)=>{const [x,y]=onRing(deg,1.06),h=44+rnd(i+2)*22,lean=(i-1.5)*5;return `<path d="M${f(x)} ${f(y)}q${lean} ${-h*.5} ${lean*1.6} ${-h}" fill="none" stroke="#526449" stroke-width="2.4"/><ellipse cx="${f(x+lean*1.6)}" cy="${f(y-h-6)}" rx="3" ry="8" fill="${INK}"/>`;}).join('');
const tuft=(x:number,y:number,k=1)=>`<g transform="translate(${x} ${y}) scale(${k})">${contact(0,2,20,5)}<path d="M-12 2q-2-12-6-14M-4 2q0-16-2-20M5 2q2-14 8-16M13 2q1-8 7-10" fill="none" stroke="#526449" stroke-width="2.2" stroke-linecap="round"/></g>`;
const bed=(x:number,y:number,rx:number,seed:number)=>`<g transform="translate(${x} ${y})">${contact(0,3,rx,rx*.2)}<ellipse rx="${rx}" ry="${f(rx*.2)}" fill="#b7c49e"/>${Array.from({length:7},(_,i)=>{const px=(i/6-.5)*rx*1.5,py=-3-rnd(seed+i)*7,c=['#e0a9b0','#e8d9a0','#e8c7a9'][i%3];return `<path d="M${f(px)} 0V${f(py)}" stroke="#526449" stroke-width="1.6"/><circle cx="${f(px)}" cy="${f(py)}" r="4.2" fill="${c}"/><circle cx="${f(px)}" cy="${f(py)}" r="1.5" fill="${CREAM}"/>`;}).join('')}</g>`;
const fencePosts=Array.from({length:23},(_,i)=>-550+i*50).filter(x=>x<-66||x>46);
const fence=`<path d="M-640-256H-60M-640-241H-60M44-256H640M44-241H640" stroke="${TIMBER}" stroke-width="4.5"/><path d="M-640-258H-60M44-258H640" stroke="#eadbc0" stroke-width="1.4"/>${fencePosts.map(x=>`${contact(x,-222,9,2.6)}<path d="M${x} -222V-264" stroke="${INK}" stroke-width="7"/>`).join('')}`;
const gate=[-60,44].map(x=>`${contact(x,-222,12,3.4)}<path d="M${x} -222V-282" stroke="${INK}" stroke-width="10"/><path d="M${x-8} -282H${x+8}" stroke="${INK}" stroke-width="5"/>`).join('');
const tree=([x,y,s,v]:(number|string)[])=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="65" rx="90" cx="18" ry="20" fill="${SHADE}"/><path d="M-30 66Q-14 62-13 44Q-8 6-16-60H18Q6 6 14 44Q15 62 32 66Q0 72-30 66Z" fill="#77624e" stroke="${INK}" stroke-width="2"/><path d="M-4 52Q-6 10-9-30M8 48Q6 14 9-24" fill="none" stroke="${INK}" stroke-width="1.4"/><path d="M-8 3L-43-38M8-5l29-37" stroke="#77624e" stroke-width="9"/><path d="M-83-55C-113-95-62-144-27-132C-2-169 47-154 55-126C105-134 121-76 92-57C105-20 49-4 26-20C-12 6-60-9-63-30C-89-24-102-42-83-55Z" fill="#386344" stroke="#294434" stroke-width="2"/><path d="M-65-79Q-35-125 4-104M24-124q43-5 55 37M-20-32q34 9 52-6" fill="none" stroke="#526449" stroke-width="7"/>${v==='a'?'<path d="M-56-96C-70-118-40-134-16-124C4-132 24-118 16-102C30-92 12-76-8-82C-30-72-50-82-56-96Z" fill="#4a7a55"/><path d="M-30-108q10-8 22-4M6-116q9-4 16 3" fill="none" stroke="#6f9678" stroke-width="4"/>':'<path d="M-42-88C-30-110 2-114 16-98C34-100 46-84 34-72C40-58 20-50 4-58C-16-48-38-64-42-88Z" fill="#4a7a55"/><path d="M-16-92q9-7 20-3M12-82q8-2 12 5" fill="none" stroke="#6f9678" stroke-width="4"/>'}</g>`;
const bench=`<g transform="translate(125 -222)">${contact(0,44,92,12)}<path d="M-72 -4V-62M72 -4V-62" stroke="${INK}" stroke-width="7"/><path d="M-78-56H78M-78-38H78" stroke="${TIMBER}" stroke-width="13"/><path d="M-78-61H78M-78-43H78" stroke="#eadbc0" stroke-width="1.6"/><path d="M-66 4L-58 36M66 4L58 36" stroke="${INK}" stroke-width="6" opacity=".55"/><path d="M-84-4H80L88 10H-76Z" fill="#a77b4d" stroke="${INK}" stroke-width="2"/><path d="M-76 10H88V22H-76Z" fill="${TIMBER}" stroke="${INK}" stroke-width="2"/><path d="M-70 22L-72 44M82 22L80 44" stroke="${INK}" stroke-width="8"/>${contact(-72,45,9,2.6)}${contact(80,45,9,2.6)}</g>`;
const bowl=`<g transform="translate(66 225)">${contact(0,8,38,9)}<path d="M-25-6L-20 7Q0 15 20 7L25-6Z" fill="#77624e" stroke="${INK}" stroke-width="2"/><ellipse cy="-6" rx="25" ry="9" fill="#eadbc0" stroke="${INK}" stroke-width="2"/><ellipse cy="-6" rx="18" ry="5.6" fill="#deebed"/><path d="M-9-7q9-3 17 0" fill="none" stroke="${CREAM}" stroke-width="1.6"/></g>`;
const hoop=`<g transform="translate(-95 -148)">${contact(-30,42,12,3.4)}${contact(30,42,12,3.4)}<path d="M-30 42V-10M30 42V-10" stroke="${INK}" stroke-width="7"/><circle cy="-14" r="26" fill="none" stroke="#386344" stroke-width="10"/><circle cy="-14" r="26" fill="none" stroke="#526449" stroke-width="3" stroke-dasharray="5 7"/></g>`;
const jump=`<g transform="translate(250 50)">${contact(-34,48,12,3.4)}${contact(34,48,12,3.4)}${contact(0,48,40,5)}<path d="M-34 48V-22M34 48V-22" stroke="${INK}" stroke-width="7"/><path d="M-38-18H38" stroke="#b37736" stroke-width="9"/><path d="M-38-4H38" stroke="#eadbc0" stroke-width="6"/></g>`;
const aframe=`<g transform="translate(-100 300) scale(.8)">${contact(0,46,96,12)}<path d="M-74 44L-8-58H10L-56 44Z" fill="#eadbc0" stroke="${INK}" stroke-width="3"/><path d="M74 44L8-58H-10L56 44Z" fill="#e2d0ae" stroke="${INK}" stroke-width="3"/><path d="M-84 44H84" stroke="#77624e" stroke-width="7"/><path d="M-52 12l6 9M-30-22l6 9M32-20l-6 9M54 10l-6 9" stroke="${TIMBER}" stroke-width="4"/></g>`;
const sign=`<g transform="translate(-30 -80)">${contact(0,34,16,4.5)}<path d="M0 34V-34" stroke="${INK}" stroke-width="7"/><path d="M-22-38H26L34-26L26-14H-22Z" fill="#a77b4d" stroke="${INK}" stroke-width="2"/><path d="M-14-26H18" stroke="#eadbc0" stroke-width="2"/></g>`;
const ball=`<g transform="translate(-40 12)">${contact(0,9,12,3.4)}<circle r="10" fill="#e8d9a0" stroke="#526449"/><path d="M-8-5q13 2 13 13M-3-9q-1 11-6 12" fill="none" stroke="${CREAM}" stroke-width="2"/></g>`;
const pads=[[-212,116,13],[-186,130,9],[-318,60,11]].map(([x,y,r],i)=>`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f(r*.5)}" fill="#8fae86" stroke="#526449" stroke-width="1.4"/><path d="M${x} ${y}l${r} ${-r*.2}" stroke="#526449" stroke-width="1.4"/>${i===0?`<circle cx="${x+4}" cy="${y-5}" r="3.4" fill="#e0a9b0"/><circle cx="${x+4}" cy="${y-5}" r="1.3" fill="${CREAM}"/>`:''}`).join('');
const sideHedge=(sign:number)=>{const x=(y:number)=>sign*(530+(y+252)*.04);let d=`M${sign*1600} -300V1300H${f(x(1300))}`;for(let y=1300,i=0;y>-252;y-=40,i++)d+=`Q${f(x(y-20)+sign*-12*(.6+rnd(i+70)*.4))} ${y-20} ${f(x(y-40))} ${y-40}`;return d+'Z';};
export function parkScenery(){return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="park-scenery" viewBox="-200 -300 400 600">
<defs>
 <pattern id="lawn" width="173" height="137" patternUnits="userSpaceOnUse"><path d="M19 31l-3-5m3 5l4-6M121 102l-4-5m4 5l4-5M85 45l-2-4" fill="none" stroke="#c3cdb5" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="44" cy="112" rx="1.8" ry="1.2" fill="${CREAM}"/></pattern>
</defs>
<rect x="-5000" y="-5000" width="10000" height="10000" fill="#e1e9d5"/>
<rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#lawn)"/>
<g class="park-landmarks" stroke-linecap="round" stroke-linejoin="round">
 <rect x="-3000" y="-1400" width="6000" height="1090" fill="#e9efe0"/>
 <rect x="-3000" y="-420" width="6000" height="120" fill="#d4e0c8"/>
 ${farTrees}
 ${stripes}
 <rect x="-3000" y="-252" width="6000" height="14" fill="#cfdcc0"/>
 <path d="${scallops(-1600,-52,-252,34,60,1)}${scallops(34,1600,-252,34,60,40)}" fill="#7fa379"/>
 ${hedgeTicks(-1600,1600,-252,100,x=>x>-60&&x<44)}
 <path d="M-1600-252H-52M34-252H1600" stroke="#294434" stroke-width="2.4"/>
 <path d="${sideHedge(-1)}${sideHedge(1)}" fill="#7fa379"/>
 ${fence}
 ${gate}
 <path d="${poly(pathPts.L)}L${f(pathPts.R[pathPts.R.length-1][0])} ${f(pathPts.R[pathPts.R.length-1][1])}${poly(pathPts.R.slice().reverse()).replace('M','L')}Z" fill="#f4f0de"/>
 <path d="${poly(pathPts.L)}M${poly(pathPts.R).slice(1)}" fill="none" stroke="#b3a784" stroke-width="2"/>
 ${pebbles}
 <path d="${pondRing(1.09)}" fill="#cfd3ae" stroke="${INK}" stroke-width="2"/>
 <path d="${pondRing(.985)}" fill="#c9dadd" stroke="#8fa6a8" stroke-width="2"/>
 <path d="${pondRing(.93,6)}" fill="#deebed"/>
 <path d="M-370 80q30 8 60 0M-340 130q40 8 80-1M-300 60q20 6 40 0" fill="none" stroke="${CREAM}" stroke-width="2.6"/>
 ${pads}
 ${stones}
 ${reeds}
 ${bench}
 ${sign}
 ${[[-270,-210,1.1,'a'],[310,-75,1.4,'b'],[-315,320,1.2,'b'],[280,370,1.0,'a']].map(tree).join('')}
 ${bed(-96,-236,38,3)}${bed(468,-236,48,12)}${bed(392,168,34,21)}
 ${tuft(-420,150)}${tuft(420,-170,1.2)}${tuft(-60,420)}
 ${bowl}
 ${ball}
 ${hoop}
 ${jump}
 ${aframe}
 <g class="park-butterfly park-butterfly-a"><ellipse rx="5" ry="3" fill="${TIMBER}"/><path d="M-2 0Q-12-9-6 2ZM2 0Q12-9 6 2Z" fill="#e0a9b0"/></g>
 <g class="park-butterfly park-butterfly-b"><ellipse rx="4.4" ry="2.7" fill="${INK}"/><path d="M-2 0Q-11-8-5 2ZM2 0Q11-8 5 2Z" fill="#e8d9a0"/></g>
</g></svg>`;}
