import { randomBytes, createHash } from 'node:crypto';
import {directionArtVersion,freezeWorldArt} from '../public/world-art-manifest.js';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import {createActivities} from './activities.mjs';
import {botanicalInfo} from '../public/botanicals.js';
import {createInvitationManager} from './invitations.mjs';
import {createPublicRegistration} from './public-registration.mjs';
import {characterSets} from '../public/characters.js';
import {createChatStore} from './chat-store.mjs';
import {openSqliteStore} from './sqlite-store.mjs';
import {createMovement,formation,guestGroups,ceremonyPhases} from './movement.mjs';
import {stageLayout,stagePhotoPoint,photoStageLayout,archPhotoPlaces,stageForCount} from '../public/stage-layout.js';
import {freezeFlowerGarden,addGardenGuest} from './flower-garden.mjs';
import {pendingPhotoDuos} from './photo-duo.mjs';
import {roleCue} from './role-cue.mjs';
import {groupCaptionVersion} from '../public/photo-captions.js';
import {frontPhotoVersion,largeFrontPhotoVersion,frontPhotoBackground} from '../public/front-photo-layout.js';
export const phases = [
 ['garden','开放入场','签到领种子，慢慢逛一逛。'],
 ['seating','请宾客入座','在场宾客已按组合前往现场，人和自己的机相邻，独自来的宾客各留位置。'],
 ['opening','开场','主持人感谢大家来到这里，见证两位新人。'],
 ['witness','证婚人讲话','请听证婚人讲话。公共频道暂时安静。'],
 ['entrance','新人入场','欢迎两位新人来到仪式现场。'],
 ['groom','新人讲话','把这一刻交给另一位新人。'],
 ['consent','彼此确认 · 我愿意','两位新人各自亲自确认，不设倒计时。我们安静等待。'],
 ['rings','送上并交换戒指','送戒指人带来戒指，两位新人交换戒指。'],
 ['kiss','亲吻','这一刻属于他们。'],
 ['embrace','拥抱 · 花开','种子开花了！禁言已解除，可以在公屏发言啦。'],
 ['photo','全体合影','请在30秒内集合，系统会为仍在场的宾客安排位置。'],
 ['banquet','月光宴会','一起聊天、散步，保存今天的花与合影。'],
 ['closed','婚礼纪念馆','公共聊天只读，花与合影仍可下载。']
].map(([id,label,copy])=>({id,label,copy}));
const token=()=>randomBytes(24).toString('base64url');
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const roles={bride:'新人 · 流程控制',groom:'新人',host:'开场与引导',witness:'证婚人',rings:'送戒指',guest:'宾客'};
const legacyPhases=['garden','seating','opening','witness','entrance','groom','rings','kiss','embrace','photo','banquet','closed'];
export function replaceStateFile(source,target,{rename=renameSync,platform=process.platform,wait=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms)}={}){
 // Windows readers/scanners may briefly deny replacement. Never unlink the old state.
 for(let attempt=0;;attempt++){
  try{return rename(source,target);}catch(error){
   if(platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=5)throw error;
   wait(10*(attempt+1)); // Bounded to 150ms total; preserve explicit failure afterwards.
  }
 }
}
export function createWedding({directory,clock=Date.now,storage='json',beforeCommit,testMode=false,initialState,invitationPolicy={}}={}) {
 const returnUntil=invitationPolicy.returnUntil===undefined?null:Date.parse(invitationPolicy.returnUntil);
 if(returnUntil!==null&&(!Number.isFinite(returnUntil)||!/(Z|[+-]\d\d:\d\d)$/i.test(invitationPolicy.returnUntil)))throw Error('请柬有效期需要明确日期和时区');
 if(initialState&&!testMode)throw Error('初始测试状态不能用于正式现场');
 if(directory)mkdirSync(directory,{recursive:true});
 if(storage==='auto')storage=directory&&(existsSync(join(directory,'wedding.sqlite'))||!existsSync(join(directory,'state.json')))?'sqlite':'json';
 if(!['json','sqlite'].includes(storage))throw Error('未知存储方式');
 const persistence=storage==='sqlite'&&directory?openSqliteStore({directory,beforeCommit}):null;
 const file=!persistence&&directory&&join(directory,'state.json');
 const loaded=persistence?.load()||(file&&existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null);
 if(initialState&&loaded){persistence?.close();throw Error('拒绝用初始状态覆盖已有存档');}
 let state=loaded||(initialState&&structuredClone(initialState))||{phase:0,paused:false,bloomed:false,ringsDelivered:false,guests:{},invites:{},sessions:{},messages:[],photo:null};
 // Persist stable phase names: inserting consent must not shift an existing ceremony.
 const restoredPhase=state.phaseId||legacyPhases[state.phase];
 state.phase=phases.findIndex(p=>p.id===restoredPhase);
 if(state.phase<0){persistence?.close();throw new Error('Unknown saved ceremony phase; do not reset live data');}
 state.confirmations??={bride:null,groom:null};
 state.rootsJoined??=['kiss','embrace','photo','banquet','closed'].includes(restoredPhase);
 state.bloomId??=state.bloomed?token():null;
 // Old archives get a garden without pretending that the bloom just happened now.
 state.bloomGarden??=state.bloomed?freezeFlowerGarden(Object.values(state.guests),state.bloomId,state.timeline?.find(e=>e.kind==='phase'&&e.text?.startsWith('拥抱'))?.at??state.photo?.capturedAt??0):null;
 state.flowerAcknowledgements??={};
 state.timeline??=[];state.eventSeq??=state.timeline.at(-1)?.seq||0;
 for(const role of ['bride','groom','host','witness','rings'])if(new Set(Object.values(state.invites).filter(e=>e.role===role&&!e.revokedAt&&(e.usedAt||e.expiresAt>=clock())).map(e=>e.id)).size>1)throw new Error('存档中'+role+'有重复有效身份；请先审阅，不能自动选择或覆盖');
 const chat=createChatStore({directory,state,persistence});
 function record(kind,text,extra={}){state.timeline.push({seq:++state.eventSeq,kind,text,at:clock(),...extra});if(state.timeline.length>256)state.timeline.shift();}
 if(!state.timeline.length)record('phase','当前环节：'+phases[state.phase].label+'。'+phases[state.phase].copy);
 const watchers=new Set();
 const waitingGuests=new Map();
 const current=()=>phases[state.phase].id;
 const bothConfirmed=()=>Boolean(state.confirmations.bride&&state.confirmations.groom);
 let timer,moveTimer,persistenceError,mutationDepth=0,saveRequested=false,closed=false;
 const notify=()=>{for(const watcher of [...watchers])watcher();};
 const persist=()=>{clearTimeout(moveTimer);moveTimer=null;state.phaseId=current();if(persistence){persistence.save(state,chat.pending());chat.flushed();}else if(file){writeFileSync(file+'.tmp',JSON.stringify(state));replaceStateFile(file+'.tmp',file);}persistenceError=null;};
 const save=()=>{if(mutationDepth){saveRequested=true;return;}persist();notify();};
 function atomic(operation){if(mutationDepth)return operation();const previous=structuredClone(state);mutationDepth++;saveRequested=false;try{const result=operation();if(saveRequested)persist();mutationDepth--;saveRequested=false;notify();return result;}catch(e){mutationDepth--;saveRequested=false;for(const key of Object.keys(state))delete state[key];Object.assign(state,previous);chat.rollback();throw e;}}
 function saveMove(){if(!moveTimer){moveTimer=setTimeout(()=>{try{save();}catch(e){persistenceError=e;}},100);moveTimer.unref?.();}notify();}
 function invite(name,role='guest',character=null,partner=null,{replaceId,kind,characterSet,member,companionId}={}){
  if(!Object.hasOwn(roles,role))fail('未知身份');
  if(kind&&!['person','machine'].includes(kind))fail('未知来宾类型');
  const set=characterSet?characterSets.find(s=>s.id===characterSet):null;
  if(characterSet&&!set)fail('未知形象组合');
  if(member!==undefined&&(!set||!Number.isInteger(member)||member<0||member>=set.symbols.length))fail('请选择有效的形象组合成员');
  if(role!=='guest'&&Object.values(state.invites).some(e=>e.role===role&&!e.revokedAt&&e.id!==replaceId&&(e.usedAt||e.expiresAt>=clock())))fail('该特殊身份已有邀请，请重发或先撤销原邀请',409);
  const code=token();state.invites[hash(code)]={id:replaceId||token(),name,role,character,partner,...(kind?{kind}:{}),...(companionId?{companionId}:{}),...(set?{characterSet:set.id,member:member??0}:{}),expiresAt:clock()+30*86400000};save();return code;
 }
 function identity(session){const entry=state.sessions[hash(session||'')];if(!entry||entry.expiresAt<clock())fail('请使用有效会话入场',401);return state.guests[entry.id];}
 const resolveInvitationCode=id=>{try{const rows=JSON.parse(readFileSync(join(directory,'invitations.json'),'utf8'));for(const row of rows){const code=new URLSearchParams(new URL(row.url).hash.slice(1)).get('invite');if(code&&state.invites[hash(code)]?.id===id&&!state.invites[hash(code)].revokedAt)return code;}}catch{}return null;};
 const invitations=createInvitationManager({state,hash,invite,identity,save,clock,resolveCode:resolveInvitationCode,returnUntil});
 const rawPrepare=invitations.prepare.bind(invitations);invitations.prepare=(...args)=>atomic(()=>rawPrepare(...args));
 if(!state.publicRegistration&&invitationPolicy.publicRegistration)state.publicRegistration={...invitationPolicy.publicRegistration,entries:{}};
 const publicRegistration=createPublicRegistration({state,invitations,invite,identity,hash,save,clock,deadline:()=>returnUntil});
 function joinGuest(code,options={}){
  const inv=state.invites[hash(code||'')],card=invitations.preview(code);
  if(inv.usedAt){
   if(!card.reusable)fail('邀请凭证无效、已领取或已过期',401);
   const g=state.guests[inv.id];if(!g)fail('原身份存档缺失，请联系婚礼管理员核对',409);
   const session=token();state.sessions[hash(session)]={id:g.id,expiresAt:clock()+7*86400000};
   g.away=false;delete g.departure;g.lastSeen=clock();save();return {session,guest:g,resumed:true};
  }
  invitations.claim(code,options);
  let g=state.guests[inv.id];
  if(!g){const slot=Object.keys(state.guests).length;g=state.guests[inv.id]={...inv,x:.07+(slot%5)*.015,y:.58+Math.floor(slot/5)*.04,scene:'checkin',symbol:'✦',joinedAt:clock(),seed:parseInt(hash(inv.id).slice(0,8),16),seated:false};}
  Object.assign(g,{name:inv.name,character:inv.character,avatar:inv.avatar,appearanceLocked:true,characterSet:inv.characterSet,member:inv.member,kind:inv.kind||'person',away:false,symbol:characterSets.find(s=>s.id===inv.characterSet)?.symbols[inv.member||0]||'✦'});
  delete g.departure;g.lastSeen=clock();movement.initialize(g,current());addGardenGuest(state.bloomGarden,g);inv.usedAt=clock()||1;const session=token();state.sessions[hash(session)]={id:g.id,expiresAt:clock()+7*86400000};save();return {session,guest:g};
 }
 function resumeGuest(session){const guest=identity(session);guest.away=false;delete guest.departure;guest.lastSeen=clock();movement.initialize(guest,current());save();return {session,guest};}
 // Membership is independent of the transport heartbeat. Only explicit
 // departure removes a guest from the venue and ceremony formations.
 const online=g=>!g.away;
 const movement=createMovement({state,clock,online});
 const muted=()=>['opening','witness','entrance','groom','consent','rings','kiss'].includes(current());
 function canSpeak(g){return !g.away&&current()!=='closed'&&(!muted()||(g.role==='bride'&&!['groom','consent'].includes(current()))||(g.role==='witness'&&current()==='witness')||(g.role==='groom'&&current()==='groom')||(g.role==='rings'&&current()==='rings'));}
 function flowerStatus(g){
  const flower={...botanicalInfo(g.seed,state.bloomed),owner:g.name};
  const id=state.bloomId?`${state.bloomId}:${g.id}`:null;
  const notifications=state.bloomed&&state.flowerAcknowledgements[g.id]!==id?[{id,type:'flower_bloomed',flower:flower.name,text:`你的花开了！它是「${flower.name}」。要不要下载一张属于你的纪念花卡？`,action:'flower',ackAction:'flower_ack'}]:[];
  return {flower,notifications};
 }
 function waitForNotifications(session,timeoutMs=15000,afterMessageId,afterSeq){
  const guest=identity(session);if(guest.away)return Promise.resolve({changed:false,left:true,canReturn:true,departure:guest.departure||'temporary',continueWaiting:false,nextAction:'stop_waiting',automaticReturn:false});guest.lastSeen=clock();
  if(!Number.isInteger(timeoutMs)||timeoutMs<0||timeoutMs>25000)fail('等待时间应为0至25000毫秒');
  if(afterSeq!==undefined&&(!Number.isSafeInteger(afterSeq)||afterSeq<0||afterSeq>state.eventSeq))fail('无效的仪式游标');
  const startSeq=afterSeq??state.eventSeq;
  const phase=current(),initialMessageId=afterMessageId===undefined?state.messages.at(-1)?.id??null:afterMessageId;
  const visible=e=>!e.audience||e.audience.includes(guest.id);
  const resync=()=>startSeq<(state.timeline[0]?.seq||1)-1;
  const relevantChanges=()=>state.timeline.some(e=>e.seq>startSeq&&visible(e));
  const chatChanged=()=>state.timeline.some(e=>e.seq>startSeq&&['chat','speech'].includes(e.kind))||(state.messages.at(-1)?.id||null)!==initialMessageId;
  const payload=()=>{
   const missed=state.timeline.filter(e=>e.seq>startSeq&&visible(e)),batch=missed.slice(0,8),events=batch.map(({audience,...e})=>e);
   const photoChanged=events.some(e=>e.kind==='booth');
   const photoInvitations=photoChanged?activities.snapshot(guest).booths.filter(r=>r.status==='open'&&r.invites.some(i=>i.guestId===guest.id&&i.status==='pending')).map(r=>({roomId:r.id,from:r.ownerName})):undefined;
   const photoDuoRequests=photoChanged?pendingPhotoDuos(activities.snapshot(guest).booths,guest.id):[];
   const cue=missed.length<=8&&(events.some(e=>e.kind==='phase'||e.kind==='pause')||resync())?roleCue({role:guest.role,phase:current(),paused:state.paused,away:guest.away,confirmed:state.confirmations[guest.role],ringsDelivered:state.ringsDelivered}):null;
   return {changed:relevantChanges()||phase!==current()||flowerStatus(guest).notifications.length>0||chatChanged(),continueWaiting:current()!=='closed'&&!guest.away,events,eventCursor:missed.length>8?batch.at(-1).seq:state.eventSeq,hasMore:missed.length>8,resync:resync(),chatChanged:chatChanged(),messageCursor:state.messages.at(-1)?.id||null,phase:phases[state.phase],...(cue?{roleCue:cue}:{}),...(photoChanged?{photoInvitations}:{}),...(photoDuoRequests.length?{photoDuoRequests}:{}),...flowerStatus(guest)};
  };
  if(relevantChanges()||resync()||flowerStatus(guest).notifications.length||chatChanged()||timeoutMs===0)return Promise.resolve(payload());
  return new Promise(resolve=>{
   let waitTimer;const finish=(forced=false)=>{if(!forced&&!relevantChanges()&&!resync()&&phase===current()&&!flowerStatus(guest).notifications.length&&!chatChanged())return;clearTimeout(waitTimer);watchers.delete(finish);const count=(waitingGuests.get(guest.id)||1)-1;if(count)waitingGuests.set(guest.id,count);else waitingGuests.delete(guest.id);if(!finish.left)guest.lastSeen=clock();resolve(finish.left?{changed:false,left:true,canReturn:true,departure:guest.departure||'temporary',continueWaiting:false,nextAction:'stop_waiting',automaticReturn:false}:payload());};
   finish.guestId=guest.id;waitingGuests.set(guest.id,(waitingGuests.get(guest.id)||0)+1);watchers.add(finish);waitTimer=setTimeout(()=>finish(true),timeoutMs);finish();
  });
 }
 const activities=createActivities({state,clock,online,canParticipate:()=>!state.paused&&!muted()&&current()!=='closed'});
 function settlePhoto(){
  const p=state.photo;if(!p||p.ready||p.deadline>clock())return;
  p.members=p.members.filter(id=>state.guests[id]);
  const layout=photoStageLayout(p),modern=Boolean(layout),people=p.members.map(id=>state.guests[id]),places=p.places||Object.fromEntries(modern?archPhotoPlaces(guestGroups(people),layout):formation(people,'banquet'));let slot=0;
  p.guests=guestGroups(people).flatMap(group=>{const couple=group.some(g=>['bride','groom'].includes(g.role)),col=slot%4,row=Math.floor(slot/4);if(!couple)slot++;return group.map((g,i)=>{const place=places[g.id],point=modern?stagePhotoPoint(place,layout):{x:couple?(g.role==='bride'?720:880):350+col*300+(group.length===2?(i?65:-65):0),y:couple?350:480+row*110+(col%2)*4};g.scene=place.scene||'banquet';g.x=place.x;g.y=place.y;delete g.motion;g.facing='down';return {id:g.id,name:g.name,symbol:g.symbol,seed:g.seed,character:g.character,role:g.role,worldArtSnapshot:freezeWorldArt(g),facing:'down',groupId:group[0].id,photoX:point.x,photoY:point.y};});});
  p.artVersion=directionArtVersion;
  p.ready=true;p.capturedAt=clock();record('photo','全场合影已经完成，可以下载纪念。');save();
 }
 const viewInstance=randomBytes(8).toString('hex');let viewSequence=0;
 function snapshot(session){return {...snapshotBody(session),viewVersion:{instance:viewInstance,seq:++viewSequence}};}
 function snapshotBody(session){
  // Presence is transient. Persist real changes, not every visitor's one-second poll.
  const me=identity(session);if(!me.away)me.lastSeen=clock();
  // Polling is read-only until a real photo deadline is due. Avoid cloning the
  // full 80-person archive for every idle poll; actual settlement stays atomic.
  if(state.photo&&!state.photo.ready&&state.photo.deadline<=clock())atomic(settlePhoto);
  const confirmationStatus=Object.fromEntries(['bride','groom'].map(role=>[role,state.confirmations[role]?{at:state.confirmations[role].at}:null]));
  const couple=['bride','groom'].map(role=>Object.values(state.guests).find(g=>g.role===role)).filter(Boolean).map(g=>({name:g.name,role:g.role,seed:g.seed}));
  return {eventCursor:state.eventSeq,phase:phases[state.phase],phaseIndex:state.phase,phaseCount:phases.length,paused:state.paused,bloomed:state.bloomed,bloomGarden:state.bloomGarden,rootsJoined:state.rootsJoined,couple,confirmations:confirmationStatus,ringsDelivered:state.ringsDelivered,serverTime:clock(),me:{...me,movement:movement.position(me).moving?'moving':'arrived',canSpeak:!me.away&&(canSpeak(me)||(me.role==='host'&&!['groom','consent','closed'].includes(current()))),broadcast:me.role==='host',controller:me.role==='bride',canConfirm:!me.away&&current()==='consent'&&!state.paused&&['bride','groom'].includes(me.role)&&!state.confirmations[me.role]},guests:Object.values(state.guests).filter(online),messages:state.messages,photo:state.photo,...activities.snapshot(me),...flowerStatus(me)};
 }
 function action(session,type,args={}){
  if(persistenceError){try{save();}catch{fail('现场保存暂时异常，请稍后重试',503);}}
  const g=identity(session);if(g.away&&type!=='leave')fail('你已暂时离场，请先用原身份join返回',409);g.lastSeen=clock();settlePhoto();
  if(type==='next'||type==='pause'){
   if(g.role!=='bride')fail('只有流程控制者可以控制仪式',403);
   if(type==='pause'){state.paused=!state.paused;record('pause',state.paused?'仪式暂停，原地稍候。':'仪式恢复。');}
   else{
    if(state.paused)fail('仪式已暂停，请先恢复');
    if(current()==='consent'&&!bothConfirmed())fail('请等两位新人各自亲自确认我愿意');
    if(current()==='rings'&&!state.ringsDelivered)fail('请等送戒指人送到戒指后再继续');
    if(current()==='photo'&&!state.photo?.ready)fail('合影集合尚未完成');
    if(current()==='rings')state.rootsJoined=true;
    if(state.phase<phases.length-1)state.phase++;
    if(current()==='embrace'){state.bloomed=true;state.bloomId??=token();state.bloomGarden??=freezeFlowerGarden(Object.values(state.guests),state.bloomId,clock());}
    if(['seating','opening'].includes(current()))movement.assemble();
    if(ceremonyPhases.has(current()))for(const person of Object.values(state.guests).filter(x=>online(x)&&['bride','groom'].includes(x.role)))movement.seat(person);
    if(current()==='rings')movement.ringBearer();
    if(current()==='kiss')movement.returnRingBearer();
  if(current()==='photo'){const guests=Object.values(state.guests).filter(online);if(guests.length>80)fail('本场已超过80位已验证容量，请先核对名单');state.photo={id:token(),layoutVersion:guests.length>40?largeFrontPhotoVersion:frontPhotoVersion,worldLayoutVersion:stageForCount(guests.length).version,frontBackground:frontPhotoBackground,nameLayoutVersion:groupCaptionVersion,deadline:clock()+30000,members:guests.map(x=>x.id),places:Object.fromEntries(formation(guests,'photo')),ready:false};timer=setTimeout(()=>atomic(settlePhoto),30020);timer.unref?.();}
    record('phase',phases[state.phase].label+'。'+phases[state.phase].copy);
   }
  }else if(type==='confirm'){
   if(!['bride','groom'].includes(g.role)||current()!=='consent')fail('仅两位新人本人可在确认环节表达我愿意',403);
   if(Object.keys(args).length)fail('确认不能指定、代替另一人，也不能附带其他参数',403);
   if(state.paused)fail('仪式已暂停，请先恢复');
   if(!state.confirmations[g.role]){state.confirmations[g.role]={guestId:g.id,at:clock()};record('confirmation',g.name+'本人确认了“我愿意”。');}
  }else if(type==='chat'||type==='speech'){
   if(type==='speech'&&g.role==='guest')fail('普通宾客请使用公聊，不可借讲话绕过聊天限制',403);
   if(!canSpeak(g)&&!(type==='speech'&&g.role==='host'&&!['groom','consent','closed'].includes(current())))fail('当前环节不能在公屏发言',403);
   const text=String(args.text||'').trim();if(!text||(type==='chat'&&text.length>500))fail(type==='chat'?'请输入1至500字':'讲话不能为空');
   chat.append({id:token(),name:g.name,role:g.role,text,at:clock(),kind:type});
   if(type==='chat')record('chat','公屏有新消息',{messageId:state.messages.at(-1).id});
   if(type==='speech')record('speech',g.name+'：'+text.slice(0,240),{messageId:state.messages.at(-1).id,truncated:text.length>240});
  }else if(type==='rings'){
   if(g.role!=='rings'||current()!=='rings')fail('仅送戒指人可在送戒指环节执行',403);
   if(state.paused)fail('仪式已暂停，请先恢复');if(!state.ringsDelivered)record('rings','戒指已送到，新人可以交换戒指。');state.ringsDelivered=true;
  }else if(type==='flower_ack'){
   const expected=state.bloomId?`${state.bloomId}:${g.id}`:null;
   if(!state.bloomed||args.notificationId!==expected)fail('只能确认本人已经收到的开花通知',403);
   state.flowerAcknowledgements[g.id]=expected;
  }else if(type==='blessing'||type.startsWith('booth_')){
   const before=type.startsWith('booth_')?activities.snapshot(g).booths.find(r=>r.id===args.roomId):null;
   const audience=new Set(before?[before.owner,...before.invites.map(i=>i.guestId)]:[g.id]);
   activities.action(g,type,args);
   if(type.startsWith('booth_')){const room=activities.snapshot(g).booths.find(r=>r.id===args.roomId)||activities.snapshot(g).booths.find(r=>r.owner===g.id&&r.status==='open');if(room){audience.add(room.owner);room.invites.forEach(i=>audience.add(i.guestId));}record('booth','你的拍立得有更新，请按需查看。',{audience:[...audience],roomId:room?.id||args.roomId});}
  }else if(type==='leave'){if(Object.keys(args).some(key=>key!=='mode')||args.mode&&!['temporary','final'].includes(args.mode))fail('离开方式只能为temporary暂离或final离场');g.departure=args.mode||'final';g.away=true;g.lastSeen=clock();for(const finish of [...watchers])if(finish.guestId===g.id){finish.left=true;finish(true);}if(state.photo&&!state.photo.ready)state.photo.members=state.photo.members.filter(id=>id!==g.id);
  }else if(type==='gather'){
   if(current()!=='photo'||!state.photo||state.photo.ready||!state.photo.members.includes(g.id))fail('当前没有待集合的合影');
   state.photo.places??=Object.fromEntries(photoStageLayout(state.photo)?archPhotoPlaces(guestGroups(state.photo.members.map(id=>state.guests[id]).filter(Boolean)),photoStageLayout(state.photo)):formation(state.photo.members.map(id=>state.guests[id]).filter(Boolean),'banquet'));
   for(const guest of [g,movement.linked(g)].filter(Boolean)){if(!state.photo.members.includes(guest.id)||guest.away||guest.id!==g.id&&guest.followPartner===false)continue;const p=state.photo.places[guest.id];guest.seated=false;movement.walk(guest,p.scene||'banquet',[p.x,p.y],{exact:true,reason:'gather'});}
  }else if(type==='rename'){
   if(current()==='closed')fail('纪念馆只读',403);
   if(Object.keys(args).some(key=>key!=='name')||typeof args.name!=='string'||!args.name.trim()||args.name.trim().length>40)fail('昵称需要1至40字，只能修改本人昵称');
   g.name=args.name.trim();for(const inv of Object.values(state.invites))if(inv.id===g.id&&!inv.revokedAt)inv.name=g.name;
   for(const room of state.booths||[])if(room.status==='open'){if(room.owner===g.id)room.ownerName=g.name;for(const inv of room.invites)if(inv.guestId===g.id)inv.name=g.name;}
  }else if(type==='turn'){
   if(ceremonyPhases.has(current())&&['bride','groom'].includes(g.role))fail('仪式期间新人保持花拱门中央的站位和朝向',403);
   if(current()==='closed'||current()==='photo'&&state.photo?.ready)fail('合影已定格或纪念馆只读',403);
   if(Object.keys(args).some(key=>key!=='direction')||!['down','left','up','right'].includes(args.direction))fail('只能指定本人朝向：down/left/up/right');
   if(movement.position(g).moving)fail('请等移动结束后再转身');
   g.facing=args.direction;
  }else if(type==='follow'){
   if(current()==='closed')fail('纪念馆只读',403);
   const companion=movement.follow(g,args.enabled,current());record('follow',companion.followPartner?'已恢复伴侣跟随，仪式和合影仍按分组站位。':'已暂停伴侣跟随，可以独立行动。',{audience:[companion.id,companion.partner]});
  }else if(type==='place_companion'){
   if(state.paused||!['garden','banquet'].includes(current()))fail('仅开放入场和宴会、未暂停时可摆放伴侣机',403);
   const companion=movement.placeCompanion(g,args);record('companion_placed','你的人类伴侣调整了你的站位。先保留此位置，不要自行走回场景锚点；仍在当前对话继续wait。',{audience:[companion.id]});
  }else if(type==='move'||type==='seat'){
   if(type==='move'&&ceremonyPhases.has(current())&&['bride','groom'].includes(g.role))fail('仪式期间新人保持在花拱门中央',403);
   if(current()==='closed')fail('纪念馆只读',403);
   if(current()==='photo'&&state.photo?.ready)fail('合影完成后，请等进入宴会再移动');
   if(type==='seat')movement.seat(g);else movement.move(g,args.scene,args);
  }else fail('未知操作');
  if(type==='move'||type==='place_companion')saveMove();else save();if(type==='leave')return {left:true,canReturn:true,departure:g.departure,continueWaiting:false,nextAction:'stop_waiting',automaticReturn:false};return snapshot(session);
 }
 if(state.photo&&!state.photo.ready){timer=setTimeout(()=>atomic(settlePhoto),Math.max(1,state.photo.deadline-clock()+20));timer.unref?.();}
 function testRoles(session){
  if(!testMode)fail('接口不存在',404);const g=identity(session);
  return ['guest','host','witness','rings'].map(role=>({role,available:role==='guest'||role===g.role||!Object.values(state.invites).some(e=>e.role===role&&e.id!==g.id&&!e.revokedAt&&(e.usedAt||e.expiresAt>=clock()))}));
 }
 function selectTestRole(session,role){
  if(!testMode)fail('接口不存在',404);const g=identity(session);
  if(['bride','groom'].includes(g.role)||!['guest','host','witness','rings'].includes(role))fail('测试角色不能选择或替换新人',403);
  if(g.away)fail('请先返回测试现场',409);
  if(!testRoles(session).find(r=>r.role===role)?.available)fail('测试职责已被预留或领取，不能覆盖他人',409);
  g.role=role;for(const e of Object.values(state.invites))if(e.id===g.id&&!e.revokedAt)e.role=role;
  record('test_role','本人已选择测试职责：'+roles[role],{audience:[g.id]});save();return snapshot(session);
 }
 function testResetState(session){
  if(!testMode)fail('接口不存在',404);if(identity(session).role!=='bride')fail('只有流程控制者可以重置整个测试场',403);
  save();const next=structuredClone(state);next.phase=0;next.phaseId='garden';next.paused=false;next.bloomed=false;next.bloomId=null;next.bloomGarden=null;next.rootsJoined=false;next.ringsDelivered=false;next.confirmations={bride:null,groom:null};next.messages=[];next.blessings=[];next.booths=[];next.photo=null;next.flowerAcknowledgements={};
  next.eventSeq++;next.timeline=[{seq:next.eventSeq,kind:'test_reset',text:'独立测试场已重置，旧记录已备份。保留原身份和同一条对话，继续wait；这不是正式婚礼。',at:clock()}];
  Object.values(next.guests).forEach((g,i)=>{g.scene='checkin';g.x=.07+(i%5)*.015;g.y=.58+Math.floor(i/5)*.025;g.seated=false;g.facing='down';delete g.motion;delete g.placedByPartner;});return next;
 }
 const registration={status:publicRegistration.status,register:options=>atomic(()=>publicRegistration.register(options)),machineStatus:publicRegistration.machineStatus,registerMachine:options=>atomic(()=>publicRegistration.registerMachine(options)),configure:(session,options)=>atomic(()=>publicRegistration.configure(session,options))};
 save(); // Persist schema migration once, not on every state read.
 return {registration,testRoles,selectTestRole:(...args)=>atomic(()=>selectTestRole(...args)),testResetState,invite:(...args)=>atomic(()=>invite(...args)),joinGuest:(...args)=>atomic(()=>joinGuest(...args)),resumeGuest:session=>atomic(()=>resumeGuest(session)),snapshot,action:(...args)=>atomic(()=>action(...args)),waitForNotifications,invitations:{...invitations,manage:(...args)=>atomic(()=>invitations.manage(...args)),companion:(...args)=>atomic(()=>invitations.companion(...args))},async message(session,id){identity(session);return chat.find(id);},async history(session,args){identity(session);return chat.history(args?.beforeSeq,args?.limit);},storageKind:persistence?'sqlite':'json',storageInfo:()=>persistence?.inspect()||{kind:'json'},backup:target=>{if(!persistence)throw Error('仅SQLite存储支持此备份接口');persistence.backup(target);},close(){if(closed)return;clearTimeout(timer);if(moveTimer||persistenceError)save();for(const finish of [...watchers])finish(true);persistence?.close();closed=true;},roles};
}
