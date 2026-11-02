import {characterSets,roleNotes} from '../public/characters.js';
import {validateAvatar} from '../public/avatar-options.js';
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
const fail=(text,status=400)=>{throw Object.assign(new Error(text),{status});};
const cleanName=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>40)fail('称呼需要1至40字');return value.trim();};
export function createInvitationManager({state,hash,invite,identity,save,clock,resolveCode=()=>null,returnUntil=null}){
 const reusable=e=>returnUntil!==null&&clock()<returnUntil&&!e.revokedAt&&e.expiresAt>=clock();
 const find=code=>{const entry=state.invites[hash(code||'')];if(!entry||entry.revokedAt||entry.expiresAt<clock()||returnUntil!==null&&clock()>=returnUntil)fail('邀请无效、已撤销或已过期',401);return entry;};
 const view=e=>({id:e.id,name:state.guests[e.id]?.name||e.name,role:e.role,kind:e.kind||'person',characterSet:e.characterSet||null,member:e.member||0,avatar:e.avatar||null,partner:e.partner||null,companionId:e.companionId||null,prepared:Boolean(e.preparedAt),used:Boolean(e.usedAt),reusable:reusable(e),revoked:Boolean(e.revokedAt),expired:e.expiresAt<clock(),expiresAt:returnUntil===null?e.expiresAt:Math.min(e.expiresAt,returnUntil),roleNote:roleNotes[e.role]});
 function seal(code,value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update('companion-preparation:'+code).digest(),iv),data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return {iv:iv.toString('base64'),data:data.toString('base64'),tag:cipher.getAuthTag().toString('base64')};}
 function unseal(code,value){try{const cipher=createDecipheriv('aes-256-gcm',createHash('sha256').update('companion-preparation:'+code).digest(),Buffer.from(value.iv,'base64'));cipher.setAuthTag(Buffer.from(value.tag,'base64'));return Buffer.concat([cipher.update(Buffer.from(value.data,'base64')),cipher.final()]).toString('utf8');}catch{return null;}}
 const admin=session=>{if(identity(session).role!=='bride')fail('只有流程控制者可以管理邀请',403);};
 function revoke(e){e.revokedAt=clock()||1;for(const [key,s]of Object.entries(state.sessions))if(s.id===e.id)delete state.sessions[key];if(state.guests[e.id]){state.guests[e.id].away=true;state.guests[e.id].departure='final';}}
 function reissue(e){const code=invite(e.name,e.role,e.character,e.partner,{replaceId:e.id}),replacement=find(code);Object.assign(replacement,{...e,expiresAt:clock()+30*86400000,usedAt:undefined,revokedAt:undefined});revoke(e);save();return {...view(replacement),invite:code};}
 function create(options={},partner=null){
  const name=cleanName(options.name),role=options.role||'guest',kind=options.kind||'person';
  if(!['guest','host','witness','rings'].includes(role))fail('新建邀请仅支持宾客、主持、证婚和送戒指；新人请重发已有邀请');
  if(!['person','machine'].includes(kind))fail('未知来宾类型');
  const set=options.characterSet?characterSets.find(s=>s.id===options.characterSet):null;if(options.characterSet&&!set)fail('未知形象组合');
   const member=options.member??(partner?1:0);if(!Number.isInteger(member)||member<0||member>=(set?.symbols.length||2))fail('请选择有效的组合成员');
   const avatar=options.avatar?validateAvatar(options.avatar):null;
   const code=invite(name,role,null,partner),e=find(code);Object.assign(e,{kind,characterSet:set?.id||null,member,avatar});save();return {...view(e),invite:code};
 }
 return {
  preview(code){return view(find(code));},
  prepare(code,options={}){
   const owner=find(code);if(owner.usedAt&&!reusable(owner))fail('请柬已在现场使用，请沿用原设备；不会覆盖已有签到',409);
   // A reusable used ticket is a read-only preparation/recovery, not a new claim.
   if(!owner.usedAt)this.claim(code,options);owner.preparedAt??=clock()||1;
   let companion=null;
   if((owner.kind||'person')==='person'&&!owner.partner&&(options.companionName||owner.companionId)){
    if(owner.companionId){
     const previous=Object.values(state.invites).find(e=>e.id===owner.companionId&&!e.revokedAt);
     if(!previous||previous.kind!=='machine'||previous.partner!==owner.id)fail('已有配对不一致，请联系婚礼管理员核对，不自动改绑',409);
     const ticket=owner.companionTicket?unseal(code,owner.companionTicket):resolveCode(previous.id);
     companion={...view(previous),...(ticket&&state.invites[hash(ticket)]===previous?{invite:ticket}:{needsOriginalInvite:true})};
    }else if(!owner.usedAt){
     const independent=characterSets.find(s=>s.id===owner.characterSet)?.independent;
     companion=create({name:cleanName(options.companionName),role:'guest',kind:'machine',characterSet:independent?'garden':owner.characterSet||'garden',member:owner.character?.custom&&!independent?1-owner.member:1},owner.id);
     owner.companionId=companion.id;owner.companionTicket=seal(code,companion.invite);
    }
   }
   save();return {invitation:view(owner),companion};
  },
  claim(code,options={}){
   const e=find(code);if(e.usedAt)fail('邀请已领取；请用原设备返回，或联系婚礼管理员重发',401);
   const requested=options.characterSet||e.characterSet||'garden',set=characterSets.find(s=>s.id===requested);
   const bound=characterSets.find(s=>s.id===e.characterSet);
   if(!set||set.custom&&bound?.id!==set.id||bound?.custom&&bound.id!==set.id)fail('请使用邀请指定的形象，或选择通用组合');
   const member=options.member??e.member??0;if(!Number.isInteger(member)||member<0||member>=set.symbols.length)fail('请选择有效的组合成员');
   if(bound?.custom&&member!==(e.member||0))fail('专属形象成员由邀请指定');
   const name=options.name!==undefined?cleanName(options.name):e.name;
   const avatar=bound?.custom?null:validateAvatar(e.avatar||options.avatar||{});
   if(e.appearanceLocked&&(requested!==e.characterSet||member!==e.member||options.avatar&&!bound?.custom&&JSON.stringify(validateAvatar(options.avatar))!==JSON.stringify(e.avatar)))fail('形象已经锁定，请保持原来的外观');
   if(e.appearanceLocked&&JSON.stringify(avatar)!==JSON.stringify(e.avatar))fail('形象已经锁定，请保持原来的外观');
   Object.assign(e,{name,characterSet:set.id,member,avatar,appearanceLocked:true,character:{set:set.id,member,custom:Boolean(set.custom),avatar}});
   return e;
  },
  list(session){admin(session);return Object.values(state.invites).filter(e=>!e.revokedAt).map(view);},
  manage(session,operation,options={}){
   admin(session);
   if(operation==='pair'||operation==='unpair'){
    const active=id=>Object.values(state.invites).find(e=>e.id===id&&!e.revokedAt&&e.expiresAt>=clock());
    const human=active(options.humanId),machine=active(options.machineId);
    if(!human||!machine)fail('请选择两份有效的已有邀请');
    if((human.kind||'person')!=='person'||machine.kind!=='machine'||human.id===machine.id)fail('必须明确选择一位人类和一位机');
    if([human.role,machine.role].some(role=>['bride','groom'].includes(role)))fail('新人按既有婚礼身份相邻，不在这里改绑');
    const owner=state.guests[human.id]||human,partner=state.guests[machine.id]||machine;
    if(operation==='unpair'){
     if(owner.companionId!==machine.id||partner.partner!==human.id)fail('选中的双方不是当前配对，不能解除其他绑定');
     for(const entry of Object.values(state.invites))if(!entry.revokedAt){if(entry.id===human.id)delete entry.companionId;if(entry.id===machine.id)delete entry.partner;}
     if(state.guests[human.id])delete state.guests[human.id].companionId;
     if(state.guests[machine.id]){delete state.guests[machine.id].partner;state.guests[machine.id].followPartner=false;}
     save();return {unpaired:true,humanId:human.id,machineId:machine.id};
    }
    if(owner.companionId&&owner.companionId!==machine.id||human.companionId&&human.companionId!==machine.id||partner.partner&&partner.partner!==human.id||machine.partner&&machine.partner!==human.id)fail('已有其他配对，请先核对原绑定，不能覆盖');
    for(const entry of Object.values(state.invites))if(!entry.revokedAt){if(entry.id===human.id)entry.companionId=machine.id;if(entry.id===machine.id)entry.partner=human.id;}
    if(state.guests[human.id])state.guests[human.id].companionId=machine.id;
    if(state.guests[machine.id]){state.guests[machine.id].partner=human.id;state.guests[machine.id].followPartner??=true;}
    save();return {paired:true,humanId:human.id,machineId:machine.id};
   }
   if(operation==='create')return create(options);
   const e=Object.values(state.invites).find(e=>e.id===options.id&&!e.revokedAt);if(!e)fail('未找到邀请',404);
   if(e.id===identity(session).id)fail('不能在这里撤销或重发你当前的控制身份');
   if(operation==='revoke'){revoke(e);save();return {revoked:true};}
   if(operation==='reissue')return reissue(e);
   fail('未知邀请管理操作');
  },
  companion(session,options={}){
   const owner=identity(session);if(owner.kind==='machine'||owner.partner)fail('此身份不能再次邀请伴侣机');
   if(options.operation==='revoke'||options.operation==='reissue'){
    const previous=Object.values(state.invites).find(e=>e.id===owner.companionId&&!e.revokedAt);if(!previous)fail('没有可管理的伴侣邀请');
    if(options.operation==='reissue')return reissue(previous);
    revoke(previous);delete owner.companionId;for(const entry of Object.values(state.invites))if(entry.id===owner.id&&!entry.revokedAt)delete entry.companionId;save();return {revoked:true};
   }else if(owner.companionId)fail('已经创建伴侣邀请，请重发或撤销原邀请');
   const independent=characterSets.find(s=>s.id===owner.characterSet)?.independent;
   const created=create({name:options.name||'伴侣机',role:'guest',kind:'machine',characterSet:independent?'garden':owner.characterSet||'garden',member:owner.character?.custom&&!independent?1-owner.member:1},owner.id);
   owner.companionId=created.id;save();return created;
  }
 };
}
