import {walkableMask} from './walkable-mask.js';
// Hand-marked on map v7: a small path graph kept as a fallback and for depth/occlusion checks.
export const scenePoints={checkin:[.14,.46],ceremony:[.43,.52],blessing:[.60,.43],games:[.75,.48],banquet:[.90,.55]};
export const walkwayNodes=[
 [.08,.66],[.11,.55],[.14,.46],[.18,.52],[.205,.565],[.25,.55],[.285,.56],[.325,.61],
 [.37,.635],[.43,.66],[.50,.66],[.55,.70],[.61,.745],[.67,.80],[.755,.765],[.78,.60],[.82,.52],[.87,.54],[.90,.55],[.95,.56],
 [.43,.52],[.43,.40],[.57,.58],[.60,.43],[.62,.37],[.75,.48],[.715,.80]
];
export const walkwayEdges=[[0,1],[1,2],[1,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,26],[26,14],[14,15],[15,16],[16,17],[17,18],[18,19],[9,20],[20,21],[11,22],[22,23],[23,24],[15,25],[25,16]];
export const pathDistance=(a,b)=>Math.hypot((a[0]-b[0])*3,a[1]-b[1]);
function projection(p,a,b){const dx=(b[0]-a[0])*3,dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,(((p[0]-a[0])*3)*dx+(p[1]-a[1])*dy)/length)):0;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
export function nearestWalkway(point){let best;for(const edge of walkwayEdges){const position=projection(point,walkwayNodes[edge[0]],walkwayNodes[edge[1]]),distance=pathDistance(point,position);if(!best||distance<best.distance)best={edge,position,distance};}return best;}
// The ceremony lawn is a designated walkable seating area, not an extra road.
// Kept for the legacy fallback; the mask planner below handles free movement.
export function ceremonyAccess(point){
 if(point[0]<.335||point[0]>.525||point[1]<.34||point[1]>.81)return null;
 return {aisle:[.43,point[1]],road:[.43,Math.max(.40,Math.min(.66,point[1]))]};
}
function planWalkGraph(from,target,{exact=false}={}){
 const entry=ceremonyAccess(from),exit=exact?ceremonyAccess(target):null;
 const start=nearestWalkway(entry?.road||from),end=nearestWalkway(exit?.road||target),nodes=[...walkwayNodes,start.position,end.position],s=nodes.length-2,t=s+1;
 const edges=[...walkwayEdges,[s,start.edge[0]],[s,start.edge[1]],[t,end.edge[0]],[t,end.edge[1]]];
 if(start.edge===end.edge)edges.push([s,t]);
 const distances=nodes.map(()=>Infinity),previous=[],unvisited=new Set(nodes.map((_,i)=>i));distances[s]=0;
 while(unvisited.size){let u;for(const i of unvisited)if(u===undefined||distances[i]<distances[u])u=i;if(u===t||!Number.isFinite(distances[u]))break;unvisited.delete(u);for(const [a,b]of edges){const v=a===u?b:b===u?a:undefined;if(v===undefined||!unvisited.has(v))continue;const length=distances[u]+pathDistance(nodes[u],nodes[v]);if(length<distances[v]){distances[v]=length;previous[v]=u;}}}
 const chain=[];for(let n=t;n!==undefined;n=previous[n])chain.unshift(nodes[n]);
 const destination=exact?target:end.position,path=[from,...(entry?[entry.aisle,entry.road]:[]),...chain,...(exit?[exit.road,exit.aisle]:[]),...(exact?[target]:[])].filter((p,i,a)=>!i||pathDistance(p,a[i-1])>.00001);
 return {destination,path};
}

