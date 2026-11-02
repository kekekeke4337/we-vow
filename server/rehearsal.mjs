import {randomBytes} from 'node:crypto';
import {createWedding} from './wedding.mjs';
import {rehearsalProfiles,rehearsalProfile,rehearsalVersion} from '../public/rehearsal-profiles.js';
import {seedRehearsalCast} from './rehearsal-cast.mjs';
export function createRehearsals(){
 const rooms=new Map();
 function start({identityId='bride'}={},previousId,previousSession){
  const selected=rehearsalProfile(identityId);
  const previous=rooms.get(previousId);
  if(previous&&previous.session!==previousSession)throw Object.assign(new Error('不能切换其他人的演练'),{status:401});
  // Each browser gets a separate in-memory wedding, never the persisted formal state.
  if(rooms.size>=20){const [oldest,room]=rooms.entries().next().value;room.wedding.close();rooms.delete(oldest);}
  const wedding=createWedding(),people=new Map();
  for(const {profile,invite} of seedRehearsalCast(wedding,{selectedId:identityId,simulated:true}))people.set(profile.id,wedding.joinGuest(invite));
  for(const [key,text]of [['witness','愿你们把平常的日子，也过成喜欢的模样。'],['guest','很高兴在这片花海里见证你们。']])wedding.action(people.get(key).session,'blessing',{text:'【模拟留言】'+text});
  const session=people.get(selected.id).session,bots=[...people.entries()].filter(([key])=>key!==selected.id).map(([,value])=>value);
  const director=people.get('bride').session;
  if(previous){previous.wedding.close();rooms.delete(previousId);}
  const id=randomBytes(24).toString('base64url');rooms.set(id,{wedding,session,bots,director,selected,spoke:false});return {session,rehearsalId:id,identityId,version:rehearsalVersion};
 }
 function request(id,session,type,args){
  const room=rooms.get(id);if(!room||room.session!==session)throw Object.assign(new Error('演练会话已结束，请开始新演练；正式现场不受影响'),{status:401});
  const {wedding,bots}=room;for(const bot of bots)wedding.snapshot(bot.session);
  if(type==='rehearsal_duo_response'){
   const photo=wedding.snapshot(session).booths.find(p=>p.id===args?.roomId),recipient=bots.find(bot=>bot.guest.id===photo?.duo?.to);
   if(!recipient)throw Object.assign(new Error('仅能在独立演练里模拟接收方，真实联测仍须本人回应'),{status:403});
   wedding.action(recipient.session,'booth_duo',{roomId:photo.id,operation:'respond',requestId:args.requestId,accept:args.accept});
  }else if(type==='rehearsal_next')wedding.action(room.director,'next',{});
  else if(type==='resume')wedding.resumeGuest(session);else if(type==='leave')return wedding.action(session,type,args);else if(type)wedding.action(session,type,args);
  let state=wedding.snapshot(session);
  if(!state.paused){
   const groom=bots.find(b=>b.guest.role==='groom'),rings=bots.find(b=>b.guest.role==='rings');
   if(state.phase.id==='groom'&&groom&&!room.spoke){wedding.action(groom.session,'speech',{text:'【演练占位讲话】这段文字来自模拟新人，不是任何真实参与者的讲话或承诺。'});room.spoke=true;}
   if(state.phase.id==='consent')for(const bot of bots.filter(b=>['bride','groom'].includes(b.guest.role)))wedding.action(bot.session,'confirm');
   if(state.phase.id==='rings'&&rings&&!state.ringsDelivered)wedding.action(rings.session,'rings');
   if(state.activitiesOpen)for(const photo of state.booths.filter(p=>p.status==='open'))for(const invite of photo.invites.filter(i=>i.status==='pending')){
    const bot=bots.find(b=>b.guest.id===invite.guestId);if(bot)wedding.action(bot.session,'booth_respond',{roomId:photo.id,accept:true});
   }
  }
  state=wedding.snapshot(session);return {...state,rehearsal:true,rehearsalIdentity:room.selected.id,rehearsalVersion};
 }
 return {start,request,close(){for(const room of rooms.values())room.wedding.close();rooms.clear();}};
}
