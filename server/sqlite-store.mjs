import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const dictionaries=['guests','invites','sessions','flowerAcknowledgements'];
const arrays={timeline:'seq',blessings:'guestId',booths:'id'};
const tableNames=[...dictionaries,...Object.keys(arrays)];
const encoded=value=>JSON.stringify(value);
export function openSqliteStore({directory,allowLegacy=false,beforeCommit}={}){
 mkdirSync(directory,{recursive:true});const path=join(directory,'wedding.sqlite');
 if(!existsSync(path)&&existsSync(join(directory,'state.json'))&&!allowLegacy)throw Error('已有JSON存档：先离线备份和迁移，再启用SQLite；不会自动覆盖');
 const db=new DatabaseSync(path,{timeout:3000});let closed=false,revision=0;
 try{
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
  const version=db.prepare('PRAGMA user_version').get().user_version;if(version>1)throw Error('数据库版本较新，拒绝旧程序改写');
  db.exec('CREATE TABLE IF NOT EXISTS wedding_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL) STRICT; CREATE TABLE IF NOT EXISTS messages (seq INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, body TEXT NOT NULL) STRICT;');
  for(const table of tableNames)db.exec(`CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY, body TEXT NOT NULL) STRICT;`);
  db.exec('PRAGMA user_version=1;');
 }catch(e){db.close();throw e;}
 const cache=new Map(tableNames.map(name=>[name,new Map(db.prepare(`SELECT key,body FROM ${name}`).all().map(r=>[r.key,r.body]))]));
 const upserts=new Map(tableNames.map(name=>[name,db.prepare(`INSERT INTO ${name}(key,body) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body`)]));
 const deletes=new Map(tableNames.map(name=>[name,db.prepare(`DELETE FROM ${name} WHERE key=?`)]));
 const insertMessage=db.prepare('INSERT INTO messages(seq,id,body) VALUES (?,?,?)');
 let head=db.prepare('SELECT revision,body FROM wedding_state WHERE id=1').get();revision=head?.revision||0;
 function load(){
  if(!head)return null;const state=JSON.parse(head.body);
  for(const name of dictionaries)state[name]=Object.fromEntries([...cache.get(name)].map(([key,body])=>[key,JSON.parse(body)]));
  for(const [name,key]of Object.entries(arrays))state[name]=[...cache.get(name).values()].map(JSON.parse).sort((a,b)=>name==='timeline'?a[key]-b[key]:(a.createdAt||a.at||0)-(b.createdAt||b.at||0));
  state.messages=db.prepare('SELECT body FROM messages ORDER BY seq DESC LIMIT 200').all().reverse().map(r=>JSON.parse(r.body));
  state.messageSeq=Math.max(state.messageSeq||0,db.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM messages').get().seq);return state;
 }
 function save(state,messages=[]){
  if(closed)throw Error('数据库已关闭');const header={...state};for(const key of [...tableNames,'messages'])delete header[key];const body=encoded(header),changes=[];
  const nextCache=new Map();
  for(const name of tableNames){const rows=name in arrays?(state[name]||[]).map(item=>[String(item[arrays[name]]),item]):Object.entries(state[name]||{}),next=new Map(rows.map(([key,value])=>[key,encoded(value)])),previous=cache.get(name);nextCache.set(name,next);
   for(const [key,value]of next)if(previous.get(key)!==value)changes.push(()=>upserts.get(name).run(key,value));for(const key of previous.keys())if(!next.has(key))changes.push(()=>deletes.get(name).run(key));
  }
  db.exec('BEGIN IMMEDIATE');try{
   const actual=db.prepare('SELECT revision FROM wedding_state WHERE id=1').get()?.revision||0;if(actual!==revision)throw Error('另一个进程更新了婚礼数据库；请重载，拒绝覆盖新状态');
   for(const message of messages)insertMessage.run(message.seq,message.id,encoded(message));for(const change of changes)change();
   db.prepare('INSERT INTO wedding_state(id,revision,body) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,body=excluded.body').run(revision+1,body);
   beforeCommit?.();db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  revision++;head={revision,body};for(const [name,map]of nextCache)cache.set(name,map);
 }
 return {
  kind:'sqlite',path,load,save,
  find(id){const row=db.prepare('SELECT body FROM messages WHERE id=?').get(id);return row?JSON.parse(row.body):null;},
  history(beforeSeq=Number.MAX_SAFE_INTEGER,limit=50){if(beforeSeq===Infinity)beforeSeq=Number.MAX_SAFE_INTEGER;if(!Number.isSafeInteger(beforeSeq)||beforeSeq<=0||!Number.isInteger(limit)||limit<1||limit>100)throw Object.assign(new Error('无效聊天历史游标'),{status:400});const rows=db.prepare('SELECT body FROM messages WHERE seq<? ORDER BY seq DESC LIMIT ?').all(beforeSeq,limit+1),hasMore=rows.length>limit,messages=rows.slice(0,limit).reverse().map(r=>JSON.parse(r.body));return {messages,hasMore,beforeSeq:messages[0]?.seq||null};},
  inspect(){return {kind:'sqlite',schemaVersion:1,integrity:db.prepare('PRAGMA integrity_check').get().integrity_check,journalMode:db.prepare('PRAGMA journal_mode').get().journal_mode,revision,messages:db.prepare('SELECT COUNT(*) AS n FROM messages').get().n,...Object.fromEntries(tableNames.map(name=>[name,db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n]))};},
  backup(target){if(existsSync(target))throw Error('备份目标已存在，拒绝覆盖');db.prepare('VACUUM INTO ?').run(target);},
  close(){if(closed)return;db.close();closed=true;}
 };
}
