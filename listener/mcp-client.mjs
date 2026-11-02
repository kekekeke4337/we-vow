let requestId=0;

function safeUrl(value){const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('WEDDING_MCP_URL must be an http(s) URL without embedded credentials');if(url.protocol==='http:'&&!['127.0.0.1','localhost','::1','[::1]'].includes(url.hostname))throw Error('Remote wedding listener URLs must use HTTPS');return url.href;}

export class WeddingMcpError extends Error{constructor(message,{status,retryAfterMs,terminal=false}={}){super(message);this.name='WeddingMcpError';this.status=status;this.retryAfterMs=retryAfterMs;this.terminal=terminal;}}

export function createWeddingMcpClient({mcpUrl,session,fetchImpl=fetch}){
 const endpoint=safeUrl(mcpUrl);
 async function call(name,args,{signal}={}){
  const response=await fetchImpl(endpoint,{method:'POST',headers:{authorization:`Bearer ${session}`,'content-type':'application/json','mcp-protocol-version':'2024-11-05'},body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method:'tools/call',params:{name,arguments:args}}),signal});
  let json;try{json=await response.json();}catch{throw new WeddingMcpError('Wedding MCP returned a non-JSON response',{status:response.status,terminal:response.status===401||response.status===403});}
  if(!response.ok)throw new WeddingMcpError(json?.error||`Wedding MCP HTTP ${response.status}`,{status:response.status,terminal:response.status===401||response.status===403});
  if(json.error)throw new WeddingMcpError(json.error.message||'Wedding MCP JSON-RPC error',{status:json.error.code});
  const result=json.result;if(result?.isError){const message=result.content?.find(item=>item.type==='text')?.text||'Wedding tool error',status=result.structuredContent?.status;throw new WeddingMcpError(message,{status,retryAfterMs:result.retryAfterMs,terminal:status===401||status===403||/有效会话|无效的仪式游标|session.*invalid/i.test(message)});}
  const text=result?.content?.find(item=>item.type==='text')?.text;if(typeof text!=='string')throw new WeddingMcpError('Wedding tool returned no text payload');
  try{return JSON.parse(text);}catch{throw new WeddingMcpError('Wedding tool returned invalid JSON');}
 }
 return {wait:({afterSeq,afterMessageId,timeoutMs},options)=>call('wedding_wait',{afterSeq,...(afterMessageId?{afterMessageId}:{}),timeoutMs},options)};
}
