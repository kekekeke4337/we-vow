// Read existing raster alpha to register separate parts; never alter PNG pixels.
const cache=new WeakMap();
export function hairCapRegistration(atlas,frame){
 let entries=cache.get(atlas);if(!entries){entries=new Map();cache.set(atlas,entries);}const key=[frame.x,frame.y,frame.width,frame.height].join(':');if(entries.has(key))return entries.get(key);
 let left=Infinity,right=-Infinity;
 // Only the crown: a trailing braid/long hair must not change skull fitting.
 for(let y=frame.y;y<frame.y+frame.height*.36;y++)for(let x=frame.x;x<frame.x+frame.width;x++)if(atlas.alphaAt(x,y)>=48){left=Math.min(left,x);right=Math.max(right,x);}
 if(!Number.isFinite(left)||right<=left)throw Error('发型头顶登记无效');
 const width=right-left+1,scanY=Math.min(frame.y+frame.height-1,Math.round(frame.y+width*.65));let best=null,start=null;
 for(let x=left;x<=right+1;x++){
  if(x<=right&&atlas.alphaAt(x,scanY)<48){if(start===null)start=x;}
  else if(start!==null){const end=x-1;if(start>left&&end<right&&(!best||end-start>best.end-best.start))best={start,end};start=null;}
 }
 const result={center:(left+right)/2-frame.x,width,openingCenter:best?(best.start+best.end)/2-frame.x:(left+right)/2-frame.x};entries.set(key,result);return result;
}
export function scalpTop(atlas,frame){
 const center=Math.round(frame.x+frame.width/2);
 for(let y=frame.y;y<frame.y+frame.height;y++)if(atlas.alphaAt(center,y)>=48)return y-frame.y;
 throw Error('素体头顶登记无效');
}
