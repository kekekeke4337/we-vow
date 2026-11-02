import {randomBytes} from 'node:crypto';
import {scenePoints,planWalk,pathDistance,sampleWalk,nearestWalkway,walkableAt} from '../public/walkways.js';
import {stageLayout,archPhotoPlaces,stageForCount} from '../public/stage-layout.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const ceremonyPhases=new Set(['seating','opening','witness','entrance','groom','consent','rings','kiss','embrace']);
export function guestGroups(guests){
 const byId=new Map(guests.map(g=>[g.id,g])),used=new Set(),groups=[];
 const bride=guests.find(g=>g.role==='bride'),groom=guests.find(g=>g.role==='groom');
 if(bride||groom){const couple=[bride,groom].filter(Boolean);groups.push(couple);couple.forEach(g=>used.add(g.id));}
 for(const guest of [...guests].sort((a,b)=>a.joinedAt-b.joinedAt||a.id.localeCompare(b.id))){
  if(used.has(guest.id))continue;
  const owner=guest.partner?byId.get(guest.partner):guest,companion=owner&&byId.get(owner.companionId);
  const pair=owner&&owner.kind!=='machine'&&companion?.kind==='machine'&&companion.partner===owner.id&&owner.companionId===companion.id;
  const group=pair?[owner,companion]:[guest];groups.push(group);group.forEach(g=>used.add(g.id));
 }
 return groups;
}
export function formation(guests,scene){
 if(scene==='photo')return archPhotoPlaces(guestGroups(guests),stageForCount(guests.length));
 if(scene==='ceremony'&&guests.length>40){
  const result=new Map(),groups=guestGroups(guests).sort((a,b)=>b.length-a.length),xs=[[.355,.373,.391,.409],[.451,.469,.487,.505]],slots=[];
  for(let row=0;row<18;row++)for(let bank=0;bank<2;bank++)for(let i=0;i<4;i++){const x=xs[bank][i],y=.4+row*.021;if(walkableAt([x,y]))slots.push({x,y,row,bank,index:i});}
  const used=new Set();
  if(guests.length>80)fail('现场站位最多80位');
  for(const group of groups){if(group.some(g=>['bride','groom'].includes(g.role))){for(const g of group)result.set(g.id,{scene,x:stageLayout.couple.x+(g.role==='bride'?-.009:.009),y:stageLayout.couple.y,group:group[0].id});continue;}
   let selected;
   for(const s of slots){if(used.has(s))continue;if(group.length===1){selected=[s];break;}const next=slots.find(n=>!used.has(n)&&n.row===s.row&&n.bank===s.bank&&n.index===s.index+1);if(next){selected=[s,next];break;}}
   if(!selected)fail('观礼站位已满');group.forEach((g,i)=>{const p=selected[i];used.add(p);result.set(g.id,{scene,x:p.x,y:p.y,group:group[0].id});});
  }return result;
 }
 const groups=guestGroups(guests),result=new Map(),regularCount=groups.filter(group=>!group.some(g=>['bride','groom'].includes(g.role))).length,rowStep=Math.min(.06,(scene==='ceremony'?.35:.28)/Math.max(1,Math.ceil(regularCount/4)-1));let slot=0;
 for(const group of groups){
  const couple=group.some(g=>['bride','groom'].includes(g.role));
  const col=slot%4,row=Math.floor(slot/4),jitter=((slot*17)%7-3)*.001;
  let x,y;
  if(couple){x=scene==='ceremony'?stageLayout.couple.x:.895;y=scene==='ceremony'?stageLayout.couple.y:.44;}
  else if(scene==='ceremony'){x=[.352,.391,.467,.506][col];y=.43+row*rowStep+jitter;slot++;}
  else{x=.826+col*.045;y=.51+row*rowStep+jitter;slot++;}
  group.forEach((g,i)=>result.set(g.id,{scene,x:x+(group.length===2?(i? .009:-.009):0),y:Math.min(.81,y+(!couple&&i? .002:0)),group:group[0].id}));
 }
 return result;
}
export function createMovement({state,clock,online}){
 function linked(owner){const g=state.guests[owner?.companionId];return owner&&owner.kind!=='machine'&&g?.kind==='machine'&&g.partner===owner.id?g:null;}
 function walk(g,scene,target,{exact=false,reason='move'}={}){
  const now=clock(),start=sampleWalk(g.motion,now,[g.x,g.y]).position,plan=planWalk(start,target,{exact});
  if(g.scene===scene&&pathDistance([g.x,g.y],plan.destination)<.00001&&g.motion)return;
  let length=0;for(let i=1;i<plan.path.length;i++)length+=pathDistance(plan.path[i-1],plan.path[i]);
  g.scene=scene;[g.x,g.y]=plan.destination;g.motion={id:randomBytes(8).toString('hex'),startedAt:now,duration:Math.max(250,Math.min(18000,length/.24*1000)),path:plan.path,reason};
  g.facing=['ceremony','seat'].includes(reason)?['bride','groom'].includes(g.role)?'down':'up':reason==='gather'?'down':sampleWalk(g.motion,now+g.motion.duration,[g.x,g.y]).direction;
 }
 function followOwner(owner){const companion=linked(owner);if(!companion||companion.followPartner===false||!online(companion)||!online(owner))return;
  companion.followPartner=true;companion.seated=owner.seated;walk(companion,owner.scene,[owner.x+.018,owner.y+.003],{reason:'follow'});
  companion.facing=owner.facing??companion.facing;
 }
 function move(g,scene,args={}){
  if(!scenePoints[scene])fail('未知场景');
  delete g.placedByPartner;
  if(g.kind==='machine'&&g.partner)g.followPartner=false;
  const target=[Number.isFinite(args.x)?Math.max(0,Math.min(1,args.x)):scenePoints[scene][0],Number.isFinite(args.y)?Math.max(.18,Math.min(.82,args.y)):scenePoints[scene][1]];
  g.seated=false;walk(g,scene,target);followOwner(g);
 }
 function arrange(guests,scene,reason){const places=formation(guests,scene);for(const g of guests){const p=places.get(g.id);delete g.placedByPartner;g.seated=scene==='ceremony';walk(g,scene,[p.x,p.y],{exact:true,reason});}return places;}
 function assemble(){return arrange(Object.values(state.guests).filter(online),'ceremony','ceremony');}
 function seat(g){delete g.placedByPartner;const people=Object.values(state.guests).filter(online);if(!people.includes(g))people.push(g);const places=formation(people,'ceremony'),p=places.get(g.id);g.seated=true;walk(g,'ceremony',[p.x,p.y],{exact:true,reason:'seat'});const companion=linked(g);if(companion&&companion.followPartner!==false&&online(companion)){const q=places.get(companion.id);companion.seated=true;walk(companion,'ceremony',[q.x,q.y],{exact:true,reason:'seat'});}}
 function ringBearer(){const bearer=Object.values(state.guests).find(g=>g.role==='rings'&&online(g));if(bearer){bearer.seated=false;walk(bearer,stageLayout.scene,[stageLayout.rings.x,stageLayout.rings.y],{exact:true,reason:'rings-delivery'});bearer.facing='up';}}
 function returnRingBearer(){const bearer=Object.values(state.guests).find(g=>g.role==='rings'&&online(g));if(bearer){seat(bearer);if(bearer.motion)bearer.motion.reason='rings-return';}}
 function initialize(g,phase){const owner=state.guests[g.partner];if(owner&&linked(owner)?.id===g.id){g.followPartner??=true;if(online(owner))followOwner(owner);}else if(!g.partner)followOwner(g);if(ceremonyPhases.has(phase))assemble();if(phase==='rings')ringBearer();}
 function follow(g,enabled,phase){
  if(typeof enabled!=='boolean')fail('请明确是否恢复跟随');
  const owner=g.kind==='machine'?state.guests[g.partner]:g,companion=linked(owner);
  if(!companion||(g.kind==='machine'&&companion.id!==g.id))fail('只能调整自己与关联伴侣的跟随',403);
  companion.followPartner=enabled;
  if(enabled)delete companion.placedByPartner;
  if(enabled&&online(companion)&&online(owner)){if(ceremonyPhases.has(phase))seat(owner);else if(phase!=='photo'&&phase!=='closed')followOwner(owner);}
  return companion;
 }
 function placeCompanion(owner,args={}){
  if(owner.kind==='machine'||owner.partner)fail('仅人类可调整自己的伴侣机',403);
  const companion=linked(owner);if(!companion||companion.role!=='guest')fail('只能摆放自己绑定的普通伴侣机，不能摆其他来宾或职责角色',403);
  if(companion.away)fail('伴侣机已暂离，不能强行拉回',409);
  if(Object.keys(args).some(key=>!['x','y','scene','mode'].includes(key)))fail('摆位只能改位置，不能指定他人、身份或代为操作',403);
  let target,scene;
  if(args.mode==='beside'){
   if(Object.keys(args).some(key=>key!=='mode'))fail('站在身边不能附带其他摆位参数');
   const point=sampleWalk(owner.motion,clock(),[owner.x,owner.y]).position;target=[Math.min(1,point[0]+.018),Math.max(.18,Math.min(.82,point[1]+.003))];scene=owner.scene;
  }else{
   if(args.mode!==undefined||!Number.isFinite(args.x)||!Number.isFinite(args.y))fail('请指定有限的地图坐标');
   scene=args.scene??owner.scene;if(!Object.hasOwn(scenePoints,scene))fail('未知场景');
   target=[Math.max(0,Math.min(1,args.x)),Math.max(.18,Math.min(.82,args.y))];
  }
  companion.followPartner=false;companion.placedByPartner=true;companion.seated=false;walk(companion,scene,target,{exact:true,reason:'partner-placement'});return companion;
 }
 return {placeCompanion,move,seat,walk,arrange,assemble,initialize,ringBearer,returnRingBearer,follow,followOwner,linked,position:g=>sampleWalk(g.motion,clock(),[g.x,g.y]),nearestWalkway};
}
