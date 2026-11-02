import {setTimeout as delay} from 'node:timers/promises';
import {createWeddingMcpClient} from './mcp-client.mjs';
import {normalizeWaitResult,listenerErrorEnvelope} from './events.mjs';
import {ListenerStore} from './store.mjs';
import {deliverPending} from './sink.mjs';

export class WeddingListenerWorker{
 constructor(config,{fetchImpl=fetch,writeLine=line=>process.stdout.write(line+'\n'),now=Date.now}={}){
  this.config=config;this.fetchImpl=fetchImpl;this.writeLine=writeLine;this.now=now;this.closed=false;
  this.client=createWeddingMcpClient({mcpUrl:config.mcpUrl,session:config.session,fetchImpl});
  this.store=new ListenerStore({file:config.dbFile,identityKey:config.identityKey,session:config.session,initialEventCursor:config.initialEventCursor,initialMessageCursor:config.initialMessageCursor,leaseMs:config.leaseMs,now});
  try{this.store.acquire();}catch(error){this.store.close();throw error;}
 }
 async dispatch(){return deliverPending({store:this.store,sink:this.config.sink,webhookUrl:this.config.webhookUrl,webhookSecret:this.config.webhookSecret,fetchImpl:this.fetchImpl,writeLine:this.writeLine});}
 async drain({signal,attempts=3}={}){
  if(this.config.sink==='queue')return;
  for(let attempt=0;attempt<attempts&&this.store.pendingWake().length;attempt++){
   try{await this.dispatch();return;}catch{if(attempt+1<attempts)await delay(Math.min(this.config.retryMaxMs,this.config.retryMinMs*2**attempt),undefined,{signal}).catch(()=>{});}
  }
 }
 async pollOnce({signal}={}){
  if(this.closed)throw Error('Listener worker is closed');this.store.renew();const checkpoint=this.store.checkpoint();
  const timeout=AbortSignal.timeout(this.config.timeoutMs+5_000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
  const result=await this.client.wait({afterSeq:checkpoint.eventCursor,afterMessageId:checkpoint.messageCursor,timeoutMs:this.config.timeoutMs},{signal:combined});
  const envelopes=normalizeWaitResult(result,{identityKey:this.config.identityKey,wakeKinds:this.config.wakeKinds});
  const applied=this.store.apply(result,envelopes);let deliveryError=null;try{await this.dispatch();}catch(error){deliveryError=error;}
  return {result,envelopes,applied,deliveryError};
 }
 async run({signal}={}){
  let retry=this.config.retryMinMs;
  while(!this.closed&&!signal?.aborted){
   try{
    try{await this.dispatch();}catch{}
    const {result}=await this.pollOnce({signal});retry=this.config.retryMinMs;
    if(result.hasMore)continue;
    if(result.left||result.continueWaiting===false){this.store.stop(result.left?'left':'closed');await this.drain({signal});break;}
   }catch(error){
    if(signal?.aborted||error.name==='AbortError'||error.name==='TimeoutError'&&this.closed)break;
    if(error.terminal){const envelope=listenerErrorEnvelope({identityKey:this.config.identityKey,error});this.store.enqueue(envelope);this.store.stop('session-invalid');await this.drain({signal});break;}
    this.writeLine(JSON.stringify({source:'agent-wedding-listener',level:'warn',identityKey:this.config.identityKey,message:String(error.message||error),retryInMs:error.retryAfterMs||retry}));
    await delay(error.retryAfterMs||retry,undefined,{signal}).catch(()=>{});retry=Math.min(this.config.retryMaxMs,retry*2);
   }
  }
  return this.store.checkpoint();
 }
 events(){return this.store.events();}
 close(){if(this.closed)return;this.closed=true;this.store.release();this.store.close();}
}

export function createWeddingListenerWorker(config,options){return new WeddingListenerWorker(config,options);}
