// No invitations, sessions, successful writes, joins or resets. Safe to copy to another machine.
import assert from 'node:assert/strict';
import {get} from 'node:https';
import {lookup} from 'node:dns/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function publicOrigin(value){
 const url=new URL(value);assert.equal(url.protocol,'https:','use the real HTTPS origin');
 assert.ok(!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/','origin only: never paste an invitation, ticket, session or credential URL');return url.origin;
}
export function certificate(origin){return new Promise((resolve,reject)=>{
 const request=get(origin+'/api/health',{agent:false,timeout:15000},response=>{
  try{const socket=response.socket,cert=socket.getPeerCertificate();assert.equal(socket.authorized,true,'TLS chain/hostname must be trusted');
   assert.ok(Date.parse(cert.valid_to)>Date.now(),'certificate expired');const details={authorized:socket.authorized,protocol:socket.getProtocol(),subject:cert.subject?.CN,issuer:cert.issuer?.CN,validTo:cert.valid_to,fingerprint256:cert.fingerprint256};response.resume();response.on('end',()=>resolve(details));response.on('error',reject);
  }catch(error){response.destroy();reject(error);}
 });request.on('error',reject);request.on('timeout',()=>request.destroy(Error('TLS probe timeout')));
});}

export async function runPublicSmoke({origin:input='https://wedding.example',fetcher=fetch,tlsProbe=certificate,dnsProbe=hostname=>lookup(hostname,{all:true})}={}){
 const origin=publicOrigin(input),checks=[],startedAt=new Date().toISOString(),addresses=await dnsProbe(new URL(origin).hostname),tls=await tlsProbe(origin);let rpcId=0;
 async function request(base,path,{method='GET',body,headers={},status=200}={}){
  // No caller-supplied auth, invitation or session option exists in this checker.
  const before=performance.now(),response=await fetcher(origin+base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),redirect:'error'}),text=await response.text();
  assert.equal(response.status,status,base+path+' unexpected HTTP status');checks.push({base,path,method,status:response.status,ms:+(performance.now()-before).toFixed(1),decodedBytes:Buffer.byteLength(text)});return {response,text};
 }
 const sites=[];
 for(const base of ['','/test']){
  const health=JSON.parse((await request(base,'/api/health')).text);assert.equal(health.ok,true);assert.equal(health.storage,'sqlite');
  const admission=JSON.parse((await request(base,'/api/admission')).text);assert.equal(typeof admission.open,'boolean');assert.equal(typeof admission.enabled,'boolean');
  const locked=!admission.open;if(locked){assert.equal(admission.enabled,true);assert.ok(['date_pending','countdown'].includes(admission.status),'closed admission must have a valid pending date/countdown, not a schedule error');}
  const mode=base?'joint-rehearsal':'live';if(base)assert.equal(health.environment,mode);else assert.equal('generation'in health,false);
  const html=await request(base,'/');assert.ok(html.text.includes(`<base href="${base}/">`));assert.ok(html.text.includes(`data-site-mode="${mode}"`));assert.match(html.response.headers.get('content-type'),/text\/html/);
  const etag=html.response.headers.get('etag');assert.ok(etag);await request(base,'/',{headers:{'if-none-match':etag},status:304});
  const rpc=async(method,params={},headers={})=>JSON.parse((await request(base,'/mcp',{method:'POST',body:{jsonrpc:'2.0',id:++rpcId,method,params},headers})).text);
  const initialized=await rpc('initialize',{protocolVersion:'2024-11-05'});assert.equal(initialized.result.serverInfo.name,base?'agent-wedding-joint-rehearsal':'agent-wedding');
  const listing=await rpc('tools/list',{}, {origin});const tools=listing.result.tools;assert.deepEqual(tools.map(t=>t.name),['wedding_join','wedding_wait','wedding_action']);
  const testRole=tools.find(t=>t.name==='wedding_action').inputSchema.properties.action.enum.includes('test_role');assert.equal(testRole,Boolean(base&&health.testControls));
  const options=await request(base,'/mcp',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'authorization,content-type,mcp-protocol-version'},status:204});assert.equal(options.response.headers.get('access-control-allow-origin'),origin);
  await request(base,'/mcp',{method:'POST',body:{jsonrpc:'2.0',id:++rpcId,method:'tools/list'},headers:{origin:'https://untrusted.invalid'},status:403});
  async function denied(path,options,openStatus){const result=await request(base,path,{...options,status:locked?423:openStatus});if(locked){const value=JSON.parse(result.text);assert.equal(value.open,false);assert.equal(value.enabled,true);assert.ok(['date_pending','countdown'].includes(value.status));assert.equal(value.nextAction,'return_at_opening');assert.equal(value.keepWaiting,false);assert.deepEqual(Object.keys(value).sort(),['enabled','open','opensAt','serverTime','status','message','nextAction','keepWaiting','error'].sort(),'locked response must contain only the public countdown, not private wedding state');}}
  await denied('/api/state',{},401);
  await denied('/api/action',{method:'POST',body:{type:'next'}},401);
  await denied('/api/test/roles',{},base&&health.testControls?401:404);
  const bridge=await request(base,'/download/wedding-mcp.mjs');assert.match(bridge.text,/WEDDING_MCP_URL/);assert.match(bridge.response.headers.get('content-type'),/javascript/);
  const schema=tools.find(t=>t.name==='wedding_action').inputSchema;assert.equal(schema.properties.action.enum.includes('place_companion'),false);
  sites.push({base,mode,admission:{enabled:admission.enabled,open:admission.open,...(locked?{status:admission.status}:{})},threeTools:true,originPreflight:true,untrustedOriginDenied:true,unauthedReadAndAdvanceDenied:true,testControlsSeparated:true,etagRevalidated:true,bridgeServed:true});
 }
 return {passed:true,origin,startedAt,addresses,tls,sites,checks,scope:'public DNS/TLS and read-only/denied HTTP/MCP requests; no join, invite consumption, successful action, reset, real client conversation, 40-user WAN load or phone rendering; script does not establish observer geography'};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const directory=resolve('.local','public-smoke-check-'+Date.now());await mkdir(directory,{recursive:true});
 try{const report=await runPublicSmoke({origin:process.env.WEDDING_CHECK_ORIGIN||'https://wedding.example'});report.observerLabel=process.env.WEDDING_OBSERVER_LABEL||'unspecified';await writeFile(resolve(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,origin:report.origin,tls:report.tls,checks:report.checks.length,observerLabel:report.observerLabel,scope:report.scope,evidence:directory},null,2));}
 catch(error){await writeFile(resolve(directory,'failure.json'),JSON.stringify({error:error.stack},null,2));throw error;}
}
