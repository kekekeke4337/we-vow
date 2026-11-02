// Independently authored generic kneeling body, used only for height matching.
export const kneelingBodySource={file:'assets/generic/clothing-kneeling-v1.png',columns:2,rows:4};
export const loweredAnimalSources={};
export const loweredDedicatedSources={};

export function lowerSourceForPartner(source,partner){
 if((partner.heightScale??1)>=.9||(source.heightScale??1)<.9||source.kind!=='generic')return null;
 const copy=structuredClone(source);delete copy.linkRoles;
 copy.rig.bodyPose='kneel-v1';copy.rig.sources.kneelingBody=structuredClone(kneelingBodySource);
 if(copy.rig.duoAnatomy==='balanced-duo-v1')copy.rig.kneelingHeight=(partner.heightScale??1)>=.75?128:112;
 return copy;
}
