import {sampleWalk} from './walkways.js';
export const facingDirections=['down','left','up','right'];
export function resolveFacing(guest,now){const sample=sampleWalk(guest.motion,now,[guest.x,guest.y]);return sample.moving?sample.direction:facingDirections.includes(guest.facing)?guest.facing:sample.direction;}
export function createFacingTracker(holdMs=70){
 const entries=new Map();
 return (guest,now,sample=sampleWalk(guest.motion,now,[guest.x,guest.y]))=>{
  if(!sample.moving){entries.delete(guest.id);return facingDirections.includes(guest.facing)?guest.facing:sample.direction;}
  let entry=entries.get(guest.id);if(!entry||entry.motion!==guest.motion.id){entry={motion:guest.motion.id,direction:sample.direction};entries.set(guest.id,entry);}
  if(sample.direction===entry.direction){entry.pending=null;return entry.direction;}
  if(entry.pending!==sample.direction){entry.pending=sample.direction;entry.at=now;}
  if(now-entry.at>=holdMs){entry.direction=sample.direction;entry.pending=null;}
  return entry.direction;
 };
}
