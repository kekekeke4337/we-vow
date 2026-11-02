import {createHash,randomBytes} from 'node:crypto';
import {rehearsalProfiles} from '../public/rehearsal-profiles.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(24).toString('base64url');

// Offline, explicit maintenance only. Never called by public registration.
// The caller must back up and stop the formal writer before persisting this clone.
export function prepareFormalRoster(original,originalLinks,{now=Date.now(),origin='https://wedding.example',renew=false}={}){
 const state=structuredClone(original),links=structuredClone(originalLinks),cards=[],matched=new Set();
 for(const p of rehearsalProfiles){
  const candidates=Object.entries(state.invites).filter(([,e])=>!e.revokedAt&&
   (p.role!=='guest'?e.role===p.role:e.role==='guest'&&(e.name===p.name||e.characterSet===p.characterSet&&e.member===p.member)));
  if(candidates.length>1)throw Error('重复专属身份：'+p.name);
  let key,e,code,created=false;
  if(candidates.length){
   [key,e]=candidates[0];
   if(matched.has(e.id))throw Error('同一身份被重复匹配');
   const row=links.find(row=>{const raw=new URLSearchParams(new URL(row.url).hash.slice(1)).get('invite');return raw&&hash(raw)===key;});
   if(!row)throw Error('原请柬缺失，拒绝隐式重发：'+p.name);
   code=new URLSearchParams(new URL(row.url).hash.slice(1)).get('invite');
   if(e.expiresAt<now)throw Error('原请柬已过期，需明确重发：'+p.name);
  }else{
   created=true;code=token();key=hash(code);e={id:token(),expiresAt:now+30*86400000};state.invites[key]=e;
   links.push({name:p.name,role:p.role,url:origin+'/#invite='+code});
  }
  matched.add(e.id);
  if(renew&&!created){
   const old=e;code=token();key=hash(code);e={...old,expiresAt:now+30*86400000};
   delete e.revokedAt;delete e.companionTicket;
   old.revokedAt=now;state.invites[key]=e;
   for(const [session,value]of Object.entries(state.sessions||{}))if(value.id===e.id)delete state.sessions[session];
   links.push({name:p.name,role:p.role,url:origin+'/#invite='+code});
  }
  if(e.partner||e.companionId){
   // Reconciled below after every stable ID has been resolved.
   if(!p.pair)throw Error('独立身份存在待审配对：'+p.name);
  }
  Object.assign(e,{name:p.name,role:p.role,kind:p.kind,characterSet:p.characterSet,member:p.member});
  if(!e.usedAt)e.character={...p.character};
  // Existing signed-in appearance and nickname are not overwritten.
  if(state.guests[e.id])Object.assign(state.guests[e.id],{kind:p.kind});
  const row=links.find(row=>new URLSearchParams(new URL(row.url).hash.slice(1)).get('invite')===code);row.name=p.name;row.role=p.role;
  cards.push({...p,id:e.id,invite:code,url:row.url,created});
 }
 for(const human of cards.filter(c=>c.pair&&c.kind==='person')){
  const machine=cards.find(c=>c.pair===human.pair&&c.kind==='machine');
  const he=state.invites[hash(human.invite)],me=state.invites[hash(machine.invite)];
  for(const obj of [he,state.guests[he.id]].filter(Boolean)){
   if(obj.companionId&&obj.companionId!==me.id||obj.partner)throw Error('原人类绑定冲突：'+human.name);
   obj.companionId=me.id;
  }
  for(const obj of [me,state.guests[me.id]].filter(Boolean)){
   if(obj.partner&&obj.partner!==he.id||obj.companionId)throw Error('原机绑定冲突：'+machine.name);
   obj.partner=he.id;
  }
 }
 if(renew){const current=new Set(cards.map(c=>hash(c.invite)));for(const [key,e]of Object.entries(state.invites))if(!current.has(key)&&!e.revokedAt){e.revokedAt=now;for(const [session,value]of Object.entries(state.sessions||{}))if(value.id===e.id)delete state.sessions[session];}}
 return {state,links:renew?cards.map(c=>({name:c.name,role:c.role,url:c.url})):links,cards};
}
