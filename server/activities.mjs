import {randomBytes} from 'node:crypto';
import {normalizeCamera,normalizePhotoPosition} from '../public/photo-layout.js';
import {photoArtVersion,photoArtKey,freezePhotoArt} from '../public/photo-art-manifest.js';
import {photoDuoAction,cancelDuo} from './photo-duo.mjs';
import {duoPoses} from '../public/duo-art-manifest.js';
const id=()=>randomBytes(18).toString('base64url');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const boothOptions={props:['none','moon','ginkgo','raven','heart'],poses:['stand','wave','cheer'],frames:['sage','sky','cream'],duoPoses:Object.keys(duoPoses),duoScope:'couple-only'};
export function createActivities({state,clock,online,canParticipate}){
 state.blessings??=[];state.booths??=[];
 function expire(){for(const room of state.booths)if(room.status==='open'&&clock()>room.expiresAt)room.status='expired';}
 function snapshot(g){expire();return {activitiesOpen:canParticipate(),blessings:state.blessings,boothOptions,booths:state.booths.filter(r=>r.owner===g.id||(r.status==='captured'?r.people.some(p=>p.id===g.id):r.invites.some(i=>i.guestId===g.id)))};}
 function action(g,type,args={}){
  expire();if(!canParticipate())fail('仪式安静进行中或已闭幕，请在开放活动时再操作',403);
  if(type==='blessing'){
   const text=typeof args.text==='string'?args.text.trim():'';if(!text||text.length>300)fail('祝福请输入1至300字，完全自愿');
   const prior=state.blessings.find(b=>b.guestId===g.id);
   if(prior){prior.text=text;prior.at=clock();}else{if(state.blessings.length>=5000)fail('祝福墙已满');state.blessings.push({guestId:g.id,name:g.name,text,at:clock()});}return;
  }
  if(type==='booth_create'){
   if(state.booths.some(r=>r.owner===g.id&&r.status==='open'))return;
   if(state.booths.length>=1000)fail('相册已满');
   state.booths.push({id:id(),owner:g.id,ownerName:g.name,ownerPerson:{id:g.id,name:g.name,role:g.role,seed:g.seed,character:g.character},status:'open',frame:'sage',camera:normalizeCamera({x:g.x,y:g.y}),positions:{},invites:[],styles:{[g.id]:{prop:'none',pose:'stand'}},createdAt:clock(),expiresAt:clock()+30*60000});return;
  }
  const room=state.booths.find(r=>r.id===args.roomId);
  if(!room||(room.owner!==g.id&&!room.invites.some(i=>i.guestId===g.id)))fail('没有这张拍立得邀请',403);
  if(room.status!=='open')fail('这次拍摄已结束或邀请已过期');
  if(type==='booth_duo'){photoDuoAction({room,g,args,state,clock});return;}
  if(type==='booth_invite'){
   if(room.owner!==g.id)fail('只有发起人可以邀请',403);
   const target=state.guests[args.guestId];if(!target||target.id===g.id||!online(target))fail('请选择一位当前在线的其他来宾');
   if(room.invites.some(i=>i.guestId===target.id))fail('已经邀请过这位来宾');
   room.invites.push({guestId:target.id,name:target.name,role:target.role,seed:target.seed,character:target.character,status:'pending'});
   // Adding a bystander does not revoke the two participants' existing consent.
  }else if(type==='booth_respond'){
   const invitation=room.invites.find(i=>i.guestId===g.id);if(!invitation)fail('只有被邀请人能接受或拒绝自己的邀请',403);
   if(typeof args.accept!=='boolean')fail('请明确接受或拒绝');
   invitation.status=args.accept?'accepted':'declined';
   if(!args.accept&&[room.duo?.from,room.duo?.to].includes(g.id))cancelDuo(room,clock);
   Object.assign(invitation,{name:g.name,role:g.role,seed:g.seed,character:g.character});
   if(args.accept)room.styles[g.id]??={prop:'none',pose:'stand'};
  }else if(type==='booth_remove'){
   if(room.owner!==g.id)fail('只有发起人可以撤回邀请',403);
   room.invites=room.invites.filter(i=>i.guestId!==args.guestId);delete room.styles[args.guestId];if(room.positions)delete room.positions[args.guestId];if([room.duo?.from,room.duo?.to].includes(args.guestId))cancelDuo(room,clock);
  }else if(type==='booth_style'){
   if(room.owner!==g.id&&!room.invites.some(i=>i.guestId===g.id&&i.status==='accepted'))fail('请先接受邀请',403);
   for(const [key,list]of [['prop',boothOptions.props],['pose',boothOptions.poses],['frame',boothOptions.frames]])if(args[key]!==undefined&&!list.includes(args[key]))fail('未知拍照选项');
   if(args.frame!==undefined&&room.owner!==g.id)fail('只有发起人可选择相框',403);
   let camera,positions;
   const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
   if(args.camera!==undefined){
    if(room.owner!==g.id)fail('只有发起人可选择取景',403);
    if(!object(args.camera)||Object.keys(args.camera).some(k=>!['x','y','zoom'].includes(k))||!['x','y','zoom'].every(k=>Number.isFinite(args.camera[k])))fail('取景需要有效的x、y、zoom数值');
    camera=normalizeCamera(args.camera);
   }
   if(args.positions!==undefined){
    if(room.owner!==g.id)fail('只有发起人可摆放照片人物',403);
    const accepted=new Set([room.owner,...room.invites.filter(i=>i.status==='accepted').map(i=>i.guestId)]);
    if(!object(args.positions))fail('照片站位需要有效的人物坐标');
    positions={};for(const [key,value]of Object.entries(args.positions)){
     if(!accepted.has(key))fail('只能摆放已经接受邀请的入镜人物',403);
     if(!object(value)||Object.keys(value).some(k=>!['x','y'].includes(k))||!Number.isFinite(value.x)||!Number.isFinite(value.y))fail('照片站位需要有效的x、y数值');
     positions[key]=normalizePhotoPosition(value);
    }
   }
   if([room.duo?.from,room.duo?.to].includes(g.id)&&(args.pose!==undefined||args.prop!==undefined&&args.prop!=='none'))cancelDuo(room,clock);
   const style=room.styles[g.id]??={prop:'none',pose:'stand'};if(args.prop!==undefined)style.prop=args.prop;if(args.pose!==undefined)style.pose=args.pose;if(args.frame!==undefined)room.frame=args.frame;
   if(camera)room.camera=camera;if(positions)room.positions=positions;
  }else if(type==='booth_capture'){
   if(room.owner!==g.id)fail('只有发起人可以按快门',403);
   if(room.invites.some(i=>i.status==='pending'))fail('还有邀请等待回应，可以等待或撤回，不能强拉合照');
   if(room.duo?.status==='pending')fail('双人动作还在等对方同意，可等待或取消后用单人动作拍摄');
   const members=[room.owner,...room.invites.filter(i=>i.status==='accepted').map(i=>i.guestId)];
   room.positions=Object.fromEntries(Object.entries(room.positions||{}).filter(([key])=>members.includes(key)));
   room.people=members.map(key=>{const person=state.guests[key],style=room.styles[key]||{};return {id:key,name:person.name,seed:person.seed,role:person.role,character:person.character,artKey:photoArtKey(person),...style,artSnapshot:freezePhotoArt({...person,...style})};});
   room.artVersion=photoArtVersion;
   room.status='captured';room.capturedAt=clock();
  }else if(type==='booth_cancel'){
   if(room.owner!==g.id)fail('只有发起人可以取消拍摄',403);room.status='cancelled';
  }else fail('未知拍立得操作');
 }
 return {snapshot,action};
}
