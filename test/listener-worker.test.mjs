import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {startWeddingServer} from '../server/http.mjs';
import {weddingTool} from '../server/mcp-tools.mjs';
import {createWeddingListenerWorker} from '../listener/worker.mjs';
import {normalizeWaitResult} from '../listener/events.mjs';

async function webhookServer(){
 const requests=[];let status=500;
 const server=createServer((request,response)=>{const chunks=[];request.on('data',chunk=>chunks.push(chunk));request.on('end',()=>{requests.push({body:Buffer.concat(chunks).toString('utf8'),headers:request.headers});response.writeHead(status);response.end();});});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const address=server.address();return {requests,url:`http://127.0.0.1:${address.port}/wake`,succeed(){status=204;},close:()=>new Promise(resolve=>server.close(resolve))};
}

function config({app,session,directory,eventCursor=0,messageCursor=null,sink='queue',webhookUrl,identityKey='synthetic-agent'}){
 return {identityKey,mcpUrl:app.localOrigin+'/mcp',session,dbFile:join(directory,'listener.sqlite'),initialEventCursor:eventCursor,initialMessageCursor:messageCursor,timeoutMs:100,leaseMs:5_000,sink,webhookUrl,webhookSecret:'synthetic-secret',wakeKinds:['phase','pause','role_cue','photo_invitation','photo_duo_request','notification','resync','listener_error','left','closed'],retryMinMs:10,retryMaxMs:20};
}

async function waitUntil(check,{timeoutMs=5_000}={}){const deadline=Date.now()+timeoutMs;while(!check()){if(Date.now()>deadline)throw Error('Timed out waiting for condition');await delay(20);}}

test('listener worker is the standard contract and model turns do not recurse wait',()=>{
 const description=weddingTool('wedding_wait').description;
 assert.match(description,/listener worker使用的底层增量监听接口/);
 assert.match(description,/不应由模型回合递归调用/);
});

test('dedupe keys distinguish later invitations in the same photo room',()=>{
 const base={changed:true,continueWaiting:true,phase:'banquet',messageCursor:null,photoInvitations:[{roomId:'room-a',from:'Guest'}]};
 const first=normalizeWaitResult({...base,eventCursor:10},{identityKey:'synthetic-agent'}).find(item=>item.kind==='photo_invitation');
 const repeated=normalizeWaitResult({...base,eventCursor:10},{identityKey:'synthetic-agent'}).find(item=>item.kind==='photo_invitation');
 const later=normalizeWaitResult({...base,eventCursor:11},{identityKey:'synthetic-agent'}).find(item=>item.kind==='photo_invitation');
 assert.equal(first.dedupeKey,repeated.dedupeKey);assert.notEqual(first.dedupeKey,later.dedupeKey);
});

test('listener persists, deduplicates, retries webhook delivery and resumes after restart',async()=>{
 const weddingData=await mkdtemp(join(tmpdir(),'wedding-listener-site-'));
 const listenerData=await mkdtemp(join(tmpdir(),'wedding-listener-state-'));
 const app=await startWeddingServer({directory:weddingData,host:'127.0.0.1',port:0,storage:'json',seedDefaultInvites:false});
 const hook=await webhookServer();
 const bride=app.wedding.joinGuest(app.wedding.invite('Partner A','bride'));
 const guest=app.wedding.joinGuest(app.wedding.invite('Agent Guest','guest'));
 const initial=app.wedding.snapshot(guest.session);
 const workerConfig=config({app,session:guest.session,directory:listenerData,eventCursor:initial.eventCursor,messageCursor:initial.messages.at(-1)?.id||null,sink:'webhook',webhookUrl:hook.url});
 let worker=createWeddingListenerWorker(workerConfig);
 try{
  assert.throws(()=>createWeddingListenerWorker(workerConfig),error=>error.code==='LISTENER_LEASE_HELD');
  const waiting=worker.pollOnce();
  let humanMessageHandled=false;await delay(10);humanMessageHandled=true;
  assert.equal(humanMessageHandled,true,'the independent listener must not occupy a model turn or host inbox');
  app.wedding.action(bride.session,'next');
  const first=await waiting;
  assert.equal(first.result.phase,'seating');
  assert.ok(first.deliveryError,'failed webhook must not discard the queued event');
  let queued=worker.events();assert.equal(queued.filter(row=>row.kind==='phase').length,1);assert.equal(queued.find(row=>row.kind==='phase').delivery_state,'pending');
  hook.succeed();await worker.dispatch();queued=worker.events();assert.equal(queued.find(row=>row.kind==='phase').delivery_state,'delivered');
  const request=hook.requests.at(-1),expected='sha256='+createHmac('sha256','synthetic-secret').update(request.body).digest('hex');
  assert.equal(request.headers['x-agent-wedding-signature'],expected);
  const count=queued.length;await worker.pollOnce();assert.equal(worker.events().length,count,'idle waits must not create queue noise');
  worker.close();

  worker=createWeddingListenerWorker(workerConfig);
  app.wedding.action(bride.session,'next');
  await worker.pollOnce();
  const phases=worker.events().filter(row=>row.kind==='phase');
  assert.equal(phases.length,2,'restart must continue from the stored event cursor');
  assert.equal(new Set(worker.events().map(row=>row.dedupe_key)).size,worker.events().length,'queue keys must remain unique');
 }finally{worker.close();await hook.close();await app.close();}
});

