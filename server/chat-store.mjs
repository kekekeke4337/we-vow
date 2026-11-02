import {appendFileSync,existsSync,writeFileSync,createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {join} from 'node:path';
// Keep live snapshots small; archive is append-only and never served as a static file.
export function createChatStore({directory,state,persistence}){
 const file=!persistence&&directory&&join(directory,'messages.jsonl'),pending=[];
 state.messageSeq??=Math.max(0,...state.messages.map(m=>m.seq||0));
 for(const m of state.messages)if(!m.seq)m.seq=++state.messageSeq;
 if(file&&!existsSync(file))writeFileSync(file,state.messages.map(m=>JSON.stringify(m)+'\n').join(''));
 let bytes=state.messages.reduce((n,m)=>n+Buffer.byteLength(m.text),0);
 function trim(){while(state.messages.length>200||(bytes>256*1024&&state.messages.length>1))bytes-=Buffer.byteLength(state.messages.shift().text);}
 trim();
 return {
  append(message){message.seq=state.messageSeq+1;if(file)appendFileSync(file,JSON.stringify(message)+'\n');if(persistence)pending.push(message);state.messageSeq=message.seq;state.messages.push(message);bytes+=Buffer.byteLength(message.text);trim();},
  pending:()=>pending,flushed(){pending.length=0;},rollback(){pending.length=0;bytes=state.messages.reduce((n,m)=>n+Buffer.byteLength(m.text),0);},
  async find(id){const recent=state.messages.find(m=>m.id===id);if(recent)return recent;if(persistence)return persistence.find(id);if(!file)return null;const input=createReadStream(file,{encoding:'utf8'}),lines=createInterface({input,crlfDelay:Infinity});try{for await(const line of lines){if(!line)continue;const m=JSON.parse(line);if(m.id===id)return m;}return null;}finally{lines.close();input.destroy();}},
  async history(beforeSeq=Infinity,limit=50){
   if(persistence)return persistence.history(beforeSeq,limit);
   if(!Number.isInteger(limit)||limit<1||limit>100||!(beforeSeq===Infinity||Number.isSafeInteger(beforeSeq)&&beforeSeq>0))throw Object.assign(new Error('无效聊天历史游标'),{status:400});
   const result=[];let total=0;
   const consider=m=>{if(m.seq<beforeSeq){result.push(m);total++;if(result.length>limit)result.shift();}};
   if(file){const input=createReadStream(file,{encoding:'utf8'}),lines=createInterface({input,crlfDelay:Infinity});try{for await(const line of lines)if(line)consider(JSON.parse(line));}finally{lines.close();input.destroy();}}else state.messages.forEach(consider);
   return {messages:result,hasMore:total>limit,beforeSeq:result[0]?.seq||null};
  }
 };
}
