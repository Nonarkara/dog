export type Trick='highfive'|'bow'|'wiggle'|'zoomies'|'tilt'|'come'|'turn';
export interface PlayPersonality {pace:number;bounce:number;wag:number;greeting:string;idle:Trick;}
export const PLAY_PERSONALITIES:Record<string,PlayPersonality>={
 'expo-2021':{pace:.85,bounce:.75,wag:.85,greeting:'A very dignified wiggle.',idle:'tilt'},
 'mali-2022':{pace:.95,bounce:.8,wag:1.1,greeting:'A whole-body happy wiggle!',idle:'wiggle'},
 'oreo-frenchie':{pace:1.25,bounce:1.25,wag:1.15,greeting:'Again! Again!',idle:'bow'},
 'paolo-pug':{pace:.72,bounce:.65,wag:.8,greeting:'Worth waking up for.',idle:'tilt'},
 'shiba-chai':{pace:.9,bounce:.85,wag:1,greeting:'Right here with you.',idle:'highfive'},
};
