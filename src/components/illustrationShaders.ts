export const VERTEX = `
  varying vec2 vUv;
  uniform float time, reduced, blink;
  uniform float wagT;
  uniform vec2 morphFrom[8],morphTo[8];
  uniform float morphAmount;
  uniform vec2 profile;
  uniform vec4 motion, more, temperament, fun, lifeAct;
  uniform vec2 gaze, headPivot, tailPivot;
  uniform vec4 feet, eyes;
  uniform float legStart, resting, settling, puppy;
  float band(float x,float c,float r){return 1.-smoothstep(r*.45,r,abs(x-c));}
  vec2 turn(vec2 p,vec2 pivot,float a){float s=sin(a),c=cos(a);return pivot+mat2(c,-s,s,c)*(p-pivot);}
  void main(){
    vUv=uv;
    vec2 original=vec2(uv.x,1.-uv.y),p=original;
    // The face moves as one region; blend only through the neck, below the jaw.
    float head=(1.-smoothstep(headPivot.y+.08,headPivot.y+.18,p.y))*(1.-smoothstep(headPivot.x+.08,headPivot.x+.18,p.x));
    float torso=smoothstep(.29,.45,p.y)*(1.-smoothstep(.64,.80,p.y));
    float legs=smoothstep(legStart,legStart+.14,p.y);
    float nearFront=band(p.x,feet.x,.05)*legs;
    float farFront=band(p.x,feet.y,.045)*legs;
    float farBack=band(p.x,feet.w,.05)*legs;
    float nearBack=band(p.x,feet.z,.05)*legs;
    float phase=time*7.*fun.w;
    float walk=motion.y*(1.-reduced)*(1.-resting);
    p.x+=walk*.018*(nearFront*sin(phase)+farFront*sin(phase+3.14159)+nearBack*sin(phase+3.14159)+farBack*sin(phase));
    p.y-=walk*.016*(nearFront*max(0.,sin(phase))+farFront*max(0.,sin(phase+3.14159))+nearBack*max(0.,sin(phase+3.14159))+farBack*max(0.,sin(phase)));
    float breathPhase=time*(1.4+temperament.y)*(1.-temperament.z*.35);
    float bodyBreath=(sin(breathPhase)+.16*sin(breathPhase*.53))*(.004-temperament.z*.002)*(1.-reduced);
    // The ribs expand while planted feet stay put; the head follows a beat later.
    p.x+=bodyBreath*(original.x-.47)*1.8*torso*(1.-legs)*(1.-head);
    float eyeA=band(original.x,eyes.x,.028)*band(original.y,eyes.y,.024);
    float eyeB=band(original.x,eyes.z,.026)*band(original.y,eyes.w,.023);
    p.y-=blink*.88*((original.y-eyes.y)*eyeA+(original.y-eyes.w)*eyeB);
    p.x+=fun.x*sin(time*11.*fun.w)*.009*torso*(1.-head)*(1.-reduced);
    p.y+=(bodyBreath+walk*abs(sin(phase))*.008)*torso*(1.-legs);
    p.x+=more.z*sin(time*27.)*.0025*(torso+head)*(1.-reduced);
    p.x=.47+(p.x-.47)*profile.x;
    p.y+=profile.y*(.91-p.y)*.16*(1.-head);
    // Sitting and resting anatomy comes from authored poses, not a flattened standing skin.
    p.y+=(settling*.028)*torso;

    float bow=motion.w*.035*(1.-reduced);
    p.y+=bow*head;
    // Blink only at the eyes above; a broad lid band would tug the cheeks.
    float angle=fun.z*.13*sin(time*2.4)* (1.-reduced)+fun.x*.025*sin(time*8.*fun.w)*(1.-reduced)+temperament.w*sin(time*1.7)*.018*(1.-reduced)+motion.x*-.075+more.y*sin(time*1.5)*.07+gaze.x*.05+more.x*sin(time*19.)*.055;
    vec2 headPosition=turn(headPivot+(p-headPivot)*(1.+puppy*.10),headPivot,angle);
    // A real dog nods at stride frequency — the head leads each forepaw's landing.
    headPosition.y+=sin(breathPhase-.45)*.0018*(1.-reduced)*(1.-resting);
    headPosition+=vec2(motion.x*.012+walk*.003*sin(phase+1.5708),more.z*.012+temperament.z*.015+walk*.006*(abs(sin(phase))-.5));
    p=mix(p,headPosition,head);
    float muzzle=band(original.x,headPivot.x-.12,.095)*band(original.y,headPivot.y-.015,.06);
    p.y+=motion.z*abs(sin(time*16.))*.007*muzzle;
    // Sniffing is a fast nose quiver, not only a slow sway of the whole head.
    p.x+=more.y*sin(time*24.)*.0016*muzzle*(1.-reduced);
    p.y+=lifeAct.x*.026*muzzle*(1.-reduced);
    float ears=band(original.y,.13,.10)*head;
    p.x+=lifeAct.y*sin(time*17.)*.012*ears*(1.-reduced);
    p.x+=lifeAct.z*sin(time*18.)*.018*nearBack*(1.-reduced);
    p.x+=lifeAct.w*sin(time*19.)*.008*torso*(1.-reduced);
    float tail=band(original.x,tailPivot.x,.105)*band(original.y,tailPivot.y,.12);
    vec2 tailPosition=turn(p,tailPivot+vec2(-.035,.065),sin(time*wagT)*(.012+temperament.x*.024+temperament.y*.025+motion.x*.11+motion.w*.08+fun.x*.07)*(1.-temperament.z*.65)*(1.-reduced)*(1.-resting));
    p=mix(p,tailPosition,tail);
    if(morphAmount>.001){
      vec2 shift=vec2(0.);float total=0.;
      for(int i=0;i<8;i++){float d=distance(original,morphFrom[i]);float w=1./(d*d*d*d+.00008);shift+=(morphTo[i]-morphFrom[i])*w;total+=w;}
      // Different drawings must not pull the eyes and muzzle apart. Translate
      // the complete face by its eye-center delta; bound the body's residual.
      vec2 faceShift=((morphTo[0]+morphTo[1])-(morphFrom[0]+morphFrom[1]))*.5;
      vec2 bodyShift=clamp(shift/max(total,.001),vec2(-.035),vec2(.035));
      p+=mix(bodyShift,faceShift,head)*morphAmount;
    }
    gl_Position=projectionMatrix*modelViewMatrix*vec4((p.x-.5)*2.,(.5-p.y)*2.,0.,1.);
  }
`;
export const FRAGMENT = `varying vec2 vUv; uniform sampler2D art;uniform float opacity;
 void main(){gl_FragColor=texture2D(art,vUv);gl_FragColor.a*=opacity;if(gl_FragColor.a<.02)discard;
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
