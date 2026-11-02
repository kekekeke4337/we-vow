import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile,access,realpath} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
import {createWedding} from './wedding.mjs';
import {createRehearsals} from './rehearsal.mjs';
import {seedRehearsalCast} from './rehearsal-cast.mjs';
import {flowerCardSvg} from './flower-card.mjs';
import {splitPngAtlas} from './png-tiles.mjs';
import {compactMcpView} from './mcp-view.mjs';
import {incrementalWebView} from './web-view.mjs';
import {weddingTool} from './mcp-tools.mjs';
import {createRateLimiter} from './rate-limit.mjs';
import {createTestSceneManager,resolveTestDirectory} from './test-scene.mjs';
import {createAdmission} from './admission.mjs';
const compress=promisify(gzip),fail=(text,status=400)=>{throw Object.assign(new Error(text),{status});};
const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
// Captured on process start, not a live disk hash: proves both services loaded
// the same core source rather than merely serving the same static files.
const runtimeCodeVersion=createHash('sha256').update(Buffer.concat(await Promise.all([
 'http.mjs','wedding.mjs','movement.mjs','flower-garden.mjs','invitations.mjs','rate-limit.mjs','mcp-tools.mjs','mcp-view.mjs',
 '../public/stage-layout.js','../public/front-photo-layout.js','../public/front-photo.js','../public/characters.js'
].map(path=>readFile(new URL(path,import.meta.url)))))).digest('hex');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json; charset=utf-8'};
const actionTools={wedding_move:'move',wedding_seat:'seat',wedding_chat:'chat',wedding_speech:'speech',wedding_confirm:'confirm',wedding_deliver_rings:'rings',wedding_gather:'gather',wedding_leave:'leave',wedding_flower_ack:'flower_ack',wedding_bless:'blessing',wedding_booth_create:'booth_create',wedding_booth_invite:'booth_invite',wedding_booth_respond:'booth_respond',wedding_booth_remove:'booth_remove',wedding_booth_style:'booth_style',wedding_booth_capture:'booth_capture',wedding_booth_cancel:'booth_cancel'};
function origin(value){let url;try{url=new URL(value);}catch{fail('PUBLIC_ORIGIN / ALLOWED_ORIGINS必须是完整http(s)来源');}if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)fail('来源配置不能包含路径、凭证或查询参数');return url.origin;}
Object.assign(actionTools,{wedding_follow:'follow',wedding_rename:'rename',wedding_turn:'turn'});
actionTools.wedding_booth_duo='booth_duo';
function body(req){return new Promise((ok,no)=>{let bytes=0,over=false;const chunks=[];req.on('data',chunk=>{bytes+=chunk.length;if(bytes>1048576){if(!over){over=true;chunks.length=0;no(Object.assign(new Error('请求超过1MiB安全上限，请分段发送'),{status:413}));}}else if(!over)chunks.push(chunk);});req.on('end',()=>{if(over)return;try{const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))fail('请求体必须是JSON对象');ok(parsed);}catch(e){no(Object.assign(e,{status:400}));}});req.on('error',no);});}
export async function startWeddingServer({directory,host='127.0.0.1',port=4387,publicOrigin,allowedOrigins=[],clock=Date.now,ticketTtlMs=600000,seedDefaultInvites=true,storage='auto',basePath='',siteMode='live',testControlsEnabled=true,admissionEnabled=false,invitationPolicy}={}){
 if(!directory)throw Error('Explicit wedding data directory is required');
 if(basePath&&!/^\/[a-zA-Z0-9_-]+$/.test(basePath))throw Error('basePath必须是单层路径，如/test，不带结尾斜线');
 if(!['live','joint-rehearsal'].includes(siteMode))throw Error('未知现场模式');
 if(siteMode==='joint-rehearsal'&&(!basePath||resolve(directory)===resolve(fileURLToPath(new URL('../.local/',import.meta.url)))))throw Error('联合彩排必须使用独立目录和路径，拒绝使用正式存档');
 if(!publicOrigin&&!['127.0.0.1','localhost','::1'].includes(host))throw Error('非本机监听必须设置PUBLIC_ORIGIN；不可把0.0.0.0用作邀请地址');
 if(publicOrigin)publicOrigin=origin(publicOrigin);
 const allowed=new Set(allowedOrigins.filter(Boolean).map(origin)),rehearsals=createRehearsals(),tickets=new Map(),limit=createRateLimiter({clock}),waiting=new Map(),files=new Map();
 const storageDirectory=siteMode==='joint-rehearsal'?resolveTestDirectory(directory):directory;
 const admission=createAdmission({directory,enabled:admissionEnabled&&siteMode==='live',clock});
 if(invitationPolicy===undefined){try{invitationPolicy=JSON.parse(await readFile(resolve(directory,'invitation-policy.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;invitationPolicy={};}}
 let wedding=createWedding({directory:storageDirectory,clock,storage,testMode:siteMode==='joint-rehearsal',invitationPolicy}),testGeneration=resolve(storageDirectory)===resolve(directory)?'initial':resolve(storageDirectory).split(sep).at(-1);
 const testScene=siteMode==='joint-rehearsal'&&testControlsEnabled?createTestSceneManager({directory,getWedding:()=>wedding,setWedding:(value,generation)=>{wedding=value;testGeneration=generation;tickets.clear();},clock,invitationPolicy}):null;
 function advertisedTools(){const tools=['wedding_join','wedding_wait','wedding_action'].map(weddingTool);if(testScene){const action=structuredClone(tools[2]);action.inputSchema.properties.action.enum.push('test_role');action.inputSchema.properties.args.properties.role={type:'string',enum:['guest','host','witness','rings']};action.description+=' 独立测试场可test_role({role})选择空闲测试职责，绝不能选择或替换新人。';tools[2]=action;}return tools;}
 function selectTestRole(session,args){if(Object.keys(args).some(key=>key!=='role'))fail('测试职责只能选择本人，不能指定其他来宾',403);return wedding.selectTestRole(session,args.role);}
 const tileImages=splitPngAtlas(await readFile(resolve(publicRoot,'assets/wedding-botanicals-v2.png'))),canonicalRoot=await realpath(publicRoot);
 let externalOrigin,externalBase;
 function download(session){const flower=wedding.snapshot(session).flower;if(!flower.opened)fail('种子尚未开花，拥抱时再来领取',409);for(const [key,value]of tickets)if(value.expiresAt<=clock())tickets.delete(key);if(tickets.size>=1000)fail('下载请求较多，请稍后再试',429);const ticket=randomBytes(24).toString('base64url');tickets.set(ticket,{session,expiresAt:clock()+ticketTtlMs});return {flower,downloadUrl:externalBase+'/api/flower?ticket='+ticket,format:'image/svg+xml',expiresInSeconds:Math.ceil(ticketTtlMs/1000),singleUse:true};}
 async function wait(session,args){const key=createHash('sha256').update(session).digest('hex');if((waiting.get(key)||0)>=2||[...waiting.values()].reduce((a,b)=>a+b,0)>=500)fail('已有等待请求，请完成后再继续',429);waiting.set(key,(waiting.get(key)||0)+1);try{return await wedding.waitForNotifications(session,args.timeoutMs,args.afterMessageId,args.afterSeq);}finally{const n=waiting.get(key)-1;if(n)waiting.set(key,n);else waiting.delete(key);}}
 const server=createServer(async(req,res)=>{
  res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');res.setHeader('vary','Origin, Accept-Encoding');
  const json=async(status,value)=>{let data=Buffer.from(JSON.stringify(value));if(data.length>1024&&/\bgzip\b/.test(req.headers['accept-encoding']||'')){data=await compress(data);res.setHeader('content-encoding','gzip');}res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(data);};
  try{
   const url=new URL(req.url,'http://localhost'),source=req.headers.origin;
   if(basePath){if(!url.pathname.startsWith(basePath+'/'))fail('接口不存在',404);url.pathname=url.pathname.slice(basePath.length);}
   // Trust explicit configuration, never spoofable Host/X-Forwarded-* headers.
   if(source&&!allowed.has(source))fail('来源不匹配',403);
   if(source&&url.pathname==='/mcp'){res.setHeader('access-control-allow-origin',source);res.setHeader('access-control-allow-methods','POST, OPTIONS');res.setHeader('access-control-allow-headers','Authorization, Content-Type, MCP-Protocol-Version');res.setHeader('access-control-max-age','600');}
   if(req.method==='OPTIONS'){if(url.pathname!=='/mcp')fail('方法不支持',405);if(req.headers['access-control-request-method']&&req.headers['access-control-request-method']!=='POST')fail('方法不支持',405);const headers=(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(h=>h.trim()).filter(Boolean);if(headers.some(h=>!['authorization','content-type','mcp-protocol-version'].includes(h)))fail('预检请求头不允许',403);res.writeHead(204);return res.end();}
   if(!['GET','POST'].includes(req.method))fail('方法不支持',405);
   const session=(req.headers.authorization||'').replace(/^Bearer /,'');
   if(url.pathname==='/api/admission'&&req.method==='GET')return await json(200,await admission());
   const admissionState=await admission();
   if(!admissionState.open&&url.pathname.startsWith('/api/')&&!['/api/health','/api/invitation','/api/invitation/prepare','/api/registration','/api/registration/settings','/api/machine-registration'].includes(url.pathname))return await json(423,{...admissionState,error:admissionState.message});
   if(url.pathname==='/api/registration'&&req.method==='GET')return await json(200,wedding.registration.status());
   if(url.pathname==='/api/registration'&&req.method==='POST'){limit(req.socket.remoteAddress,'registration');const b=await body(req);return await json(200,{...wedding.registration.register(b),admission:admissionState});}
   if(url.pathname==='/api/machine-registration'&&req.method==='GET')return await json(200,wedding.registration.machineStatus());
   if(url.pathname==='/api/machine-registration'&&req.method==='POST'){limit(req.socket.remoteAddress,'registration');const b=await body(req);return await json(200,{...wedding.registration.registerMachine(b),admission:admissionState});}
   if(url.pathname==='/api/flower'){
    if(req.method!=='GET')fail('方法不支持',405);const ticket=url.searchParams.get('ticket'),entry=ticket?tickets.get(ticket):null;
    if(ticket&&(!entry||entry.expiresAt<=clock()))fail('花卡链接已使用或过期，请本人重新领取',401);
    const flower=wedding.snapshot(entry?.session||session).flower;if(ticket)tickets.delete(ticket);
    const svg=flowerCardSvg(flower,tileImages[flower.index],{tile:true});res.writeHead(200,{'content-type':'image/svg+xml','content-disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(flower.name+'-纪念花.svg'),'cache-control':'no-store'});return res.end(svg);
   }
   if(url.pathname==='/api/health'){if(req.method!=='GET')fail('方法不支持',405);return await json(200,{ok:true,storage:wedding.storageKind,runtimeCodeVersion,...(siteMode==='joint-rehearsal'?{environment:siteMode,generation:testGeneration,testControls:Boolean(testScene)}:{})});}
   if(url.pathname.startsWith('/api/test/')&&!testScene)fail('接口不存在',404);
   if(url.pathname==='/api/test/roles'&&req.method==='GET')return await json(200,{roles:wedding.testRoles(session),environment:'joint-rehearsal'});
   if(url.pathname==='/api/state'){if(req.method!=='GET')fail('方法不支持',405);const snapshot=wedding.snapshot(session);return await json(200,url.searchParams.get('incremental')==='1'?incrementalWebView(snapshot,url.searchParams):snapshot);}
   if(url.pathname==='/rehearsal/api/state'){if(req.method!=='GET')fail('方法不支持',405);return await json(200,rehearsals.request(req.headers['x-wedding-rehearsal'],session));}
   if(url.pathname==='/api/messages'){if(req.method!=='GET')fail('方法不支持',405);return await json(200,await wedding.history(session,{beforeSeq:url.searchParams.has('beforeSeq')?Number(url.searchParams.get('beforeSeq')):undefined,limit:50}));}
   if(url.pathname==='/api/invitations'&&req.method==='GET')return await json(200,wedding.invitations.list(session));
   if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/rehearsal/api/')){
    if(req.method!=='POST')fail('方法不支持',405);
    const b=await body(req);limit(session||req.socket.remoteAddress,url.pathname.includes('join')||url.pathname.endsWith('start')||url.pathname.endsWith('invitation')?'join':b.type==='move'||b.type==='place_companion'||url.pathname==='/api/companion/place'?'move':'write');
    if(url.pathname==='/api/test/role')return await json(200,selectTestRole(session,b));
    if(url.pathname==='/api/registration/settings')return await json(200,wedding.registration.configure(session,b));
    if(url.pathname==='/api/test/reset/prepare')return await json(200,testScene.prepare(session));
    if(url.pathname==='/api/test/reset')return await json(200,testScene.reset(session,b));
    if(url.pathname==='/api/invitation')return await json(200,wedding.invitations.preview(b.invite));
    if(url.pathname==='/api/invitation/prepare')return await json(200,{...wedding.invitations.prepare(b.invite,b),admission:admissionState});
    if(url.pathname==='/api/invitations')return await json(200,wedding.invitations.manage(session,b.operation,b));
    if(url.pathname==='/api/companion')return await json(200,wedding.invitations.companion(session,b));
    if(url.pathname==='/api/companion/place')return await json(200,wedding.action(session,'place_companion',b));
    if(url.pathname==='/api/join')return await json(200,session?wedding.resumeGuest(session):wedding.joinGuest(b.invite,b));
    if(url.pathname==='/api/action')return await json(200,wedding.action(session,b.type,b.args));
    if(url.pathname==='/rehearsal/api/start')return await json(200,rehearsals.start(b,req.headers['x-wedding-rehearsal'],session));
    if(url.pathname==='/rehearsal/api/join')return await json(200,rehearsals.request(req.headers['x-wedding-rehearsal'],session,'resume'));
    if(url.pathname==='/rehearsal/api/action')return await json(200,rehearsals.request(req.headers['x-wedding-rehearsal'],session,b.type,b.args));
    if(url.pathname==='/rehearsal/api/companion/place')return await json(200,rehearsals.request(req.headers['x-wedding-rehearsal'],session,'place_companion',b));
    fail('接口不存在',404);
   }
   if(url.pathname==='/mcp'){
    if(req.method!=='POST')fail('方法不支持',405);const b=await body(req);let result;
    if(b.jsonrpc!=='2.0'||typeof b.method!=='string')return await json(200,{jsonrpc:'2.0',id:b.id??null,error:{code:-32600,message:'无效JSON-RPC请求'}});
    if(b.method==='initialize')result={protocolVersion:b.params?.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:siteMode==='joint-rehearsal'?'agent-wedding-joint-rehearsal':'agent-wedding',version:'0.3.0'}};
    else if(b.method==='notifications/initialized'){res.writeHead(202);return res.end();}
    else if(b.method==='tools/list')result={tools:advertisedTools()};
    else if(b.method==='tools/call'){
     try{
      const {name,arguments:args={}}=b.params||{};if(!args||typeof args!=='object'||Array.isArray(args))fail('工具参数必须是对象');let value,viewArgs=args;
      if(!admissionState.open){
       if(name==='wedding_join'&&args.invite){limit(req.socket.remoteAddress,'join');const invitation=wedding.invitations.preview(args.invite);if(!invitation.used)wedding.invitations.prepare(args.invite,args);}
       return await json(200,{jsonrpc:'2.0',id:b.id,result:{content:[{type:'text',text:JSON.stringify({waiting:true,...admissionState,message:admissionState.message+'无需持续wait或新开对话，到开放时间再join。'})}]}});
      }
      if(name==='wedding_join'){limit(req.socket.remoteAddress,'join');const joined=session?wedding.resumeGuest(session):wedding.joinGuest(args.invite,args);value={...wedding.snapshot(joined.session),session:joined.session};}
      else if(name==='wedding_state')value=wedding.snapshot(session);
      else if(name==='wedding_wait')value=await wait(session,args);
      else if(name==='wedding_flower'){limit(session);value=download(session);}
      else if(name==='wedding_action'){
       const op=args.action,params=args.args??{};viewArgs=params;if(!params||typeof params!=='object'||Array.isArray(params))fail('args必须是对象');
       if(op==='inspect')value=wedding.snapshot(session);
       else if(op==='test_role'&&testScene)value=selectTestRole(session,params);
       else if(op==='flower'){limit(session);value=download(session);}
       else{const legacy='wedding_'+op;if(!Object.hasOwn(actionTools,legacy))fail('未知操作');limit(session,op==='move'?'move':'write');value=wedding.action(session,actionTools[legacy],params);}
      }else{if(!Object.hasOwn(actionTools,name))fail('未知工具');limit(session,name==='wedding_move'?'move':'write');value=wedding.action(session,actionTools[name],args);}
      if(viewArgs.messageId&&value?.me)value={...value,message:await wedding.message(session,viewArgs.messageId)};
      result={content:[{type:'text',text:JSON.stringify(compactMcpView(value,viewArgs))}]};
      if(value?.me&&['wedding_join','wedding_action'].includes(name)){const view=JSON.parse(result.content[0].text);view.nextAction=value.me.away?'wedding_join':value.phase.id==='closed'?'finish_after_catchup':'wedding_wait';result.content[0].text=JSON.stringify(view);}
      if(siteMode==='joint-rehearsal'&&value?.me){const view=JSON.parse(result.content[0].text);view.environment=siteMode;if(view.guide)view.guide='【联合彩排，不是正式婚礼】这里没有自动代演角色，讲话和确认仅用于独立测试。'+view.guide;result.content[0].text=JSON.stringify(view);}
     }catch(e){result={isError:true,content:[{type:'text',text:e.message}],...(e.status===429?{retryAfterMs:1000}:{})};}
    }else return await json(200,{jsonrpc:'2.0',id:b.id,error:{code:-32601,message:'未知方法'}});
    return await json(200,{jsonrpc:'2.0',id:b.id,result});
   }
   if(req.method!=='GET')fail('方法不支持',405);
   const pathname=decodeURIComponent(url.pathname);if(pathname.split(/[\\/]/).some(p=>p.startsWith('.')&&p!==''))fail('不可访问',403);
   const file=resolve(publicRoot,'.'+(['/', '/rehearsal', '/rehearsal/'].includes(pathname)?'/index.html':pathname));if(!file.startsWith(resolve(publicRoot)+sep))fail('不可访问',403);
   const canonical=await realpath(file);if(!canonical.startsWith(canonicalRoot+sep))fail('不可访问',403);const info=await stat(canonical);if(!info.isFile())fail('未找到',404);
   let entry=files.get(canonical);if(!entry||entry.mtime!==info.mtimeMs||entry.size!==info.size){let data=await readFile(canonical);if(canonical===resolve(publicRoot,'index.html'))data=Buffer.from(data.toString().replace('<base href="/">',`<base href="${basePath}/">`).replace('<html lang="zh-CN">',`<html lang="zh-CN" data-site-mode="${siteMode}">`));entry={mtime:info.mtimeMs,size:info.size,data,etag:'"'+createHash('sha256').update(data).digest('hex')+'"'};if(files.size>100)files.clear();files.set(canonical,entry);}
   res.setHeader('etag',entry.etag);res.setHeader('cache-control',pathname.startsWith('/assets/')&&!pathname.startsWith('/assets/review/')?'public, max-age=86400':'public, max-age=0, must-revalidate');
   if(req.headers['if-none-match']?.split(',').map(s=>s.trim()).includes(entry.etag)){res.writeHead(304);return res.end();}
   res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(entry.data);
  }catch(e){if(!res.headersSent){if(e.status===429)res.setHeader('retry-after','1');await json(e.status||(e.code==='ENOENT'||e.code==='ENOTDIR'?404:400),e.code?{error:'资源不存在或暂时不可用'}:{error:e.message});}else res.destroy();}
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen(port,host,ok);});
 const address=server.address(),localOrigin='http://'+(host==='::1'?'[::1]':host)+':'+address.port;externalOrigin=publicOrigin||localOrigin;externalBase=externalOrigin+basePath;allowed.add(externalOrigin);
 try{await mkdir(directory,{recursive:true});const path=resolve(directory,'invitations.json');try{await access(path);}catch{if(seedDefaultInvites){
  const links=siteMode==='joint-rehearsal'?seedRehearsalCast(wedding).map(({profile:p,invite})=>({name:p.name,role:p.role,url:externalBase+'/#invite='+invite})):
   [['伴侣 A','bride'],['伴侣 B','groom'],['主持 Agent','host'],['证婚人','witness'],['送戒指 Agent','rings'],['测试来宾','guest']].map(([name,role])=>({name,role,url:externalBase+'/#invite='+wedding.invite(name,role)}));
  await writeFile(path,JSON.stringify(links,null,2));
 }}}catch(e){wedding.close();rehearsals.close();server.close();throw e;}
 return {server,get wedding(){return wedding;},origin:externalOrigin,localOrigin,tileBytes:tileImages.map(b=>b.length),async close(){wedding.close();rehearsals.close();const done=new Promise(ok=>server.close(ok));server.closeIdleConnections();await done;}};
}
