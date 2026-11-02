// Public template: every participant is rendered from the reusable generic rig.
import {freezeGenericArt} from './generic-art-manifest.js';
export {photoProps} from './photo-prop-manifest.js';

export const photoArtVersion='photo-generic-v1';
export const photoPoseColumns={stand:0,wave:1,cheer:2};
export const photoAtlases={};
export function photoArtKey(){return null;}
export function describePhotoArt(){return null;}
export function freezePhotoArt(person){return freezeGenericArt(person);}
