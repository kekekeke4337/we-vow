// A shared monotonic clock for walkers and ceremony overlays. Network samples
// adjust a target offset; animation time never jumps back on a slow response.
export function createMotionClock({now=()=>performance.now(),slew=.02}={}){
 let offset,target,lastLocal,lastTime=-Infinity,bestRtt=Infinity;const seen=new WeakSet();
 function time(at=now()){
  if(offset===undefined)return at;
  at=Math.max(at,lastLocal);
  const elapsed=Math.max(0,at-lastLocal),step=Math.max(-elapsed*slew,Math.min(elapsed*slew,target-offset));offset+=step;lastLocal=at;lastTime=Math.max(lastTime,at+offset);return lastTime;
 }
 function observe(serverTime,sent=now(),received=now()){
  if(![serverTime,sent,received].every(Number.isFinite)||received<sent)return;
  const rtt=received-sent,candidate=serverTime-(sent+received)/2;
  if(offset===undefined){offset=target=candidate;lastLocal=received;lastTime=received+offset;bestRtt=rtt;return;}
  time(received);bestRtt=Math.min(bestRtt,rtt);
  if(rtt<=bestRtt*2+80)target=target*.8+candidate*.2;
 }
 function observeSnapshot(value){if(!value||seen.has(value))return;seen.add(value);const at=now(),transport=value._transport;observe(value.serverTime,transport?.sentAt??at,transport?.receivedAt??at);}
 return {time,observe,observeSnapshot};
}
export const motionClock=createMotionClock();
