/**
 * EVERY DOG HAS A HOME.
 *
 * Seven rooms drawn in the park's pen: flat fills, ink hairlines, the
 * household's pigments. Each is two pieces: the wall, which ends at the
 * seam behind his feet, and the floor he stands on.
 *
 * He is big on the stage, so each room is laid out on a 400-wide frame around
 * him: something high on the wall above his back, furniture at his sides,
 * partly behind him as in any room. Wider screens see more of the room.
 *
 * Heaven is a place in the sky, not a death: nobody dies in this game.
 */
export type HomeId='house'|'farm'|'apartment'|'studio'|'school'|'office'|'heaven';
export const HOMES:{id:HomeId;label:string}[]=[
  {id:'house',label:'House'},{id:'farm',label:'Farm'},{id:'apartment',label:'Apartment'},
  {id:'studio',label:'Small apartment'},{id:'school',label:'School'},{id:'office',label:'Office'},{id:'heaven',label:'Heaven'},
];
export const isHome=(v:unknown):v is HomeId=>HOMES.some(h=>h.id===v);

const INK='#614c37', LINE='stroke="#614c37" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const svg=(box:string,align:string,body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="${box}" preserveAspectRatio="${align}">${body}</svg>`;
// The wall's bottom edge (y=0) is the seam; the floor's top edge (y=0) is the same seam.
const wall=(fill:string,body:string)=>svg('-200 -260 400 260','xMidYMax meet',`<rect x="-4000" y="-4000" width="8000" height="4000" fill="${fill}"/>${body}`);
const floor=(fill:string,body:string)=>svg('-200 0 400 120','xMidYMin slice',`<rect x="-4000" y="0" width="8000" height="4000" fill="${fill}"/><path d="M-4000 1H4000" stroke="${INK}" stroke-width="2"/>${body}`);
const lines=(n:number,f:(i:number)=>string)=>Array.from({length:n},(_,i)=>f(i)).join('');
const tree=(x:number,y:number,s:number)=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M-13 63Q-4 5-16-60H18Q4 6 16 63Z" fill="#77624e" stroke="${INK}" stroke-width="2"/><path d="M-83-55C-113-95-62-144-27-132C-2-169 47-154 55-126C105-134 121-76 92-57C105-20 49-4 26-20C-12 6-60-9-63-30C-89-24-102-42-83-55Z" fill="#386344" stroke="#294434" stroke-width="2"/><path d="M-65-79Q-35-125 4-104M24-124q43-5 55 37" fill="none" stroke="#526449" stroke-width="7"/></g>`;
const plant=(x:number,s=1)=>`<g transform="translate(${x} 0) scale(${s})"><path d="M-20-44H20L15 0H-15Z" fill="#c27a52" ${LINE}/><path d="M0-44C-4-84-36-96-44-86C-28-82-13-66-4-46M2-44C6-88 31-110 42-99C27-92 13-73 5-46M0-46C0-92 4-118 11-126" fill="none" stroke="#386344" stroke-width="6"/></g>`;
const pane=(x:number,y:number,w:number,h:number,frame:string)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#deebed" stroke="${frame}" stroke-width="6"/><path d="M${x+w/2} ${y}V${y+h}M${x} ${y+h/2}H${x+w}" stroke="${frame}" stroke-width="4"/><path d="M${x+10} ${y+h*.32}l16-16M${x+w/2+10} ${y+h*.82}l13-13" stroke="#fbfaee" stroke-width="3"/>`;
const skirting=(fill:string)=>`<path d="M-4000-10H4000V0H-4000Z" fill="${fill}" stroke="${INK}" stroke-width="2"/>`;

