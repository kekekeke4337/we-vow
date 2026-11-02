import {loadArtAtlas,drawProp} from './photo-art.js';
import {tintedClothFrame,genericPalettes} from './generic-palette.js';
import {photoProps} from './photo-prop-manifest.js';
import {genericRigVersion,genericRigSources,genericGripPoints,genericFaceRule,genericHairRegistration} from './generic-art-manifest.js';
import {registeredDuoContact} from './duo-contact.js';
import {rotateJointPoint} from './duo-joint.js';
import {hairCapRegistration,scalpTop} from './generic-face-registration.js';
export {genericRigVersion,genericRigSources,genericGripPoints} from './generic-art-manifest.js';
// Shared generated bitmap rig for world sprites, portraits and the workbench.
// Photograph snapshots and group-photo integration are tracked separately.
// Manually registered palm/handle points in the front-right arm's tight frame.
const clothes=['dress','suit','linen','robe'],species=['human','cat','fox','bird','android'],hairStyles=['short','bob','long','braid'],directions=['down','left','up','right'];
export async function prepareGenericRig(avatar,{prop='none',snapshot}={}){
 if(snapshot&&snapshot.version!==genericRigVersion)throw new Error('未知通用形象存档版本');
 if(snapshot?.paletteRule&&snapshot.paletteRule!=='cloth-tint-v1')throw new Error('未知通用配色存档版本');
 avatar=snapshot?.avatar||avatar;
 avatar=Object.freeze({species:avatar.species||'human',clothes:avatar.clothes||'suit',hair:avatar.hair||'short',accessory:avatar.accessory||'none',palette:avatar.palette||'sage'});
 if(!hairStyles.includes(avatar.hair)||!['none','ginkgo','moon','raven','bow'].includes(avatar.accessory)||!Object.hasOwn(genericPalettes,avatar.palette))throw new Error('未知通用形象组件');
 if(prop!=='none'&&!Object.hasOwn(photoProps.indices,prop))throw new Error('未知道具');
 const bodyIndex=clothes.indexOf(avatar.clothes),headIndex=species.indexOf(avatar.species);if(bodyIndex<0||headIndex<0)throw new Error('通用部件尚未登记');
 const entries=await Promise.all(Object.entries(snapshot?.sources||genericRigSources).filter(([key])=>key!=='gripArms'||prop!=='none').map(async([key,s])=>[key,await loadArtAtlas(s.file,s.columns,s.rows,{rowGutterFraction:.3})]));
 const propSource=snapshot?.props||photoProps,props=prop==='none'?null:{...await loadArtAtlas(propSource.file,propSource.columns,propSource.rows),indices:propSource.indices};return {avatar,bodyIndex,headIndex,props,faceRule:snapshot?snapshot.faceRule:genericFaceRule,hairRegistration:snapshot?snapshot.hairRegistration:genericHairRegistration,bodyPose:snapshot?.bodyPose,duoAnatomy:snapshot?.duoAnatomy,duoRegistration:snapshot?.duoRegistration,kissRegistration:snapshot?.kissRegistration,gripPoints:snapshot?.gripPoints||genericGripPoints,paletteRGB:snapshot?.paletteRGB,...Object.fromEntries(entries)};
}
function anchor(atlas,f,edge){
 const y=edge==='top'?f.y+Math.min(8,f.height-1):f.y+f.height-3;let x0=Infinity,x1=-Infinity;
 for(let x=f.x;x<f.x+f.width;x++)if(atlas.alphaAt(x,y)>=48){x0=Math.min(x0,x);x1=Math.max(x1,x);}
 return {x:Number.isFinite(x0)?(x0+x1)/2:f.x+f.width/2,y:edge==='top'?f.y:f.y+f.height};
}
export function drawGenericRig(canvas,rig,{direction='down',pose='stand',prop='none',duoSide='right',duoRole,reachAngle=0,headAngle=0}={}){
 const column=directions.indexOf(direction);if(column<0)throw new Error('未知朝向');
 if(!['stand','wave','cheer','arm_in_arm','kiss'].includes(pose))throw new Error('未知动作');const linking=pose==='arm_in_arm',kissing=pose==='kiss';pose=direction==='down'||kissing?pose:'stand';
 if(linking&&!rig.linkArms||kissing&&!rig.kissHead)throw new Error('双人动作部件未加载');
 if(prop!=='none'&&!Object.hasOwn(photoProps.indices,prop))throw new Error('未知道具');
 const padding=reachAngle||headAngle?128:0;
 canvas.width=256+padding*2;canvas.height=360+padding*2;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;if(padding)c.translate(padding,padding);
 const kneeling=rig.bodyPose==='kneel-v1'&&(linking||kissing),bodyAtlas=kneeling?rig.kneelingBody:rig.body;
 if(!bodyAtlas)throw Error('下蹲服装部件未加载');
 const f=bodyAtlas.frames[rig.bodyIndex*(kneeling?2:4)+(kneeling?(kissing?1:0):column)],bodyScale=kneeling?(rig.kneelingHeight||112)/f.height:174/Math.max(...rig.body.frames.slice(rig.bodyIndex*4,rig.bodyIndex*4+4).map(f=>f.height)),neck=anchor(bodyAtlas,f,'top');
 const bodyFlip=kneeling&&kissing&&direction==='right',body={x:128+(bodyFlip?neck.x-f.x-f.width:f.x-neck.x)*bodyScale,y:350-f.height*bodyScale,width:f.width*bodyScale,height:f.height*bodyScale};
 const armRects=[];let grip,propRect,duoContact,linkedJoint,neckJoint;const holding=direction==='down'&&prop!=='none';if(holding&&(!rig.gripArms||!rig.props))throw new Error('请先加载持物部件');
 if(!Number.isFinite(headAngle)||Math.abs(headAngle)>Math.PI/6||headAngle&&!kissing)throw Error('头部转动超出自然范围');
 const neckOrigin=[128,body.y+5];
 function headLayer(paint){if(!headAngle){paint();return;}c.save();c.translate(...neckOrigin);c.rotate(headAngle);c.translate(-neckOrigin[0],-neckOrigin[1]);paint();c.restore();}
 function arm(index,x,flip=false,angle=0){
  const linked=linking&&index===(duoSide==='right'?1:0),taking=linked&&duoRole==='take',compact=linked&&rig.duoRegistration==='compact-link-v2',atlas=taking?rig.linkTakingArms:linked?rig.linkArms:holding&&index===1?rig.gripArms:rig.arms;
  if(!atlas)throw Error('互补挽手部件未加载');
  // Keep the free hand in front of a bent knee, not dangling through the floor.
  // Rotate the existing arm about its shoulder; do not shorten/stretch its art.
  if(kneeling&&rig.duoAnatomy==='balanced-duo-v1'&&!linked)angle+=index===2?(column===3?-.65:.65):(index===0?.65:-.65);
  const f=atlas.frames[linked?rig.bodyIndex*2+(taking?1-index:index):rig.bodyIndex*4+index],scale=(compact?68:100)/f.height,shoulder=linked?anchor(atlas,f,'top'):null,sourceX=shoulder?.x??f.x+f.width*(index===0?.78:index===1?.22:.65),sourceY=f.y+9,y=body.y+(taking?-9:compact?12:26),bitmap=tintedClothFrame(atlas,f,rig.avatar.palette||'sage','arms',rig.paletteRGB);
  if(linked){const contact=taking?registeredDuoContact(atlas,f,{contact:[index===0?.14:.86,.82],contactProjection:'nearest-solid'}):[f.width*(index===1?.9:.1),f.height*.52],original=[x+(f.x+contact[0]-sourceX)*scale,y+(contact[1]-9)*scale];if(!Number.isFinite(reachAngle)||Math.abs(reachAngle)>Math.PI/3)throw Error('手臂转动超出自然范围');angle+=reachAngle;linkedJoint={origin:[x,y],contact:original,outward:index===1?1:-1};duoContact=angle?rotateJointPoint(original,[x,y],angle):original;}
  const paint=()=>{c.save();c.translate(x,y);c.rotate(angle);if(flip)c.scale(-1,1);c.drawImage(bitmap,0,0,f.width,f.height,(f.x-sourceX)*scale,(f.y-sourceY)*scale,f.width*scale,f.height*scale);c.restore();};paint();
  if(holding&&index===1){const registered=rig.gripPoints[rig.bodyIndex],gx=f.x+f.width*registered[0],gy=f.y+f.height*registered[1],dx=(gx-sourceX)*scale,dy=(gy-sourceY)*scale;grip=[x+dx*Math.cos(angle)-dy*Math.sin(angle),y+dx*Math.sin(angle)+dy*Math.cos(angle)];if(atlas.alphaAt(gx,gy)<48)throw new Error('通用握持点未接到手部');propRect=drawProp(c,rig.props,prop,grip,48);c.save();c.beginPath();c.ellipse(grip[0],grip[1],f.width*.055*scale,f.height*.025*scale,angle,0,Math.PI*2);c.clip();paint();c.restore();}
  const corners=[[f.x,f.y],[f.x+f.width,f.y],[f.x,f.y+f.height],[f.x+f.width,f.y+f.height]].map(([px,py])=>{const dx=(px-sourceX)*scale*(flip?-1:1),dy=(py-sourceY)*scale;return [x+dx*Math.cos(angle)-dy*Math.sin(angle),y+dx*Math.sin(angle)+dy*Math.cos(angle)];});
  armRects.push({x:Math.min(...corners.map(p=>p[0])),y:Math.min(...corners.map(p=>p[1])),width:Math.max(...corners.map(p=>p[0]))-Math.min(...corners.map(p=>p[0])),height:Math.max(...corners.map(p=>p[1]))-Math.min(...corners.map(p=>p[1]))});
 }
 const bodyBitmap=tintedClothFrame(bodyAtlas,f,rig.avatar.palette||'sage','body',rig.paletteRGB);
 c.save();if(bodyFlip){c.translate(body.x+body.width,body.y);c.scale(-1,1);c.drawImage(bodyBitmap,0,0,f.width,f.height,0,0,body.width,body.height);}else c.drawImage(bodyBitmap,0,0,f.width,f.height,body.x,body.y,body.width,body.height);c.restore();
 // Ears/muzzles/beaks extend the silhouette beyond the humanoid cranium. Calibrate
 // the head component, not the whole guest, to the same torso/sole registration.
 const balanced=rig.duoAnatomy==='balanced-duo-v1'&&(linking||kissing),natural=rig.faceRule==='natural-face-v2';
 const headSize=balanced?((natural?{human:100,cat:104,fox:104,bird:110}:{fox:104,bird:110})[rig.avatar.species]||92):126;
 const speciesUnit=balanced||rig.faceRule==='natural-face-v2';
 const headAtlas=kissing?rig.kissHead:rig.head,h=headAtlas.frames[rig.headIndex*(kissing?2:4)+(kissing?(direction==='left'?0:1):column)],registration=rig.head.frames[rig.headIndex*4+column],headScale=headSize/Math.max(...rig.head.frames.slice(speciesUnit?rig.headIndex*4:0,speciesUnit?rig.headIndex*4+4:4).map(f=>f.height)),jaw=anchor(rig.head,registration,'bottom');
 const head={x:128+(registration.x-jaw.x)*headScale,y:body.y+5-registration.height*headScale,width:registration.width*headScale,height:registration.height*headScale};
 if(kissing&&rig.kissRegistration==='aspect-jaw-v1'){
  const scale=head.height/h.height,kissJaw=anchor(headAtlas,h,'bottom');
  head.x=128+(h.x-kissJaw.x)*scale;head.width=h.width*scale;
 }
 headLayer(()=>c.drawImage(headAtlas.image,h.x,h.y,h.width,h.height,head.x,head.y,head.width,head.height));
 if(kissing){
  if(rig.kissRegistration==='aspect-jaw-v1'){
   const contact=registeredDuoContact(headAtlas,h,{contact:[direction==='left'?0:1,.82],contactProjection:'front-edge',facing:direction});
   duoContact=[head.x+contact[0]/h.width*head.width,head.y+contact[1]/h.height*head.height];
  }else duoContact=[head.x+head.width*(direction==='left'?.025:.975),head.y+head.height*.85];
  neckJoint={origin:neckOrigin,contact:duoContact,outward:direction==='right'?1:-1};if(headAngle)duoContact=rotateJointPoint(duoContact,neckOrigin,headAngle);
 }
 const hairIndex=hairStyles.indexOf(rig.avatar.hair||'short'),hf=rig.hair.frames[hairIndex*4+column];let hairScale=headScale*.85;
 const hair={x:128-hf.width*hairScale/2,y:body.y+5-headSize-9,width:hf.width*hairScale,height:hf.height*hairScale};
 if(rig.hairRegistration==='scalp-fit-v2'){
  const cap=hairCapRegistration(rig.hair,hf),cranialWidth=rig.head.frames[column].width*headScale;
  hairScale=cranialWidth*1.10/cap.width;
  const profileOffset=column===1?head.width*.10:column===3?-head.width*.10:0;
  Object.assign(hair,{x:128-(column===0?cap.openingCenter:cap.center)*hairScale+profileOffset,y:head.y+scalpTop(rig.head,registration)*headScale-head.height*.035,width:hf.width*hairScale,height:hf.height*hairScale});
 }
 headLayer(()=>c.drawImage(rig.hair.image,hf.x,hf.y,hf.width,hf.height,hair.x,hair.y,hair.width,hair.height));
 if(rig.faceRule==='natural-face-v2'&&rig.avatar.species==='android')headLayer(()=>{
  // Registered ear disks are independent identity details, in front of hair.
  // Keep hair interchangeable without turning the android into a human face.
  const centers=column===1?[[.73,.65,.14,.21]]:column===3?[[.27,.65,.14,.21]]:[[.075,.65,.085,.21],[.925,.65,.085,.21]];
  c.save();c.beginPath();for(const [x,y,rx,ry]of centers){c.moveTo(head.x+(x+rx)*head.width,head.y+y*head.height);c.ellipse(head.x+x*head.width,head.y+y*head.height,rx*head.width,ry*head.height,0,0,Math.PI*2);}c.clip();c.drawImage(headAtlas.image,h.x,h.y,h.width,h.height,head.x,head.y,head.width,head.height);c.restore();
 });
 // Raised palms are in front of the hair, never hidden behind the head.
 if(column===1||column===3){arm(2,128,column===3);}else{arm(column===2?3:0,97,column===2,pose==='cheer'||holding&&pose==='wave'?2:0);arm(column===2?3:1,159,false,pose==='cheer'||pose==='wave'&&!holding?-2:0);}
 const accessoryIndex=['ginkgo','moon','raven','bow'].indexOf(rig.avatar.accessory);let accessory;
 if(accessoryIndex>=0){const a=rig.accessories.frames[accessoryIndex*4+column],scale=30/Math.max(a.width,a.height);accessory={x:(column===1?91:157)-a.width*scale/2,y:hair.y+27,width:a.width*scale,height:a.height*scale};headLayer(()=>c.drawImage(rig.accessories.image,a.x,a.y,a.width,a.height,accessory.x,accessory.y,accessory.width,accessory.height));}
 if(padding){const shift=p=>[p[0]+padding,p[1]+padding];if(duoContact)duoContact=shift(duoContact);for(const joint of [linkedJoint,neckJoint])if(joint){joint.origin=shift(joint.origin);joint.contact=shift(joint.contact);}}
 canvas.dataset.rigVersion=genericRigVersion;canvas.dataset.direction=direction;canvas.dataset.pose=pose;canvas.dataset.prop=prop;return {body,head,hair,accessory,arms:armRects,grip,propRect,duoContact,linkedJoint,neckJoint,canvasOffset:padding,neckY:body.y+padding,footY:350+padding};
}
