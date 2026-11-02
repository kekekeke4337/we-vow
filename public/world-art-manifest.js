import {freezeGenericArt} from './generic-art-manifest.js';

export const directionArtVersion='direction-generic-v1';
export const directionalSources={};
export function directionalLayout(){return {columns:4,rows:1};}
export function directionalScale(){return 1;}
export function freezeWorldArt(person){return freezeGenericArt(person);}
