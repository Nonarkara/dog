import type { AvatarPose } from './DogAvatar3D';
import {bodyPoseFor} from './trainingMotion';

export type ArtPose = 'stand' | 'sit' | 'down' | 'paw' | 'sleep' | 'feed' | 'pet' | 'bow' | 'sick';
export const artPoseFor = (pose: AvatarPose): ArtPose => pose==='reward'?'feed':bodyPoseFor(pose);

// Normalized, top-origin landmarks on the authored 768px canvases. These are
// illustration-specific, not breed anatomy inferred from one shared image.
export interface Landmarks {
  eyes: [number, number, number, number];
  feet: [number, number, number, number]; // near front, far front, near hind, far hind
  head: [number, number];
  tail: [number, number];
  legStart: number;
}
const STANDING: Record<string, Landmarks> = {
  'expo-2021': {eyes:[.29,.31,.208,.291],feet:[.446,.285,.79,.646],head:[.36,.40],tail:[.795,.30],legStart:.64},
  'mali-2022': {eyes:[.29,.305,.216,.281],feet:[.434,.276,.79,.664],head:[.36,.40],tail:[.795,.30],legStart:.66},
  'oreo-frenchie': {eyes:[.341,.327,.207,.31],feet:[.451,.278,.78,.647],head:[.36,.43],tail:[.803,.51],legStart:.66},
  'paolo-pug': {eyes:[.346,.387,.178,.338],feet:[.405,.235,.823,.655],head:[.36,.44],tail:[.782,.365],legStart:.69},
  'shiba-chai': {eyes:[.302,.257,.216,.24],feet:[.443,.287,.79,.658],head:[.37,.42],tail:[.797,.36],legStart:.65},
};
const SEATED: Record<string, Landmarks> = {
  'expo-2021': {eyes:[.33,.30,.249,.275],feet:[.433,.30,.69,.64],head:[.4,.39],tail:[.78,.70],legStart:.64},
  'mali-2022': {eyes:[.331,.33,.253,.30],feet:[.423,.28,.71,.64],head:[.4,.42],tail:[.79,.69],legStart:.65},
  'oreo-frenchie': {eyes:[.404,.35,.30,.325],feet:[.47,.32,.67,.6],head:[.44,.44],tail:[.76,.66],legStart:.66},
  'paolo-pug': {eyes:[.335,.39,.18,.346],feet:[.417,.24,.7,.6],head:[.4,.48],tail:[.8,.64],legStart:.7},
  'shiba-chai': {eyes:[.33,.3,.251,.28],feet:[.433,.3,.7,.64],head:[.4,.4],tail:[.79,.61],legStart:.65},
};
const PETTED:Record<string,Landmarks>={
 'expo-2021':{...STANDING['expo-2021'],eyes:[.351,.295,.27,.276],head:[.40,.40],feet:[.417,.283,.77,.623],tail:[.74,.34]},
 'mali-2022':{...STANDING['mali-2022'],eyes:[.338,.309,.242,.284],head:[.39,.42],feet:[.388,.255,.773,.61],tail:[.77,.36]},
 'oreo-frenchie':{...STANDING['oreo-frenchie'],eyes:[.375,.363,.234,.32],head:[.40,.44]},
 'paolo-pug':{...STANDING['paolo-pug'],eyes:[.346,.296,.206,.23],head:[.38,.4]},
 'shiba-chai':{...STANDING['shiba-chai'],eyes:[.352,.278,.275,.25],head:[.40,.40]},
};
export function landmarksFor(id: string, pose: ArtPose): Landmarks {
  if(pose==='bow'){const pug=id==='paolo-pug',french=id==='oreo-frenchie';return {eyes:pug?[.448,.523,.279,.445]:french?[.374,.546,.235,.509]:[.377,.482,.283,.447],feet:[.40,.20,.80,.64],head:pug?[.48,.66]:[.44,.60],tail:[.73,.24],legStart:.72};}
  if (pose === 'stand') return STANDING[id];
  if (pose === 'pet') return PETTED[id];
  if (pose === 'sit' || pose === 'paw') return SEATED[id];
  // Resting art has its own head/forepaw positions. Sleep has already-painted
  // closed eyes; its shader does not try to turn open eyes into a sleeping face.
  if(pose==='sick')return {eyes:[.33,.70,.21,.67],feet:[.33,.16,.78,.68],head:[.39,.76],tail:[.79,.61],legStart:.84};
  if(pose==='feed')return {eyes:id==='paolo-pug'?[.33,.72,.22,.7]:[.35,.71,.23,.7],feet:[.34,.15,.78,.68],head:[.4,.76],tail:[.79,.56],legStart:.84};
  const pug=id==='paolo-pug', french=id==='oreo-frenchie';
  return {eyes:pose==='sleep'?[.29,.76,.18,.73]:pug?[.345,.59,.225,.54]:french?[.35,.57,.22,.54]:[.33,.54,.245,.51],
    feet:[.33,.16,.78,.68],head:[.39,pose==='sleep'?.78:.64],tail:[.79,pose==='sleep'?.67:.58],legStart:.82};
}

// Registration anchors keep face, shoulders, hips and feet together while
// moving between authored poses. Every point has a semantic body-part role.
export function poseAnchors(id:string,pose:ArtPose){
 const r=landmarksFor(id,pose),rest=['down','sleep','feed','sick'].includes(pose);
 const hipY=rest?.74:pose==='sit'||pose==='paw'?.69:.58;
 return [newPoint(r.eyes[0],r.eyes[1]),newPoint(r.eyes[2],r.eyes[3]),newPoint(...r.head),newPoint(r.feet[0],.9),newPoint(pose==='paw'?.21:r.feet[1],pose==='paw'?.53:.88),newPoint(r.feet[2],pose==='bow'?.83:.89),newPoint(.7,hipY),newPoint(...r.tail)];
}
const newPoint=(x:number,y:number):[number,number]=>[x,y];
