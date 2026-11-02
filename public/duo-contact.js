// Manual anatomical registration plus bounded pixel-edge correction. Alpha
// locates the edge of a registered region, not a hand or mouth by itself.
export function registeredDuoContact(atlas,frame,source){
 const x=Math.round((frame.width-1)*source.contact[0]),y=Math.round((frame.height-1)*source.contact[1]);
 const solid=(xx,yy)=>xx>=0&&yy>=0&&xx<frame.width&&yy<frame.height&&atlas.alphaAt(frame.x+xx,frame.y+yy)>=96;
 if(source.contactProjection==='front-edge'){
  const right=source.facing==='right';
  for(let xx=right?frame.width-1:0;right?xx>=0:xx<frame.width;xx+=right?-1:1)if(solid(xx,y))return [xx,y];
  throw Error('已登记的嘴部扫描线没有人物像素');
 }
 if(source.contactProjection==='nearest-solid'&&!solid(x,y)){
  let best=null,distance=Infinity;const radius=Math.ceil(frame.height*.08);
  for(let yy=Math.max(0,y-radius);yy<=Math.min(frame.height-1,y+radius);yy++)for(let xx=Math.max(0,x-radius);xx<=Math.min(frame.width-1,x+radius);xx++)if(solid(xx,yy)){
   const d=(xx-x)**2+(yy-y)**2;if(d<distance){distance=d;best=[xx,yy];}
  }
  if(!best)throw Error('已登记的手臂区域没有人物像素');return best;
 }
 return [x,y];
}
