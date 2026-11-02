import {createHmac} from 'node:crypto';

export async function deliverPending({store,sink='queue',webhookUrl,webhookSecret,fetchImpl=fetch,writeLine=line=>process.stdout.write(line+'\n')}){
 const pending=store.pendingWake();if(!pending.length||sink==='queue')return {delivered:0,pending:pending.length};
 const body=JSON.stringify({version:1,source:'agent-wedding-listener',identityKey:store.identityKey,events:pending.map(item=>item.envelope)});
 if(sink==='stdout')writeLine(body);
 else if(sink==='webhook'){
  if(!webhookUrl)throw Error('WEDDING_WAKE_WEBHOOK is required for webhook sink');
  const target=new URL(webhookUrl);if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw Error('Wake webhook must be an http(s) URL without embedded credentials');if(target.protocol==='http:'&&!['127.0.0.1','localhost','::1','[::1]'].includes(target.hostname))throw Error('Remote wake webhooks must use HTTPS');
  const headers={'content-type':'application/json'};if(webhookSecret)headers['x-agent-wedding-signature']='sha256='+createHmac('sha256',webhookSecret).update(body).digest('hex');
  const response=await fetchImpl(webhookUrl,{method:'POST',headers,body,signal:AbortSignal.timeout(10_000)});if(!response.ok)throw Error(`Wake webhook returned HTTP ${response.status}`);
 }else throw Error('Unknown wake sink: '+sink);
 store.markDelivered(pending.map(item=>item.id));return {delivered:pending.length,pending:0};
}