const SCENES:Record<HomeId,{wall:string;floor:string}>={
  house:{
    wall:wall('#f1e7d2',`${pane(-160,-240,104,96,'#845a2f')}<path d="M-176-246C-160-210-164-176-182-136H-158C-148-176-150-210-160-246ZM-40-246C-56-210-52-176-34-136H-58C-68-176-66-210-56-246Z" fill="#bbc6a9" stroke="#526449" stroke-width="2"/><path d="M-188-248H-28" stroke="${INK}" stroke-width="4"/>
<rect x="74" y="-236" width="74" height="54" fill="#fbfaee" stroke="#845a2f" stroke-width="5"/><path d="M78-196Q98-220 116-204T144-210V-186H78Z" fill="#bbc6a9"/><circle cx="130" cy="-218" r="5" fill="#e2c47c"/>
<path d="M96-76Q96-94 114-94H226V-34H96Z" fill="#a9b994" ${LINE}/><path d="M84-48H240V-8H84Z" fill="#bbc6a9" ${LINE}/><path d="M84-56Q74-56 74-46V-4H100V-46Q100-56 90-56Z" fill="#a9b994" ${LINE}/><path d="M118-80H154V-52H118Z" fill="#e2c47c" ${LINE} transform="rotate(-8 136 -66)"/><path d="M90-4V2" ${LINE}/>
<path d="M-196-112V-4M-214-4H-178M-196-112Q-218-112-222-136H-170Q-174-112-196-112Z" fill="#e2c47c" ${LINE}/>${skirting('#eadbc0')}`),
    floor:floor('#d9bf95',`${lines(5,i=>`<path d="M-4000 ${16+i*22}H4000" stroke="#c4a676" stroke-width="2"/>`)}${lines(12,i=>`<path d="M${-260+i*46+(i%2)*21} ${16+(i%5)*22}v22" stroke="#c4a676" stroke-width="2"/>`)}<ellipse cx="0" cy="50" rx="150" ry="26" fill="#bbc6a9" stroke="#a9b994" stroke-width="3"/>`),
  },
  farm:{
    wall:wall('#e6eff0',`<circle cx="30" cy="-226" r="16" fill="#f2df9e"/><path d="M-4000-50C-300-120-160-70-20-96S220-130 4000-60V0H-4000Z" fill="#c8d4b4"/><path d="M-4000-24C-260-64-120-30 40-56S260-70 4000-30V0H-4000Z" fill="#bbc6a9"/>
<path d="M-224-130L-148-180L-72-130V0H-224Z" fill="#a8553a" ${LINE}/><path d="M-234-122L-148-190L-62-122" fill="none" stroke="${INK}" stroke-width="7"/><rect x="-178" y="-70" width="60" height="70" fill="#8e4630" ${LINE}/><path d="M-178-70L-118 0M-118-70L-178 0" stroke="#fbfaee" stroke-width="4"/><rect x="-158" y="-152" width="22" height="22" fill="#fbfaee" ${LINE}/>
${tree(170,-126,.75)}<path d="M80-44H4000M80-24H4000" stroke="#845a2f" stroke-width="6"/>${lines(4,i=>`<path d="M${92+i*48}-58V0" stroke="#77624e" stroke-width="7"/>`)}
<path d="M-70-44H0V0H-70Z" fill="#e2c47c" ${LINE}/><path d="M-70-29H0M-70-14H0" stroke="#c9a85a" stroke-width="2.5"/>`),
    floor:floor('#cfdcbc',`<path d="M-110 0C-90 50-40 76 10 120H140C90 76 50 40 34 0Z" fill="#e2d3b0"/>${lines(16,i=>`<path d="M${-280+i*36} ${24+(i*37)%80}l-4-6m4 6l4-7" stroke="#a9b994" stroke-width="2.5" fill="none"/>`)}`),
  },
  apartment:{
    wall:wall('#eceae2',`<rect x="-196" y="-250" width="170" height="168" fill="#deebed" stroke="#4f5550" stroke-width="6"/>
<path d="M-193-85V-150h20v-24h18v-34h16v50h20v-26h22v72h18v-90h20v34h18v56h12V-85Z" fill="#b3c4c5"/>${lines(8,i=>`<rect x="${-186+(i%4)*40}" y="${-140+Math.floor(i/4)*24}" width="6" height="8" fill="#fbfaee"/>`)}<path d="M-111-250V-82M-196-166H-26" stroke="#4f5550" stroke-width="4"/>
<path d="M70-192H180M70-142H180" stroke="#845a2f" stroke-width="5"/>${lines(6,i=>`<rect x="${78+i*14}" y="${-192-22-(i%3)*5}" width="11" height="${22+(i%3)*5}" fill="${['#386344','#c27a52','#e2c47c','#526449'][i%4]}" stroke="${INK}" stroke-width="1.5"/>`)}<circle cx="162" cy="-154" r="10" fill="#c27a52" ${LINE}/>
${plant(120)}<path d="M184 0V-170M168 0H200M184-170Q168-170 164-196H204Q200-170 184-170Z" ${LINE} fill="#e2c47c"/>${skirting('#e0ddd2')}`),
    floor:floor('#cdb894',`${lines(6,i=>`<path d="M-4000 ${12+i*19}H4000" stroke="#bba57d" stroke-width="1.6"/>`)}`),
  },
  studio:{
    wall:wall('#e7e1d3',`${pane(-150,-236,72,72,'#845a2f')}
<path d="M-214-96H-70V-58H-214Z" fill="#845a2f" ${LINE}/><path d="M-214-58H-56V-18H-214Z" fill="#fbfaee" ${LINE}/><path d="M-160-58H-56V-18H-160Z" fill="#bbc6a9" ${LINE}/><path d="M-206-74Q-206-84-196-84H-170Q-160-84-160-74V-60H-206Z" fill="#fbfaee" ${LINE}/><path d="M-62-18V0" ${LINE}/>
<path d="M80-72H230V0H80Z" fill="#eadbc0" ${LINE}/><path d="M74-80H236V-70H74Z" fill="#77624e" ${LINE}/><path d="M140-70V0" ${LINE}/><circle cx="130" cy="-36" r="3" fill="${INK}"/><circle cx="150" cy="-36" r="3" fill="${INK}"/>
<path d="M190-80V-92H220V-80" fill="#526449" ${LINE}/><path d="M100-80Q100-102 118-102T136-80Z" fill="#c27a52" ${LINE}/><path d="M136-94q8 0 8 7" fill="none" ${LINE}/><path d="M80-170H200" stroke="#845a2f" stroke-width="5"/>${lines(4,i=>`<path d="M${92+i*28}-170v-17h18v17" fill="${['#fbfaee','#e2c47c','#bbc6a9','#c27a52'][i]}" ${LINE}/>`)}`),
    floor:floor('#d8d4c8',`${lines(5,i=>`<path d="M-4000 ${20+i*24}H4000" stroke="#c3beb0" stroke-width="2"/>`)}${lines(24,i=>`<path d="M${-288+i*24} 0V120" stroke="#c3beb0" stroke-width="2"/>`)}`),
  },
  school:{
    wall:wall('#ece6cf',`<path d="M-4000-66H4000V0H-4000Z" fill="#bbc6a9" stroke="${INK}" stroke-width="2"/><path d="M-4000-66H4000" stroke="#77624e" stroke-width="5"/>
<rect x="-176" y="-250" width="196" height="116" fill="#2f4a3a" stroke="#845a2f" stroke-width="7"/><text x="-78" y="-200" text-anchor="middle" fill="#fbfaee" style="font-family:var(--font-body,sans-serif);font-size:19px">Sit · Down · Paw</text><path d="M-140-174q24-8 46 0t46 0" fill="none" stroke="#fbfaee" stroke-width="2.5"/><path d="M-24-138h26" stroke="#fbfaee" stroke-width="5"/>
<circle cx="140" cy="-212" r="24" fill="#fbfaee" ${LINE}/><path d="M140-212V-228M140-212l11 6" ${LINE}/>
<path d="M90-54H220V-44H90Z" fill="#845a2f" ${LINE}/><path d="M102-44V0M208-44V0M102-18H208" ${LINE}/><circle cx="196" cy="-63" r="9" fill="#a8553a" ${LINE}/><path d="M196-72q2-6 6-8" ${LINE} fill="none"/><path d="M114-66H160V-54H114Z" fill="#e2c47c" ${LINE}/>`),
    floor:floor('#d6cfb6',`${lines(12,i=>`<rect x="${-300+i*60}" y="${(i%2)*60}" width="30" height="60" fill="#cbc3a8"/>`)}${lines(12,i=>`<rect x="${-270+i*60}" y="${60-(i%2)*60}" width="30" height="60" fill="#cbc3a8"/>`)}`),
  },
  office:{
    wall:wall('#e3e6e0',`<rect x="40" y="-250" width="150" height="120" fill="#deebed" stroke="#4f5550" stroke-width="5"/>${lines(9,i=>`<path d="M43 ${-242+i*13}H187" stroke="#c3cccb" stroke-width="6"/>`)}<path d="M180-250V-150" stroke="#4f5550" stroke-width="2"/>
<rect x="-180" y="-240" width="90" height="64" fill="#eadbc0" stroke="#845a2f" stroke-width="4"/>${lines(4,i=>`<rect x="${-172+(i%2)*42}" y="${-233+Math.floor(i/2)*29}" width="30" height="23" fill="${['#e2c47c','#bbc6a9','#fbfaee','#e2c47c'][i]}" transform="rotate(${i%2?4:-5} ${-157+(i%2)*42} ${-221+Math.floor(i/2)*29})" ${LINE}/>`)}
<path d="M-240-64H-70V-54H-240Z" fill="#77624e" ${LINE}/><path d="M-82-54V0M-160-54V0" ${LINE} fill="none"/><path d="M-200-64L-194-98H-138L-132-64Z" fill="#4f5550" ${LINE}/><path d="M-112-64V-80Q-112-86-106-86H-90Q-84-86-84-80V-64Z" fill="#fbfaee" ${LINE}/>
<path d="M-62-104H-36V-48H-62Z" fill="#526449" ${LINE}/><path d="M-66-48H-32V-40H-66ZM-49-40V-10M-68 0L-49-10L-30 0" ${LINE} fill="#526449"/>${plant(170,.9)}`),
    floor:floor('#c5cbc4',`${lines(40,i=>`<circle cx="${-290+(i*97)%580}" cy="${10+(i*53)%104}" r="1.8" fill="#b1b8b0"/>`)}`),
  },
  heaven:{
    wall:wall('#eef3f6',`${[[-150,-196,.9],[140,-226,.75],[-20,-246,.5],[180,-110,.6],[-190,-80,.65]].map(([x,y,s])=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M-70 20C-96 20-98-12-72-14C-74-40-40-50-24-32C-14-58 30-58 38-30C62-42 90-20 76 4C96 8 92 20 74 20Z" fill="#fbfaee" stroke="#d6e0e6" stroke-width="3"/></g>`).join('')}
${[[-80,-230],[70,-250],[110,-160],[-150,-126],[40,-190]].map(([x,y])=>`<path d="M${x} ${y-8}L${x+2.5} ${y-2.5}L${x+8} ${y}L${x+2.5} ${y+2.5}L${x} ${y+8}L${x-2.5} ${y+2.5}L${x-8} ${y}L${x-2.5} ${y-2.5}Z" fill="#e2c47c"/>`).join('')}
<path d="M-176 0V-120M-112 0V-120M-176-120Q-144-160-112-120" fill="none" stroke="#e2c47c" stroke-width="4"/>${lines(4,i=>`<path d="M${-168+i*16} 0V-110" stroke="#e2c47c" stroke-width="2"/>`)}`),
    floor:floor('#fbfaee',`<path d="M-4000 1H4000" stroke="#fbfaee" stroke-width="4"/>${lines(16,i=>`<path d="M${-320+i*40} 4q20-18 40 0" fill="#fbfaee" stroke="#d6e0e6" stroke-width="2.5"/>`)}${lines(8,i=>`<path d="M${-260+i*70} ${46+(i%2)*26}q16-10 32 0" fill="none" stroke="#d6e0e6" stroke-width="2.5"/>`)}`),
  },
};
// Inline SVG inherits the selected dog's palette. Keep wood, plants and sky
// material colors; wall, upholstery and cushions carry the companion's identity.
export const homeScene=(id:HomeId)=>{
 const scene=SCENES[id];
 const dress=(art:string)=>art.replaceAll('#f1e7d2','var(--home-wall, #f1e7d2)').replaceAll('#bbc6a9','var(--home-cloth, #bbc6a9)').replaceAll('#a9b994','var(--home-cloth, #a9b994)').replaceAll('#e2c47c','var(--home-cushion, #e2c47c)');
 return {wall:dress(scene.wall),floor:dress(scene.floor)};
};
