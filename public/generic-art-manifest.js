import {validateAvatar} from './avatar-options.js';
import {genericPalettes} from './generic-palette.js';
import {photoProps} from './photo-prop-manifest.js';
export const genericRigVersion='generic-rig-v1';
export const genericFaceRule='natural-face-v2',genericHairRegistration='scalp-fit-v2';
export const genericRigSources={body:{file:'assets/generic/clothing-bodies-v2.png',columns:4,rows:4},head:{file:'assets/generic/species-heads-v2.png',columns:4,rows:5},hair:{file:'assets/generic/hair-v3.png',columns:4,rows:4},arms:{file:'assets/generic/arms-v3.png',columns:4,rows:4},accessories:{file:'assets/generic/accessories-v1.png',columns:4,rows:4},gripArms:{file:'assets/generic/arms-grip-v1.png',columns:4,rows:4}};
export const genericGripPoints=[[.86,.92],[.83,.92],[.80,.91],[.80,.78]];
export function genericAppearance(person){
 if(person.character?.custom)return null;
 const avatar=person.character?.avatar||person.avatar||{};
 return validateAvatar(avatar);
}
export function freezeGenericArt(person){
 const avatar=genericAppearance(person);if(!avatar)return null;
 return structuredClone({kind:'generic',version:genericRigVersion,faceRule:genericFaceRule,hairRegistration:genericHairRegistration,avatar,sources:genericRigSources,gripPoints:genericGripPoints,paletteRGB:genericPalettes[avatar.palette],paletteRule:'cloth-tint-v1',props:person.prop&&person.prop!=='none'?photoProps:null});
}
