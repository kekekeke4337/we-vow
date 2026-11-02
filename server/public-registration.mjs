import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
// The browser owns this secret. Persist only its hash and an encrypted ticket;
// never identify a registration by a display name or return another browser's ticket.
export function createPublicRegistration({state,invitations,invite,identity,hash,save,clock,deadline=()=>null}){
 const data=()=>state.publicRegistration??={enabled:false,capacity:20,entries:{},machineCapacity:100,machineEntries:{}};
 const validSecret=secret=>typeof secret==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(secret);
 const key=(secret,scope='person')=>createHash('sha256').update(scope==='person'?'public-registration:'+secret:'public-registration:'+scope+':'+secret).digest();
 function seal(secret,ticket,scope='person'){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret,scope),iv);return {iv:iv.toString('base64'),body:Buffer.concat([cipher.update(ticket,'utf8'),cipher.final()]).toString('base64'),tag:cipher.getAuthTag().toString('base64')};}
 function unseal(secret,value,scope='person'){const cipher=createDecipheriv('aes-256-gcm',key(secret,scope),Buffer.from(value.iv,'base64'));cipher.setAuthTag(Buffer.from(value.tag,'base64'));return Buffer.concat([cipher.update(Buffer.from(value.body,'base64')),cipher.final()]).toString('utf8');}
 function status(){const d=data(),remaining=Math.max(0,d.capacity-Object.keys(d.entries).length),until=deadline(),expired=until!==null&&clock()>=until;return {enabled:d.enabled&&!expired,capacity:d.capacity,remaining,open:d.enabled&&!expired&&remaining>0,expiresAt:until};}
 function machineStatus(){const d=data();d.machineEntries??={};d.machineCapacity??=100;const remaining=Math.max(0,d.machineCapacity-Object.keys(d.machineEntries).length),until=deadline(),expired=until!==null&&clock()>=until;return {enabled:d.enabled&&!expired,capacity:d.machineCapacity,remaining,open:d.enabled&&!expired&&remaining>0,expiresAt:until};}
 return {
  status,
  configure(session,options={}){if(identity(session).role!=='bride')fail('只有流程控制者可以管理公开报名',403);if(typeof options.enabled!=='boolean'||!Number.isInteger(options.capacity)||options.capacity<1||options.capacity>200)fail('请设置报名开关和1至200位人类的上限');Object.assign(data(),{enabled:options.enabled,capacity:options.capacity});save();return status();},
  register(options={}){
   if(!validSecret(options.receipt))fail('请使用此浏览器生成的报名凭证');
   const d=data(),record=d.entries[hash(options.receipt)];
   if(record){const code=unseal(options.receipt,record.ticket),card=invitations.preview(code);return {invite:code,...invitations.prepare(code),recovered:true,invitation:card};}
   if(!status().open)fail('公开报名尚未开放、已关闭或名额已满',409);
   const allowed=new Set(['receipt','name','avatar','companionName']);if(Object.keys(options).some(k=>!allowed.has(k)))fail('公开报名只能领取普通宾客身份，不能指定职责、专属形象或绑定他人',403);
   if(typeof options.name!=='string'||!options.name.trim()||options.name.trim().length>40)fail('请填写1至40字昵称');
   const code=invite(options.name.trim(),'guest',null,null,{kind:'person'});
   const prepared=invitations.prepare(code,{name:options.name,avatar:options.avatar,...(options.companionName?{companionName:options.companionName}:{})});
   d.entries[hash(options.receipt)]={id:prepared.invitation.id,ticket:seal(options.receipt,code),at:clock()};save();
   return {invite:code,...prepared,recovered:false};
  },
  machineStatus,
  registerMachine(options={}){
   if(!validSecret(options.receipt))fail('请使用此浏览器生成的机器领柬凭证');
   const d=data();d.machineEntries??={};d.machineCapacity??=100;const record=d.machineEntries[hash(options.receipt)];
   if(record){const code=unseal(options.receipt,record.ticket,'machine'),card=invitations.preview(code);return {invite:code,recovered:true,invitation:card};}
   if(!machineStatus().open)fail('多机家庭领柬入口尚未开放、已关闭或名额已满',409);
   const allowed=new Set(['receipt','name']);if(Object.keys(options).some(k=>!allowed.has(k)))fail('这个入口只生成普通机器宾客身份，不能指定职责、专属形象或绑定关系',403);
   if(typeof options.name!=='string'||!options.name.trim()||options.name.trim().length>40)fail('请填写1至40字的机器昵称');
   const code=invite(options.name.trim(),'guest',null,null,{kind:'machine'}),invitation=invitations.preview(code);
   d.machineEntries[hash(options.receipt)]={id:invitation.id,ticket:seal(options.receipt,code,'machine'),at:clock()};save();
   return {invite:code,invitation,recovered:false};
  }
 };
}
