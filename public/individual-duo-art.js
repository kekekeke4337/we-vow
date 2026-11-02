import {freezeGenericArt} from './generic-art-manifest.js';
import {takingArmSource} from './link-role-art.js';

export const individualDuoVersion='duo-generic-v1';
export const genericDuoSources={kissHead:{file:'assets/generic/species-kiss-heads-v3.png',columns:2,rows:5},linkArms:{file:'assets/generic/arms-link-v1.png',columns:2,rows:4}};
export const individualDuoAtlases={};

export function individualDuoSource(person,pose){
 const generic=freezeGenericArt(person);if(!generic)return null;
 return structuredClone({kind:'generic',rig:{...generic,duoAnatomy:'balanced-duo-v1',duoRegistration:'compact-link-v2',...(pose==='kiss'?{kissRegistration:'aspect-jaw-v1',duoJointRule:'neck-tilt-v1'}:{duoJointRule:'shoulder-reach-v1'}),sources:{...generic.sources,...genericDuoSources,...(pose==='arm_in_arm'?{linkTakingArms:takingArmSource}:{})}},...(pose==='arm_in_arm'?{linkRoles:true}:{}),frameRule:'tight-alpha-v1',pose});
}
export function duoSides(people,positions={}){
 if(people.length!==2)throw Error('双人动作必须指定两位参与者');
 const sorted=people.map((person,index)=>({id:person.id,x:positions[person.id]?.x??(.5+(index-.5)*.215)})).sort((a,b)=>a.x-b.x||a.id.localeCompare(b.id));
 return Object.fromEntries(sorted.map((person,index)=>[person.id,index?'left':'right']));
}
export function duoPairSeparation(){return 0;}
