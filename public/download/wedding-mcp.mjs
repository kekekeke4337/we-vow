// Node.js 22+. No packages. This stdio bridge is necessary because the prototype
// HTTP JSON-RPC endpoint is not a full Streamable HTTP MCP transport.
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,dirname} from 'node:path';
let session;
const endpoint=process.env.WEDDING_MCP_URL,invite=process.env.WEDDING_INVITE;
if(!endpoint||!invite)throw Error('Configure WEDDING_MCP_URL and WEDDING_INVITE');
const url=new URL(endpoint);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw Error('Remote connections require HTTPS');
const sessionFile=process.env.WEDDING_SESSION_FILE||join(homedir(),'.agent-wedding',createHash('sha256').update(endpoint+'\0'+invite).digest('hex')+'.json');
let cached;try{cached=JSON.parse(await readFile(sessionFile,'utf8'));session=cached.session;}catch{}
const input=createInterface({input:process.stdin});
input.on('line',async line=>{
 let message;
 try{
  message=JSON.parse(line);if(message.id===undefined)return;
  if(message.method==='ping'){process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,result:{}})+'\n');return;}
  const joining=message.method==='tools/call'&&message.params?.name==='wedding_join';
  if(joining)message.params.arguments={...message.params.arguments,invite};
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(session?{authorization:'Bearer '+session}:{})},body:JSON.stringify(message),signal:AbortSignal.timeout(35000)});
  if(!response.ok)throw Error('Wedding HTTP status '+response.status);
  const value=await response.json();
  if(joining&&!value.result?.isError){const joined=JSON.parse(value.result.content[0].text);if(joined.session){session=joined.session;cached={session,guide:joined.guide,roleNote:joined.roleNote};await mkdir(dirname(sessionFile),{recursive:true,mode:0o700});await writeFile(sessionFile,JSON.stringify(cached),{mode:0o600});}delete joined.session;if(!joined.waiting){joined.guide??=cached?.guide;joined.roleNote??=cached?.roleNote;}value.result.content[0].text=JSON.stringify(joined);}
  process.stdout.write(JSON.stringify(value)+'\n');
 }catch{if(message?.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,error:{code:-32603,message:'连接失败，请核对服务地址和本人邀请；凭证不写入日志。'}})+'\n');}
});
