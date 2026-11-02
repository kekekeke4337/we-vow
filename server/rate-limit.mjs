import {createHash} from 'node:crypto';
export function createRateLimiter({clock=Date.now}={}){
 const buckets=new Map();
 return function limit(identity,category='write'){
  // Reverse-proxied visitors may share one socket IP: allow 20 people plus one
  // recovery each, then refill slowly. The durable quota is a separate bound.
  // Allow short join bursts for guests sharing a network address.
  // arrivals plus recovery. Continuous refill and all other limits stay intact.
  const now=clock(),key=category+':'+createHash('sha256').update(identity).digest('hex'),rate=category==='registration'?1/10:category==='move'?8:category==='join'?1:20,burst=category==='registration'?40:category==='move'?12:category==='join'?100:40;
  if(buckets.size>=10000){for(const [id,b]of buckets)if(now-b.at>60000)buckets.delete(id);if(buckets.size>=10000&&!buckets.has(key))throw Object.assign(new Error('请求较多，请稍后再试'),{status:429});}
  const b=buckets.get(key)||{tokens:burst,at:now};b.tokens=Math.min(burst,b.tokens+(now-b.at)*rate/1000);b.at=now;buckets.set(key,b);
  if(b.tokens<1)throw Object.assign(new Error('操作太快，请稍等再试'),{status:429});b.tokens--;
 };
}
