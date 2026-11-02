export const duoArtVersion='duo-photo-v1';
import {lowerSourceForPartner} from './lowered-duo-art.js';
export const duoPoses={arm_in_arm:{name:'挽手',column:0},kiss:{name:'亲吻',column:1}};
export function supportedDuo(people,pose='kiss'){return people.length===2&&Object.hasOwn(duoPoses,pose)&&people.every(p=>individualDuoSource(p,pose));}
export function freezeDuoArt(people,pose){
 if(!supportedDuo(people,pose))throw Error('这组形象的双人动作素材尚未完成，仍可用各自单人动作合照');
 const subjects=people.map(person=>({id:person.id,source:individualDuoSource(person,pose)}));
 if(subjects.every(p=>p.source)){
  // Freeze the selected anatomical posture, not a future mutable catalog lookup.
  const original=subjects.map(p=>p.source);let lowered=false;
  for(let i=0;i<subjects.length;i++){const variant=lowerSourceForPartner(original[i],original[1-i]);if(variant){subjects[i].source=variant;lowered=true;}}
  const complementary=pose==='arm_in_arm'&&subjects.every(p=>p.source.linkRoles);
  // Upright humanoid kisses must not resize one whole body to make mouths meet.
  // Short animal sources still need genuinely lowered/reaching partner poses;
  // do not lift their feet off the floor by enabling this rule indiscriminately.
  const uprightKiss=pose==='kiss'&&subjects.every(p=>p.source.kind==='generic'||(p.source.heightScale??1)===1);
  const bothShort=subjects.every(p=>(p.source.heightScale??1)<.9);
  return {version:individualDuoVersion,pose,members:people.map(p=>p.id),subjects,...(subjects.some(p=>p.source.rig?.duoAnatomy==='balanced-duo-v1')?{groundingRule:'shared-floor-v1'}:{}),...(lowered?{postureRule:'lowered-partner-v1'}:{}),...(complementary?{linkRule:'complementary-link-v1'}:{}),...(complementary||uprightKiss||lowered||bothShort?{layoutRule:'natural-depth-v1'}:{})};
 }
 // Legacy duo-photo-v1 archives are still rendered by photo-duo.js, but new
 // requests never substitute the original couple's whole picture for a source.
 throw Error('这组形象的双人动作素材尚未完成，仍可用各自单人动作合照');
}
import {individualDuoVersion,individualDuoSource} from './individual-duo-art.js';