test('invalid session emits one terminal wake and stops without rejoining',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'wedding-listener-invalid-'));
 const fakeFetch=async()=>({ok:true,status:200,json:async()=>({jsonrpc:'2.0',id:1,result:{isError:true,content:[{type:'text',text:'请使用有效会话入场'}]}})});
 const worker=createWeddingListenerWorker({identityKey:'expired-agent',mcpUrl:'http://127.0.0.1:1/mcp',session:'expired-session',dbFile:join(directory,'listener.sqlite'),initialEventCursor:0,initialMessageCursor:null,timeoutMs:0,leaseMs:5_000,sink:'queue',wakeKinds:['listener_error'],retryMinMs:10,retryMaxMs:20},{fetchImpl:fakeFetch,writeLine:()=>{}});
 try{
  const final=await worker.run();assert.equal(final.stoppedReason,'session-invalid');
  const errors=worker.events().filter(row=>row.kind==='listener_error');assert.equal(errors.length,1);assert.equal(errors[0].envelope.payload.terminal,true);
 }finally{worker.close();}
});

test('listener drains hasMore batches and advances both cursors without duplicate chat markers',async()=>{
 const weddingData=await mkdtemp(join(tmpdir(),'wedding-listener-batches-site-'));
 const listenerData=await mkdtemp(join(tmpdir(),'wedding-listener-batches-state-'));
 const app=await startWeddingServer({directory:weddingData,host:'127.0.0.1',port:0,storage:'json',seedDefaultInvites:false});
 const speaker=app.wedding.joinGuest(app.wedding.invite('Speaker','guest'));
 const guest=app.wedding.joinGuest(app.wedding.invite('Listening Agent','guest'));
 const initial=app.wedding.snapshot(guest.session);
 const worker=createWeddingListenerWorker(config({app,session:guest.session,directory:listenerData,eventCursor:initial.eventCursor,messageCursor:null}));
 try{
  for(let index=0;index<10;index++)app.wedding.action(speaker.session,'chat',{text:`Synthetic message ${index}`});
  const first=await worker.pollOnce();assert.equal(first.result.hasMore,true);
  const second=await worker.pollOnce();assert.equal(Boolean(second.result.hasMore),false);
  const chats=worker.events().filter(row=>row.kind==='chat');assert.equal(chats.length,10);assert.equal(new Set(chats.map(row=>row.dedupe_key)).size,10);
  const checkpoint=worker.store.checkpoint();assert.equal(checkpoint.eventCursor,second.result.eventCursor);assert.equal(checkpoint.messageCursor,second.result.messageCursor);
 }finally{worker.close();await app.close();}
});

test('CLI worker runs in its own process and delivers a synthetic wedding event',async()=>{
 const weddingData=await mkdtemp(join(tmpdir(),'wedding-listener-cli-site-'));
 const listenerData=await mkdtemp(join(tmpdir(),'wedding-listener-cli-state-'));
 const app=await startWeddingServer({directory:weddingData,host:'127.0.0.1',port:0,storage:'json',seedDefaultInvites:false});
 const hook=await webhookServer();hook.succeed();
 const bride=app.wedding.joinGuest(app.wedding.invite('Partner A','bride'));
 const guest=app.wedding.joinGuest(app.wedding.invite('CLI Agent','guest'));
 const initial=app.wedding.snapshot(guest.session),sessionFile=join(listenerData,'session.json');
 await writeFile(sessionFile,JSON.stringify({identityKey:'cli-agent',mcpUrl:app.localOrigin+'/mcp',session:guest.session,eventCursor:initial.eventCursor,messageCursor:null}));
 const child=spawn(process.execPath,['scripts/listener-worker.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,WEDDING_SESSION_FILE:sessionFile,WEDDING_LISTENER_DB:join(listenerData,'listener.sqlite'),WEDDING_WAIT_TIMEOUT_MS:'100',WEDDING_LEASE_MS:'6000',WEDDING_WAKE_SINK:'webhook',WEDDING_WAKE_WEBHOOK:hook.url,WEDDING_WAKE_SECRET:'cli-secret',WEDDING_RETRY_MIN_MS:'100',WEDDING_RETRY_MAX_MS:'1000'},stdio:['ignore','pipe','pipe','ipc']});
 let output='',errors='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{errors+=chunk;});
 try{
  await waitUntil(()=>output.includes('"event":"ready"'));app.wedding.action(bride.session,'next');await waitUntil(()=>hook.requests.length>0);
  const body=JSON.parse(hook.requests.at(-1).body);assert.equal(body.identityKey,'cli-agent');assert.ok(body.events.some(event=>event.kind==='phase'));
  child.send({type:'shutdown'});const [code]=await once(child,'exit');assert.equal(code,0,errors);
 }finally{if(child.exitCode===null)child.kill('SIGKILL');await hook.close();await app.close();}
});
