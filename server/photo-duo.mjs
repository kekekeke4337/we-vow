import {randomUUID} from 'node:crypto';
import {duoPoses,freezeDuoArt} from '../public/duo-art-manifest.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function pendingPhotoDuos(rooms,guestId){return rooms.filter(r=>r.status==='open'&&r.duo?.status==='pending'&&r.duo.to===guestId).slice(0,3).map(r=>({roomId:r.id,requestId:r.duo.id,pose:r.duo.pose,from:r.duo.from,action:'booth_duo',operation:'respond'}));}
export function cancelDuo(room,clock){if(room.duo&&['pending','accepted'].includes(room.duo.status)){room.duo.status='cancelled';room.duo.cancelledAt=clock();}}
export function photoDuoAction({room,g,args,state,clock}){
 const ids=[room.owner,...room.invites.filter(i=>i.status==='accepted').map(i=>i.guestId)];
 if(!ids.includes(g.id))fail('请先接受合照邀请，不能替别人选择双人动作',403);
 if(Object.keys(args).some(k=>!['roomId','operation','guestId','pose','requestId','accept'].includes(k)))fail('双人动作不能附带他人身份或素材参数',403);
 if(args.operation==='request'){
  if(!ids.includes(args.guestId)||args.guestId===g.id)fail('请选择另一位已同意入镜的人',403);
  if(!Object.hasOwn(duoPoses,args.pose))fail('未知双人动作');
  const pair=[g.id,args.guestId];freezeDuoArt(pair.map(id=>state.guests[id]),args.pose);
  if(pair.some(id=>room.styles[id]?.prop&&room.styles[id].prop!=='none'))fail('这版双人动作是空手姿势，请双方先不拿道具');
  if(room.duo&&['pending','accepted'].includes(room.duo.status)&&![room.duo.from,room.duo.to].includes(g.id))fail('不能替换其他两位正在进行的双人动作，请等本人取消',403);
  if(room.duo?.from===g.id&&room.duo.to===args.guestId&&room.duo.pose===args.pose&&['pending','accepted'].includes(room.duo.status))return;
  room.duo={id:randomUUID(),from:g.id,to:args.guestId,pose:args.pose,status:'pending',createdAt:clock()};return;
 }
 const duo=room.duo;if(!duo||duo.id!==args.requestId)fail('双人动作请求已改变，请读取最新邀请后再操作',409);
 if(args.operation==='cancel'){
  if(![duo.from,duo.to].includes(g.id))fail('只能退出自己参与的双人动作',403);cancelDuo(room,clock);return;
 }
 if(args.operation!=='respond')fail('未知双人动作操作');
 if(g.id!==duo.to)fail('只有收到请求的本人可以同意或拒绝，不能代答',403);
 if(typeof args.accept!=='boolean')fail('请明确同意或拒绝双人动作');
 if(!['pending','accepted','declined'].includes(duo.status))fail('双人动作已经取消，请重新邀请',409);
 if(duo.status==='accepted'&&args.accept)return;
 if(args.accept){
  const pair=[duo.from,duo.to];if(!pair.every(id=>ids.includes(id)))fail('入镜名单已改变，请重新邀请双人动作',409);
  if(pair.some(id=>room.styles[id]?.prop&&room.styles[id].prop!=='none'))fail('请双方先不拿道具');
  duo.artSnapshot=freezeDuoArt(pair.map(id=>state.guests[id]),duo.pose);
 }
 duo.status=args.accept?'accepted':'declined';duo.respondedAt=clock();
}
