export type BodyPose='stand'|'sit'|'down'|'paw'|'sleep';
export type AvatarPose=BodyPose|'stay'|'wait'|'come'|'leaveIt'|'fetch'|'reward';
export interface PoseRequest {id:number;pose:AvatarPose}
export type PerformPose=(pose:AvatarPose)=>Promise<number|null>;
export interface PerformanceProps {
  poseRequest?:PoseRequest|null;
  onPoseComplete?:(id:number,at:number)=>void;
}
export function bodyPoseFor(pose:AvatarPose):BodyPose {
  return pose==='stay'||pose==='wait'?'sit':pose==='reward'?'down':pose==='come'||pose==='fetch'||pose==='leaveIt'?'stand':pose;
}
/** Bounded, authored movement on the existing skin; no new bitmap frames. */
export function trainingMotion(pose:AvatarPose,elapsed:number,reduced=false){
  const duration=pose==='stay'||pose==='wait'?1000:pose==='come'?1000:pose==='fetch'?1800:pose==='leaveIt'?900:0;
  const u=duration?Math.max(0,Math.min(1,elapsed/duration)):1;
  const finished=reduced&&pose!=='stay'&&pose!=='wait'?true:u===1;
  const move=reduced?0:u;
  return {done:finished,
    x:pose==='fetch'&&!reduced?Math.sin(move*Math.PI)*.65:0,
    scale:pose==='come'&&!reduced?.84+.18*(move*move*(3-2*move)):1,
    facing:pose==='fetch'&&!reduced&&move<.5?-1:1,
    run:pose==='fetch'&&!reduced&&!finished?1:0,
    gaze:pose==='leaveIt'&&!reduced?(move<.3?-.4:.7):0,
    toy:pose==='fetch'||pose==='leaveIt'||pose==='wait',
    carrying:pose==='fetch'&&u>=.5};
}