// The mask is the source of truth for the walkable area. It is shared by server and browser.
const W=walkableMask.width,H=walkableMask.height,size=W*H,dirs=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
const walkable=new Uint8Array(size).fill(1);
for(const [y,runs]of walkableMask.rows||[])for(const [x,length]of runs)for(let i=0;i<length;i++)walkable[y*W+x+i]=0;
const component=new Int32Array(size).fill(-1),componentCells=[],allWalkable=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const start=y*W+x;if(!walkable[start]||component[start]>=0)continue;
 const id=componentCells.length,queue=[start],cells=[];component[start]=id;
 for(let q=0;q<queue.length;q++){
  const index=queue[q],cx=index%W,cy=(index/W)|0;cells.push(index);allWalkable.push(index);
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const next=ny*W+nx;if(walkable[next]&&component[next]<0){component[next]=id;queue.push(next);}}
 }
 componentCells.push(cells);
}
const cellAt=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&walkable[y*W+x]===1;
const cellOf=point=>[Math.max(0,Math.min(W-1,Math.floor(point[0]*W))),Math.max(0,Math.min(H-1,Math.floor(point[1]*H)))];
const center=([x,y])=>[(x+.5)/W,(y+.5)/H];
export const walkableAt=point=>{if(!Array.isArray(point)||!point.every(Number.isFinite)||point[0]<0||point[0]>=1||point[1]<0||point[1]>=1)return false;const [x,y]=cellOf(point);return cellAt(x,y);};
function nearestCell(cx,cy,id){
 const list=id===undefined?allWalkable:componentCells[id];if(!list?.length)return null;
 let best=list[0],bestDistance=Infinity;
 for(const index of list){const x=index%W,y=(index/W)|0,d=(x-cx)*(x-cx)+(y-cy)*(y-cy);if(d<bestDistance){bestDistance=d;best=index;}}
 return [best%W,(best/W)|0];
}
class MinHeap{
 constructor(){this.values=[];}
 push(value,priority){const a=this.values,i=a.length;a.push([priority,value]);let n=i;while(n){const p=(n-1)>>1;if(a[p][0]<=a[n][0])break;[a[p],a[n]]=[a[n],a[p]];n=p;}}
 pop(){const a=this.values;if(!a.length)return -1;const top=a[0][1],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){const left=i*2+1,right=left+1;let small=i;if(left<a.length&&a[left][0]<a[small][0])small=left;if(right<a.length&&a[right][0]<a[small][0])small=right;if(small===i)break;[a[i],a[small]]=[a[small],a[i]];i=small;}}return top;}
 get size(){return this.values.length;}
}
const heuristic=(x,y,tx,ty)=>{const dx=Math.abs(x-tx),dy=Math.abs(y-ty);return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy);};
function findCellPath(start,goal){
 const [sx,sy]=start,[gx,gy]=goal,startIndex=sy*W+sx,goalIndex=gy*W+gx;if(startIndex===goalIndex)return [start];
 const came=new Int32Array(size).fill(-1),g=new Float32Array(size).fill(Infinity),closed=new Uint8Array(size),heap=new MinHeap();
 g[startIndex]=0;heap.push(startIndex,heuristic(sx,sy,gx,gy));
 while(heap.size){
  const current=heap.pop();if(current===goalIndex)break;if(closed[current])continue;closed[current]=1;
  const cx=current%W,cy=(current/W)|0;
  for(const [dx,dy,cost]of dirs){const nx=cx+dx,ny=cy+dy;if(!cellAt(nx,ny))continue;if(dx&&dy&&(!cellAt(cx+dx,cy)||!cellAt(cx,cy+dy)))continue;const next=ny*W+nx;if(closed[next])continue;const score=g[current]+cost;if(score+1e-9<g[next]){g[next]=score;came[next]=current;heap.push(next,score+heuristic(nx,ny,gx,gy));}}
 }
 if(startIndex!==goalIndex&&came[goalIndex]===-1)return null;
 const cells=[];let index=goalIndex;while(index!==-1){cells.push([index%W,(index/W)|0]);if(index===startIndex)break;index=came[index];}
 const reached=cells.at(-1);return reached&&reached[0]===sx&&reached[1]===sy?cells.reverse():null;
}
function lineClear(a,b){
 const x0=a[0]+.5,y0=a[1]+.5,x1=b[0]+.5,y1=b[1]+.5,dx=x1-x0,dy=y1-y0;
 let cx=Math.floor(x0),cy=Math.floor(y0);const ex=Math.floor(x1),ey=Math.floor(y1),stepX=Math.sign(dx),stepY=Math.sign(dy),deltaX=dx?Math.abs(1/dx):Infinity,deltaY=dy?Math.abs(1/dy):Infinity;
 let maxX=dx?Math.abs(((stepX>0?cx+1:cx)-x0)/dx):Infinity,maxY=dy?Math.abs(((stepY>0?cy+1:cy)-y0)/dy):Infinity;
 if(!cellAt(cx,cy))return false;
 while(cx!==ex||cy!==ey){
  if(maxX<maxY){cx+=stepX;maxX+=deltaX;}
  else if(maxY<maxX){cy+=stepY;maxY+=deltaY;}
  else{if(!cellAt(cx+stepX,cy)||!cellAt(cx,cy+stepY))return false;cx+=stepX;cy+=stepY;maxX+=deltaX;maxY+=deltaY;}
  if(!cellAt(cx,cy))return false;
 }
 return true;
}
function simplify(cells){
 if(cells.length<=2)return cells;
 const out=[cells[0]];let i=0;
 while(i<cells.length-1){let j=cells.length-1;while(j>i+1&&!lineClear(cells[i],cells[j]))j--;out.push(cells[j]);i=j;}
 return out;
}
export function planWalk(from,target,{exact=false}={}){
 const [fcx,fcy]=cellOf(from),[tcx,tcy]=cellOf(target);
 const start=nearestCell(fcx,fcy);if(!start)return planWalkGraph(from,target,{exact});
 const startComponent=component[start[1]*W+start[0]],targetWalkable=cellAt(tcx,tcy),targetInStart=targetWalkable&&component[tcy*W+tcx]===startComponent;
 const goal=targetInStart?[tcx,tcy]:nearestCell(tcx,tcy,startComponent);if(!goal)return planWalkGraph(from,target,{exact});
 const grid=p=>[p[0]*W-.5,p[1]*H-.5];
 if(targetInStart&&walkableAt(from)&&lineClear(grid(from),grid(target)))return {destination:target,path:pathDistance(from,target)>1e-4?[from,target]:[from]};
 const cells=findCellPath(start,goal);if(!cells)return planWalkGraph(from,target,{exact});
 const destination=exact?target:targetInStart?target:center(goal),path=[from];
 const points=simplify(cells).map(center);
 // The current position already lies in its start cell. Do not make a tiny
 // backwards detour through that cell's centre before continuing the route.
 if(walkableAt(from)&&points.length>1&&lineClear(grid(from),grid(points[1])))points.shift();
 if(points.length>1&&targetInStart&&lineClear(grid(points.at(-2)),grid(destination)))points.pop();
 for(const point of points)if(pathDistance(point,path.at(-1))>1e-4)path.push(point);
 if(pathDistance(path.at(-1),destination)>1e-4)path.push(destination);
 return {destination,path};
}
export function sampleWalk(motion,now,fallback){
 if(!motion?.path?.length)return {position:fallback,moving:false,direction:'down'};
 const fraction=Math.max(0,Math.min(1,(now-motion.startedAt)/motion.duration)),path=motion.path;
 let total=0;for(let i=1;i<path.length;i++)total+=pathDistance(path[i-1],path[i]);let remaining=total*fraction;
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],length=pathDistance(a,b);if(remaining<=length||i===path.length-1){const ratio=length?Math.max(0,Math.min(1,remaining/length)):1,dx=(b[0]-a[0])*3,dy=b[1]-a[1];return {position:fraction===1?path.at(-1):[a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio],moving:fraction<1,direction:Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up'};}remaining-=length;}
 return {position:path.at(-1),moving:false,direction:'down'};
}
