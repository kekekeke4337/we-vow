export const ceremonyAtlas=null;
export const ceremonyPoses={rings:{label:'交换戒指'},kiss:{label:'亲吻'},embrace:{label:'拥抱与花开'}};
export function ceremonyPose(snapshot){return snapshot.phase.id==='rings'&&!snapshot.ringsDelivered?null:ceremonyPoses[snapshot.phase.id]||null;}
// Private identity art is intentionally absent from the public template.
export function installCeremonyArt(){return ()=>{};}
