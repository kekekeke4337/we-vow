import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createWedding,replaceStateFile} from './wedding.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};

export function resolveTestDirectory(directory){
 let pointer;try{pointer=JSON.parse(readFileSync(resolve(directory,'test-active.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return resolve(directory);throw error;}
 if(!/^\.test-generations\/[a-f0-9-]{36}$/.test(pointer.relativeDirectory||''))throw Error('无效测试场存档指针，拒绝猜测或回退');
 const target=resolve(directory,pointer.relativeDirectory);if(!target.startsWith(resolve(directory)+sep))throw Error('测试场路径越界');
 if(!existsSync(resolve(target,'wedding.sqlite')))throw Error('测试场指针目标缺失，拒绝新建空存档');
 if(!realpathSync(target).startsWith(realpathSync(directory)+sep))throw Error('测试场真实路径越界');return target;
}

export function createTestSceneManager({directory,getWedding,setWedding,clock,invitationPolicy}){
 const confirmations=new Map();
 function controller(session){const w=getWedding();if(w.snapshot(session).me.role!=='bride')fail('只有流程控制者可以重置整个测试场',403);return w;}
 return {
  prepare(session){const w=controller(session);if(w.storageKind!=='sqlite')fail('测试重置需要SQLite存档，当前现场保持原样',409);confirmations.clear();const nonce=randomUUID();confirmations.set(nonce,{session,expiresAt:clock()+60000,revision:w.storageInfo().revision});return {nonce,expiresInSeconds:60,environment:'joint-rehearsal',guests:w.storageInfo().guests,phase:w.snapshot(session).phase.id,preservesIdentity:true};},
  reset(session,{nonce,confirm}={}){
   const old=controller(session),check=confirmations.get(nonce);if(confirm!=='RESET_TEST_SCENE'||!check||check.session!==session||check.expiresAt<clock())fail('请先预览并明确确认重置测试场',403);
   if(check.revision!==old.storageInfo().revision)fail('测试场有新进展，请重新预览并确认',409);confirmations.delete(nonce);
   const initialState=old.testResetState(session),id=randomUUID(),relativeDirectory='.test-generations/'+id,target=resolve(directory,relativeDirectory),backups=resolve(directory,'.test-backups');
   mkdirSync(backups,{recursive:true});mkdirSync(resolve(directory,'.test-generations'),{recursive:true});
   const backup=resolve(backups,id+'.sqlite');old.backup(backup);const audit=new DatabaseSync(backup,{readOnly:true});try{if(audit.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('测试备份校验失败，拒绝切换');}finally{audit.close();}
   let candidate;
   try{
    candidate=createWedding({directory:target,clock,storage:'sqlite',testMode:true,initialState,invitationPolicy});
    if(candidate.storageInfo().integrity!=='ok'||candidate.snapshot(session).me.id!==old.snapshot(session).me.id)throw Error('新测试场身份或完整性校验失败');
    const pointer=resolve(directory,'test-active.json'),temporary=pointer+'.'+id+'.tmp';writeFileSync(temporary,JSON.stringify({relativeDirectory,backupId:id,at:clock()}));replaceStateFile(temporary,pointer);
   }catch(error){candidate?.close();throw error;}
   setWedding(candidate,id);old.close();confirmations.clear();
   return {reset:true,backupCreated:true,backupId:id,generation:id,snapshot:candidate.snapshot(session)};
  }
 };
}
