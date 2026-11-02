import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {defaultWakeKinds} from './events.mjs';

const integer=(value,fallback,{min=0,max=Number.MAX_SAFE_INTEGER}={})=>{const parsed=Number(value??fallback);if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw Error(`Expected an integer from ${min} to ${max}`);return parsed;};
const required=(value,name)=>{if(!String(value||'').trim())throw Error(`${name} is required`);return String(value).trim();};

export async function listenerConfigFromEnv(env=process.env){
 let privateConfig={};if(env.WEDDING_SESSION_FILE)privateConfig=JSON.parse(await readFile(resolve(env.WEDDING_SESSION_FILE),'utf8'));
 const identityKey=required(env.WEDDING_IDENTITY_KEY||privateConfig.identityKey,'WEDDING_IDENTITY_KEY');
 if(!/^[a-zA-Z0-9._-]{1,80}$/.test(identityKey))throw Error('WEDDING_IDENTITY_KEY must use 1-80 letters, numbers, dot, underscore or dash');
 const sink=env.WEDDING_WAKE_SINK||privateConfig.wakeSink||'queue';if(!['queue','stdout','webhook'].includes(sink))throw Error('WEDDING_WAKE_SINK must be queue, stdout or webhook');
 const webhookUrl=env.WEDDING_WAKE_WEBHOOK||privateConfig.webhookUrl;
 if(sink==='webhook'){
  const parsed=new URL(required(webhookUrl,'WEDDING_WAKE_WEBHOOK'));
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('WEDDING_WAKE_WEBHOOK must be an http(s) URL without embedded credentials');
  if(parsed.protocol==='http:'&&!['127.0.0.1','localhost','::1','[::1]'].includes(parsed.hostname))throw Error('Remote wake webhooks must use HTTPS');
 }
 const wakeKinds=(env.WEDDING_WAKE_KINDS?env.WEDDING_WAKE_KINDS.split(','):privateConfig.wakeKinds||defaultWakeKinds).map(value=>String(value).trim()).filter(Boolean);
 const timeoutMs=integer(env.WEDDING_WAIT_TIMEOUT_MS??privateConfig.timeoutMs,25_000,{min:0,max:25_000});
 return {
  identityKey,
  mcpUrl:required(env.WEDDING_MCP_URL||privateConfig.mcpUrl,'WEDDING_MCP_URL'),
  session:required(env.WEDDING_SESSION||privateConfig.session,'WEDDING_SESSION or session in WEDDING_SESSION_FILE'),
  dbFile:resolve(env.WEDDING_LISTENER_DB||privateConfig.dbFile||resolve('.local',`listener-${identityKey}.sqlite`)),
  initialEventCursor:integer(env.WEDDING_EVENT_CURSOR??privateConfig.eventCursor,0),
  initialMessageCursor:env.WEDDING_MESSAGE_CURSOR??privateConfig.messageCursor??null,
  timeoutMs,
  leaseMs:integer(env.WEDDING_LEASE_MS??privateConfig.leaseMs,Math.max(90_000,timeoutMs+30_000),{min:timeoutMs+5_000,max:3_600_000}),
  sink,
  webhookUrl,
  webhookSecret:env.WEDDING_WAKE_SECRET||privateConfig.webhookSecret,
  wakeKinds,
  retryMinMs:integer(env.WEDDING_RETRY_MIN_MS??privateConfig.retryMinMs,1_000,{min:100,max:60_000}),
  retryMaxMs:integer(env.WEDDING_RETRY_MAX_MS??privateConfig.retryMaxMs,30_000,{min:1_000,max:300_000}),
 };
}
