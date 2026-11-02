// Complementary generic arm poses; no identity-specific artwork is shipped.
export const takingArmSource={file:'assets/generic/arms-link-taking-v1.png',columns:2,rows:4};
export const linLinkRoles={};
export const dedicatedTakingSources={};
export function independentLinkRoles(){return null;}
export function linkRoleForSide(side){
 if(!['left','right'].includes(side))throw Error('未知挽手朝向');
 return side==='right'?'offer':'take';
}
