/** Scene pigments reuse the household's credited Wada colors, not UI accents.
 * Forest guardian294: lawn/leaf/ink; Lemon explorer60: water; Biscuit dreamer11: timber. */
export function parkScenery(){return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="park-scenery" viewBox="-200 -300 400 600">
<defs>
 <pattern id="lawn" width="173" height="137" patternUnits="userSpaceOnUse"><path d="M19 31l-3-5m3 5l4-6M121 102l-4-5m4 5l4-5M85 45l-2-4" fill="none" stroke="#bbc6a9" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="44" cy="112" rx="2" ry="1.4" fill="#fbfaee"/></pattern>
</defs>
<rect x="-5000" y="-5000" width="10000" height="10000" fill="#e1e9d5"/>
<rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#lawn)"/>
<g class="park-landmarks" stroke-linecap="round" stroke-linejoin="round">
 <path d="M-850 250C-500 330-240-190-65-145S150 170 440 95S700-110 900-20" stroke="#bbc6a9" stroke-width="91" fill="none"/>
 <path d="M-850 250C-500 330-240-190-65-145S150 170 440 95S700-110 900-20" stroke="#fbfaee" stroke-width="87" fill="none"/>
 <path d="M-520-278Q0-335 520-278" fill="none" stroke="#77624e" stroke-width="5"/>
 ${Array.from({length:19},(_,i)=>{const x=-504+i*56,y=-278-52*Math.sin((i/18)*Math.PI);return `<path d="M${x} ${y-15}v39" stroke="#77624e" stroke-width="4"/>`;}).join('')}
 <path d="M-341 10C-391 54-366 163-285 176S-169 138-185 67S-271-34-341 10Z" fill="#bbc6a9"/>
 <path d="M-338 17C-379 55-357 152-285 164S-182 132-196 70S-275-21-338 17Z" fill="#deebed" stroke="#b3c4c5" stroke-width="3"/>
 <path d="M-337 75q24 9 45 0m-30 48q30 9 63-1m-2-77q16 6 28 0" fill="none" stroke="#fbfaee" stroke-width="3"/>
 <g transform="translate(125 -222) rotate(-7)"><ellipse cy="41" rx="78" ry="13" fill="#bbc6a9"/><path d="M-50 8l-4 37M50 8l4 37" stroke="#614c37" stroke-width="8"/><path d="M-68-24H68M-68-5H68M-68 16H68" stroke="#845a2f" stroke-width="15"/><path d="M-66-26H65M-66-7H65M-66 14H65" stroke="#eadbc0" stroke-width="2"/></g>
 ${[[-270,-210,.9],[310,-75,1.15],[-315,320,1.05],[280,370,.85]].map(([x,y,s])=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="65" rx="90" ry="20" fill="#bbc6a9"/><path d="M-13 63Q-4 5-16-60H18Q4 6 16 63Z" fill="#77624e" stroke="#614c37" stroke-width="2"/><path d="M-8 3L-43-38M8-5l29-37" stroke="#77624e" stroke-width="9"/><path d="M-83-55C-113-95-62-144-27-132C-2-169 47-154 55-126C105-134 121-76 92-57C105-20 49-4 26-20C-12 6-60-9-63-30C-89-24-102-42-83-55Z" fill="#386344" stroke="#294434" stroke-width="2"/><path d="M-65-79Q-35-125 4-104M24-124q43-5 55 37M-20-32q34 9 52-6" fill="none" stroke="#526449" stroke-width="7"/></g>`).join('')}
 <g transform="translate(66 225)"><ellipse rx="29" ry="11" fill="#bbc6a9"/><path d="M-25-6L-20 6Q0 15 20 6L25-6" fill="#77624e"/><ellipse cy="-6" rx="25" ry="9" fill="#deebed" stroke="#614c37" stroke-width="2"/><path d="M-12-7q13-6 24 0" fill="none" stroke="#fbfaee" stroke-width="2"/></g>
 <g transform="translate(30 -8) rotate(-15)"><circle r="10" fill="#bbc6a9" stroke="#526449"/><path d="M-8-5q13 2 13 13M-3-9q-1 11-6 12" fill="none" stroke="#fbfaee" stroke-width="2"/></g>
</g></svg>`;}
