import {listenerConfigFromEnv} from '../listener/config.mjs';
import {createWeddingListenerWorker} from '../listener/worker.mjs';

const controller=new AbortController();let worker;
for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.on(signal,()=>controller.abort(signal));
process.on('message',message=>{if(message==='shutdown'||message?.type==='shutdown')controller.abort('process-message');});
try{
 const config=await listenerConfigFromEnv();worker=createWeddingListenerWorker(config);
 process.stdout.write(JSON.stringify({source:'agent-wedding-listener',event:'ready',identityKey:config.identityKey,sink:config.sink})+'\n');
 const final=await worker.run({signal:controller.signal});process.stdout.write(JSON.stringify({source:'agent-wedding-listener',event:'stopped',identityKey:config.identityKey,reason:final.stoppedReason})+'\n');
}catch(error){console.error(error);process.exitCode=1;}finally{worker?.close();if(process.connected)process.disconnect();}
