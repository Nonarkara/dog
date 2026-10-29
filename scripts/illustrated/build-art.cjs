// Rebuild the committed runtime art from the reviewed source sheets.
// Run from the repository root, with sharp installed in the authoring environment.
const {execFileSync}=require('node:child_process');
const names=['expo','mali','oreo','paolo','hachiku'];
const sheets={
 bow:[[0,0,430,620],[430,0,425,620],[855,0,399,620],[0,630,430,624],[430,630,480,624]],
 pet:[[0,0,478,615],[478,0,400,615],[878,0,376,615],[0,620,475,634],[475,615,440,639]],
 feed:[[0,0,530,512],[530,0,510,512],[1040,0,496,512],[0,512,532,512],[532,512,530,512]],
 paw:[[0,0,565,520],[545,0,505,520],[1050,0,486,520],[0,525,555,499],[560,515,540,509]],
 sit:[[0,0,565,520],[565,0,485,520],[1050,0,486,520],[0,525,555,499],[570,520,530,504]],
 down:[[0,0,545,510],[545,0,505,510],[1050,0,486,512],[0,520,570,504],[555,515,555,509]],
 sleep:[[0,0,510,512],[510,0,535,512],[1045,0,491,512],[0,512,512,512],[512,512,550,512]],
};
function prepare(source,output,crop){execFileSync(process.execPath,['scripts/illustrated/prepare-art.cjs',source,`public/dogs/${output}.webp`,...(crop===undefined?[]:[String(crop)])],{stdio:'inherit'});}
for(const[name,q]of [['expo',0],['mali',1],['oreo',2]])prepare('design/reference/household-illustrations.png',name,q);
prepare('design/reference/paolo/illustrated-final.png','paolo');
for(const[pose,rects]of Object.entries(sheets))for(const[i,name]of names.entries())prepare(`design/reference/household-${pose}.png`,`${name}-${pose}`,rects[i].join(','));

prepare("design/reference/expo-bolster-sheet.png","expo-sleep","0,0,510,512");

prepare("design/reference/household-illustrations.png","hachiku","628,600,626,654");
