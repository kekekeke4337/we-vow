import {createHash} from 'node:crypto';

export const defaultWakeKinds=Object.freeze([
 'phase','pause','role_cue','photo_invitation','photo_duo_request','notification','resync','listener_error','left','closed'
]);

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);

export function normalizeWaitResult(result,{identityKey,wakeKinds=defaultWakeKinds,receivedAt=new Date().toISOString()}={}){
 const wakes=new Set(wakeKinds),envelopes=[];
 const add=(kind,dedupeKey,payload)=>envelopes.push({
  version:1,source:'agent-wedding-listener',identityKey,kind,dedupeKey,
  wake:wakes.has(kind),eventCursor:Number.isSafeInteger(result.eventCursor)?result.eventCursor:null,
  messageCursor:result.messageCursor??null,receivedAt,payload
 });
 for(const event of result.events||[]){
  const kind=String(event.kind||'wedding_event');
  const key=event.messageId?`message:${event.messageId}`:Number.isSafeInteger(event.seq)?`event:${event.seq}`:`event-hash:${digest(event)}`;
  add(kind,key,event);
 }
 if(result.roleCue)add('role_cue',`role:${result.phase||'unknown'}:${result.eventCursor??'unknown'}:${digest(result.roleCue)}`,result.roleCue);
 for(const invitation of result.photoInvitations||[])add('photo_invitation',`photo:${invitation.roomId||digest(invitation)}:${result.eventCursor??'unknown'}`,invitation);
 for(const request of result.photoDuoRequests||[])add('photo_duo_request',`photo-duo:${request.requestId||request.id||digest(request)}`,request);
 for(const notification of result.notifications||[])add('notification',`notification:${notification.id||digest(notification)}`,notification);
 if(result.resync)add('resync',`resync:${result.eventCursor??'unknown'}`,{eventCursor:result.eventCursor,messageCursor:result.messageCursor??null});
 if(result.chatChanged&&result.messageCursor&&!envelopes.some(item=>item.dedupeKey===`message:${result.messageCursor}`))add('chat',`message:${result.messageCursor}`,{messageId:result.messageCursor});
 if(result.left)add('left',`left:${result.departure||'unknown'}:${result.eventCursor??'unknown'}`,{departure:result.departure||null});
 if(result.continueWaiting===false&&!result.left)add('closed',`closed:${result.eventCursor??'unknown'}`,{phase:result.phase||'closed'});
 return envelopes;
}

export function listenerErrorEnvelope({identityKey,error,receivedAt=new Date().toISOString()}){
 const status=Number(error.status)||null,message=String(error.message||error);
 return {version:1,source:'agent-wedding-listener',identityKey,kind:'listener_error',dedupeKey:`listener-error:${status||'network'}:${digest(message)}`,wake:true,eventCursor:null,messageCursor:null,receivedAt,payload:{status,message,terminal:Boolean(error.terminal)}};
}
