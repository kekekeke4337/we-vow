// Web rendering needs the full snapshot. Agents receive only actionable state by default.
import {attendanceGuide} from './mcp-tools.mjs';
import {resolveFacing} from '../public/facing.js';
import {characterSets,roleNotes,guestActivityGuide} from '../public/characters.js';
import {pendingPhotoDuos} from './photo-duo.mjs';
import {roleCue} from './role-cue.mjs';
export function compactMcpView(value,args={}){
 if(!value?.phase)return value;
 if(!value.me){
  if(!value.changed&&!value.notifications?.length)return {changed:false,continueWaiting:value.continueWaiting!==false,eventCursor:value.eventCursor};
  return {changed:true,continueWaiting:value.continueWaiting!==false,phase:value.phase.id,...(value.roleCue?{roleCue:value.roleCue}:{}),...(value.eventCursor!==undefined?{eventCursor:value.eventCursor,hasMore:value.hasMore}:{}),...(value.events?.length?{events:value.events}:{}),...(value.photoInvitations?{photoInvitations:value.photoInvitations}:{}),...(value.photoDuoRequests?.length?{photoDuoRequests:value.photoDuoRequests}:{}),...(value.resync?{resync:true}:{}),...(value.chatChanged?{chatChanged:true,messageCursor:value.messageCursor}:{}),...(value.notifications?.length?{notifications:value.notifications}:{})};
 }
 const result={...(value.session?{guide:attendanceGuide}:{}),phase:value.phase.id,eventCursor:value.eventCursor,paused:value.paused,bloomed:value.bloomed,me:{id:value.me.id,name:value.me.name,role:value.me.role,scene:value.me.scene,canSpeak:value.me.canSpeak,canConfirm:value.me.canConfirm,controller:value.me.controller},onlineCount:value.guests.length,messageCursor:value.messages.at(-1)?.id||null};
 if(value.session){result.session=value.session;result.phaseSummary=value.phase.label+'。'+value.phase.copy;result.guide=attendanceGuide;result.roleNote=roleNotes[value.me.role];result.activityGuide=guestActivityGuide;}
 if(value.session){const cue=roleCue({role:value.me.role,phase:value.phase.id,paused:value.paused,away:value.me.away,confirmed:value.confirmations?.[value.me.role],ringsDelivered:value.ringsDelivered});if(cue)result.roleCue=cue;}
 if(args.includeAppearance)result.appearance={locked:true,...value.me.character};
 result.me.movement=value.me.movement;
 if(value.me.placedByPartner)result.me.positionSource='partner';
 if(args.includeAppearance)result.appearance.facing=resolveFacing(value.me,value.serverTime);
 if(value.me.partner)result.me.following=value.me.followPartner!==false;
 if(value.notifications.length)result.notifications=value.notifications;
 if(value.phase.id==='consent')result.confirmations={bride:Boolean(value.confirmations.bride),groom:Boolean(value.confirmations.groom)};
 if(value.phase.id==='rings')result.ringsDelivered=value.ringsDelivered;
 const invitations=value.booths.filter(r=>r.status==='open'&&r.invites.some(i=>i.guestId===value.me.id&&i.status==='pending')).map(r=>({roomId:r.id,from:r.ownerName}));
 if(invitations.length)result.photoInvitations=invitations;
 if(value.session||args.includeBooths){const duoRequests=pendingPhotoDuos(value.booths,value.me.id);if(duoRequests.length)result.photoDuoRequests=duoRequests;}
 const own=value.booths.find(r=>r.owner===value.me.id&&r.status==='open');if(own)result.myPhoto={roomId:own.id,invites:own.invites.map(i=>({name:i.name,status:i.status}))};
 if(args.includeGuests)result.guests=value.guests.map(g=>({id:g.id,name:g.name,role:g.role}));
 if(args.includeBooths)result.booths=value.booths;
 if(args.includeBlessings)result.blessings=value.blessings.slice(-10).map(b=>({name:b.name,text:b.text}));
 if(args.includeMessages){
  const cursor=args.afterMessageId?value.messages.findIndex(m=>m.id===args.afterMessageId):-1;
  const messages=cursor>=0?value.messages.slice(cursor+1):value.messages.slice(-10);
  result.messages=messages.slice(0,10);result.nextMessageId=result.messages.at(-1)?.id||args.afterMessageId||null;result.hasMoreMessages=messages.length>10;
  if(args.afterMessageId&&cursor<0)result.messagesResync=true;
 }
 if(args.messageId)result.message=value.message??value.messages.find(m=>m.id===args.messageId)??null;
 return result;
}
