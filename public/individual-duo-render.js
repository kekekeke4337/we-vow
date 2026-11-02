import {loadArtAtlas} from './photo-art.js';
import {prepareGenericRig,drawGenericRig} from './generic-art.js';
import {duoPairSeparation,duoSides} from './individual-duo-art.js';
import {photoWindow,defaultPhotoPosition} from './photo-layout.js';
import {composeDuoLayout} from './duo-layout.js';
import {registeredDuoContact} from './duo-contact.js';
import {linkRoleForSide} from './link-role-art.js';
import {shoulderReach} from './duo-joint.js';

function alphaFrame(canvas){
 const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>=48){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<left)throw Error('通用双人动作没有可见像素');
 return {x:left,y:top,width:right-left+1,height:bottom-top+1};
}

async function subject(source,side,linkRule,{reachAngle=0,headAngle=0}={}){
 const role=linkRule==='complementary-link-v1'?linkRoleForSide(side):undefined;
 if(role&&source.kind==='atlas')source={...source,...source.linkRoles[role]};
 if(source.kind==='generic'){
  const rig=await prepareGenericRig(source.rig.avatar,{snapshot:source.rig}),canvas=document.createElement('canvas');
  if(source.rig.duoAnatomy==='balanced-duo-v1')rig.kneelingHeight=source.rig.kneelingHeight;
  const parts=drawGenericRig(canvas,rig,{direction:source.pose==='kiss'?side:'down',pose:source.pose,duoSide:side,duoRole:role,reachAngle,headAngle});
  if(!parts.duoContact)throw Error('通用双人动作接触点缺失');
  if(source.frameRule==='tight-alpha-v1'){
   const frame=alphaFrame(canvas);let heightScale=1;
   if(source.rig.duoAnatomy==='balanced-duo-v1'){
    // A projected skin edge can lie on the boundary of an anti-aliased pixel
    // excluded by alpha>=48. Include registered anchors in the crop, not a new
    // body scale; transparent padding must not invalidate an otherwise valid rig.
    const left=Math.min(frame.x,Math.floor(parts.duoContact[0])),top=Math.min(frame.y,Math.floor(parts.duoContact[1]));
    const right=Math.max(frame.x+frame.width,Math.ceil(parts.duoContact[0])+1),bottom=Math.max(frame.y+frame.height,Math.ceil(parts.duoContact[1])+1,Math.ceil(parts.footY));
    if(left<0||top<0||right>canvas.width||bottom>canvas.height)throw Error('动作登记点超出画布');
    Object.assign(frame,{x:left,y:top,width:right-left,height:bottom-top});
   }
   if((reachAngle||headAngle)&&(frame.x===0||frame.y===0||frame.x+frame.width===canvas.width||frame.y+frame.height===canvas.height))throw Error('转动姿势超出透明画布，请检查素材边界');
   if(source.rig.bodyPose==='kneel-v1'){
    const standing=document.createElement('canvas');drawGenericRig(standing,{...rig,bodyPose:undefined},{direction:source.pose==='kiss'?side:'down',pose:source.pose,duoSide:side});
    // All other parts retain the SAME native pixel scale; bending legs reduces
    // total height, never normalizes the kneeling person back to standing height.
    heightScale=frame.height/alphaFrame(standing).height;
   }else if(reachAngle||headAngle){
    const original=document.createElement('canvas');drawGenericRig(original,rig,{direction:source.pose==='kiss'?side:'down',pose:source.pose,duoSide:side,duoRole:role});
    // A limb changing the tight bounds must not resize the torso/head/legs.
    heightScale=frame.height/alphaFrame(original).height;
   }
   // Hair and ears change tight alpha bounds, not somebody's body height. New
   // rigs use one anatomical unit; old frozen photographs keep their old unit.
   if(source.rig.duoAnatomy==='balanced-duo-v1')heightScale=frame.height/270;
   return {image:canvas,frame,contact:[parts.duoContact[0]-frame.x,parts.duoContact[1]-frame.y],...(source.rig.duoAnatomy==='balanced-duo-v1'?{sole:parts.footY-frame.y}:{}),flip:false,heightScale,linkedJoint:parts.linkedJoint,neckJoint:parts.neckJoint};
  }
  return {image:canvas,frame:{x:0,y:0,width:256,height:360},contact:parts.duoContact,flip:false,heightScale:1};
 }
 const atlas=await loadArtAtlas(source.file,source.columns,source.rows),frame=atlas.frames[(source.row??source.member)*source.columns+source.column];
 if(!frame||!source.contact)throw Error('专属双人动作帧或接触点缺失');
 return {image:atlas.image,frame,contact:registeredDuoContact(atlas,frame,source),flip:source.facing!==side,heightScale:source.heightScale||1};
}
export async function drawIndividualDuo(c,room,art){
 const people=room.people.filter(p=>art.members.includes(p.id));
 if(people.length!==2||art.subjects?.length!==2||new Set(art.subjects.map(p=>p.id)).size!==2||!art.subjects.every(p=>art.members.includes(p.id)))throw Error('双人动作存档身份不完整');
 const positions=Object.fromEntries(people.map(p=>[p.id,room.positions?.[p.id]||defaultPhotoPosition(room.people.findIndex(other=>other.id===p.id),room.people.length)])),sides=duoSides(people,positions);
 const subjects=await Promise.all(art.subjects.map(async item=>({id:item.id,...await subject(item.source,sides[item.id],art.linkRule)})));
 const jointAdjustments=[];
 for(let i=0;i<subjects.length;i++){
  const item=art.subjects[i],a=subjects[i],b=subjects[1-i];
  const rule=item.source.rig?.duoJointRule,joint=rule==='shoulder-reach-v1'?a.linkedJoint:rule==='neck-tilt-v1'?a.neckJoint:undefined;
  if(art.layoutRule!=='natural-depth-v1'||!joint)continue;
  const scale=240*a.heightScale/a.frame.height,rise=((a.sole??a.frame.height)-a.contact[1])*scale,otherRise=((b.sole??b.frame.height)-b.contact[1])*240*b.heightScale/b.frame.height;
  if(Math.abs(rise-otherRise)<=(art.groundingRule==='shared-floor-v1'?.1:30))continue;
  const target=a.frame.y+(a.sole??a.frame.height)-otherRise/scale,adjustment=shoulderReach(joint,target,{limit:rule==='neck-tilt-v1'?Math.PI/6:Math.PI/3});
  if(!adjustment.angle||adjustment.error>=Math.abs(rise-otherRise)/scale)continue;
  subjects[i]={id:item.id,...await subject(item.source,sides[item.id],art.linkRule,rule==='neck-tilt-v1'?{headAngle:adjustment.angle}:{reachAngle:adjustment.angle})};
  jointAdjustments.push({id:item.id,rule,angle:adjustment.angle,originalDepthDifference:Math.abs(rise-otherRise),nativeResidual:adjustment.error});
 }
 const center=people.reduce((a,p)=>({x:a.x+positions[p.id].x/2,y:a.y+positions[p.id].y/2}),{x:0,y:0});
 const layout=composeDuoLayout(subjects.map(s=>({...s,side:sides[s.id]})),{center,window:photoWindow,heightMode:art.layoutRule||'contact-fit-v1'}),{baseline,rects}=layout,targetX=layout.contact.x;
 const separation=duoPairSeparation(art)*240;
 if(separation)for(const rect of rects){const shift=(rect.side==='right'?-1:1)*separation/2;rect.x+=shift;rect.contact={x:rect.contact.x+shift,y:rect.contact.y};}
 const paintOrder=[...subjects.entries()].sort(([,a],[,b])=>art.linkRule==='complementary-link-v1'?Number(sides[a.id]==='left')-Number(sides[b.id]==='left'):0);
 for(const [index,s]of paintOrder){const f=s.frame,{x,y,width,height}=rects[index];
  c.save();if(s.flip){c.translate(x+width,y);c.scale(-1,1);c.drawImage(s.image,f.x,f.y,f.width,f.height,0,0,width,height);}else c.drawImage(s.image,f.x,f.y,f.width,f.height,x,y,width,height);c.restore();
 }
 for(const rect of rects){const p=people.find(p=>p.id===rect.id),foot=art.layoutRule==='natural-depth-v1'?rect.footY:baseline;c.font='20px "Microsoft YaHei",sans-serif';c.textAlign='center';const w=Math.min(160,c.measureText(p.name).width)+16,x=Math.max(photoWindow.x+w/2,Math.min(photoWindow.x+photoWindow.width-w/2,targetX+(rect.side==='right'?-100:100)));c.fillStyle='#fff9ece6';c.fillRect(x-w/2,foot+18,w,30);c.fillStyle='#294c40';c.fillText(p.name,x,foot+41,160);}
 return {people:art.members,pose:art.pose,rects,depthSpread:layout.depthSpread,jointAdjustments,nativeScales:rects.map((r,i)=>({id:r.id,scale:r.height/subjects[i].frame.height})),rect:{x:Math.min(...rects.map(r=>r.x)),y:Math.min(...rects.map(r=>r.y)),width:Math.max(...rects.map(r=>r.x+r.width))-Math.min(...rects.map(r=>r.x)),height:Math.max(...rects.map(r=>r.footY))-Math.min(...rects.map(r=>r.y))}};
}
