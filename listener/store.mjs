import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const fingerprint=value=>createHash('sha256').update(value).digest('hex');

export class ListenerStore{
 constructor({file,identityKey,session,initialEventCursor=0,initialMessageCursor=null,ownerId=randomUUID(),leaseMs=90_000,now=Date.now}){
  this.file=resolve(file);this.identityKey=identityKey;this.ownerId=ownerId;this.leaseMs=leaseMs;this.now=now;
  mkdirSync(dirname(this.file),{recursive:true});this.db=new DatabaseSync(this.file);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS listener_state(identity_key TEXT PRIMARY KEY,session_fingerprint TEXT NOT NULL,event_cursor INTEGER NOT NULL,message_cursor TEXT,phase TEXT,continue_waiting INTEGER NOT NULL DEFAULT 1,stopped_reason TEXT,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS listener_lease(identity_key TEXT PRIMARY KEY,owner_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS listener_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,identity_key TEXT NOT NULL,dedupe_key TEXT NOT NULL,kind TEXT NOT NULL,wake INTEGER NOT NULL,payload_json TEXT NOT NULL,event_cursor INTEGER,message_cursor TEXT,received_at TEXT NOT NULL,delivery_state TEXT NOT NULL,delivered_at TEXT,UNIQUE(identity_key,dedupe_key));
   CREATE INDEX IF NOT EXISTS listener_queue_pending ON listener_queue(identity_key,delivery_state,wake,id);`);
  const sessionFingerprint=fingerprint(session),existing=this.db.prepare('SELECT * FROM listener_state WHERE identity_key=?').get(identityKey);
  if(existing&&existing.session_fingerprint!==sessionFingerprint)throw Error('This identity key is already bound to a different wedding session');
  this.db.prepare('INSERT OR IGNORE INTO listener_state(identity_key,session_fingerprint,event_cursor,message_cursor,updated_at) VALUES(?,?,?,?,?)').run(identityKey,sessionFingerprint,initialEventCursor,initialMessageCursor,new Date(now()).toISOString());
 }
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const value=fn();this.db.exec('COMMIT');return value;}catch(error){this.db.exec('ROLLBACK');throw error;}}
 acquire(){return this.transaction(()=>{const now=this.now(),lease=this.db.prepare('SELECT * FROM listener_lease WHERE identity_key=?').get(this.identityKey);if(lease&&lease.owner_id!==this.ownerId&&lease.expires_at>now){const error=Error('Another listener holds the active lease for this identity');error.code='LISTENER_LEASE_HELD';throw error;}this.db.prepare('INSERT INTO listener_lease(identity_key,owner_id,expires_at) VALUES(?,?,?) ON CONFLICT(identity_key) DO UPDATE SET owner_id=excluded.owner_id,expires_at=excluded.expires_at').run(this.identityKey,this.ownerId,now+this.leaseMs);return {ownerId:this.ownerId,expiresAt:now+this.leaseMs};});}
 renew(){const result=this.db.prepare('UPDATE listener_lease SET expires_at=? WHERE identity_key=? AND owner_id=?').run(this.now()+this.leaseMs,this.identityKey,this.ownerId);if(!result.changes){const error=Error('Listener lease was lost');error.code='LISTENER_LEASE_LOST';throw error;}}
 release(){this.db.prepare('DELETE FROM listener_lease WHERE identity_key=? AND owner_id=?').run(this.identityKey,this.ownerId);}
 checkpoint(){const row=this.db.prepare('SELECT event_cursor,message_cursor,phase,continue_waiting,stopped_reason FROM listener_state WHERE identity_key=?').get(this.identityKey);return {eventCursor:Number(row.event_cursor),messageCursor:row.message_cursor??null,phase:row.phase??null,continueWaiting:Boolean(row.continue_waiting),stoppedReason:row.stopped_reason??null};}
 apply(result,envelopes){return this.transaction(()=>{
   const insert=this.db.prepare('INSERT OR IGNORE INTO listener_queue(identity_key,dedupe_key,kind,wake,payload_json,event_cursor,message_cursor,received_at,delivery_state) VALUES(?,?,?,?,?,?,?,?,?)');let inserted=0;
   for(const envelope of envelopes){const response=insert.run(this.identityKey,envelope.dedupeKey,envelope.kind,envelope.wake?1:0,JSON.stringify(envelope),envelope.eventCursor,envelope.messageCursor,envelope.receivedAt,envelope.wake?'pending':'background');inserted+=Number(response.changes||0);}
   const before=this.checkpoint(),eventCursor=Number.isSafeInteger(result.eventCursor)?result.eventCursor:before.eventCursor,messageCursor=result.messageCursor===undefined?before.messageCursor:result.messageCursor;
   this.db.prepare('UPDATE listener_state SET event_cursor=?,message_cursor=?,phase=?,continue_waiting=?,stopped_reason=NULL,updated_at=? WHERE identity_key=?').run(eventCursor,messageCursor,result.phase??before.phase,result.continueWaiting===false?0:1,new Date(this.now()).toISOString(),this.identityKey);
   return {inserted,checkpoint:this.checkpoint()};
  });}
 enqueue(envelope){return this.apply({},[envelope]);}
 stop(reason){this.db.prepare('UPDATE listener_state SET continue_waiting=0,stopped_reason=?,updated_at=? WHERE identity_key=?').run(reason,new Date(this.now()).toISOString(),this.identityKey);}
 pendingWake(limit=100){return this.db.prepare("SELECT id,payload_json FROM listener_queue WHERE identity_key=? AND wake=1 AND delivery_state='pending' ORDER BY id LIMIT ?").all(this.identityKey,limit).map(row=>({id:Number(row.id),envelope:JSON.parse(row.payload_json)}));}
 markDelivered(ids){if(!ids.length)return;const marks=ids.map(()=>'?').join(',');this.db.prepare(`UPDATE listener_queue SET delivery_state='delivered',delivered_at=? WHERE identity_key=? AND id IN (${marks})`).run(new Date(this.now()).toISOString(),this.identityKey,...ids);}
 events(){return this.db.prepare('SELECT id,dedupe_key,kind,wake,delivery_state,payload_json FROM listener_queue WHERE identity_key=? ORDER BY id').all(this.identityKey).map(row=>({...row,id:Number(row.id),wake:Boolean(row.wake),envelope:JSON.parse(row.payload_json)}));}
 close(){this.db.close();}
}
