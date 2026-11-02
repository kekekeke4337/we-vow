export function rotateJointPoint(point,origin,angle){
 if(![...point,...origin,angle].every(Number.isFinite))throw Error('动作关节坐标无效');
 const x=point[0]-origin[0],y=point[1]-origin[1],cos=Math.cos(angle),sin=Math.sin(angle);
 return [origin[0]+x*cos-y*sin,origin[1]+x*sin+y*cos];
}
// Articulates an existing bitmap limb about its registered shoulder, never a
// whole-body scale/translation or a different species/appearance substitution.
export function shoulderReach({origin,contact,outward},targetY,{limit=Math.PI/3}={}){
 if(![...origin,...contact,outward,targetY,limit].every(Number.isFinite)||![-1,1].includes(outward)||limit<=0||limit>Math.PI/3)throw Error('动作关节范围无效');
 let best={angle:0,point:contact,error:Math.abs(contact[1]-targetY)};
 for(let step=-120;step<=120;step++){
  const angle=limit*step/120,point=rotateJointPoint(contact,origin,angle);
  if((point[0]-origin[0])*outward<0)continue;
  const error=Math.abs(point[1]-targetY);
  if(error+Math.abs(angle)*.001<best.error+Math.abs(best.angle)*.001)best={angle,point,error};
 }
 return best;
}
