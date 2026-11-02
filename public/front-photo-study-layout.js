// Static review geometry only. Not imported by the live wedding or archive renderer.
export function allocateFrontPhotoStudy(people,width,height){
 const portrait=width<height,groups=[],singles=[];
 const xs=portrait?[-.42,-.30,-.18,-.06,.06,.18,.30,.42]:Array.from({length:14},(_,i)=>-.44+i*.88/13);
 const rows=portrait?[
  {xs,y:.44,row:0},{xs,y:.53,row:1},{xs,y:.62,row:2},
  {xs:[-.41,-.32,-.23,-.14,.14,.23,.32,.41],y:.71,row:3},
  {xs:[-.42,-.30,-.18,.18,.30,.42],y:.80,row:4},
 ]:[
  {xs,y:.65,row:0},
  {xs:[-.44,-.388,-.336,-.284,-.232,-.180,-.128,.128,.180,.232,.284,.336,.388,.44],y:.79,row:1},
  {xs:[-.44,-.37,-.30,-.23,-.16,.16,.23,.30,.37,.44],y:.92,row:2},
 ];
 for(const r of rows){
  // Keep sides separate except the back row's naturally continuous curve.
  const banks=r.row===0?[r.xs]:[r.xs.filter(x=>x<0),r.xs.filter(x=>x>0)];
  for(const bank of banks)for(let i=0;i<bank.length;i+=2){const points=bank.slice(i,i+2).map(x=>({x:.5+x,y:r.y+(portrait?0:.025*(1-Math.abs(x)/.44)),row:r.row}));(points.length===2?groups:singles).push(points);}
 }
 const score=g=>g.reduce((n,p)=>n+(p.x-.5)**2+(p.y-(portrait?.79:.88))**2,0)/g.length;
 while(singles.length<3){groups.sort((a,b)=>score(b)-score(a));const g=groups.shift();singles.push([g[0]],[g[1]]);}
 groups.sort((a,b)=>score(a)-score(b));singles.sort((a,b)=>score(a)-score(b));
 const result=new Map(),gap=portrait?.08:.055,coupleY=portrait?.81:.90;
 for(const p of people.filter(p=>p.kind==='couple'))result.set(p.id,{x:.5+(p.role==='bride'?-gap:gap),y:coupleY,row:portrait?4:2,kind:'couple'});
 const dedicatedPairs=new Map();
 for(const p of people.filter(p=>p.kind==='dedicated')){const key=p.character.set;if(!dedicatedPairs.has(key))dedicatedPairs.set(key,[]);dedicatedPairs.get(key).push(p);}
 for(const members of dedicatedPairs.values()){
  const slot=members.length===2?groups.shift():singles.shift();if(!slot)throw Error('Photo study lacks adjacent slots');
  members.forEach((p,i)=>result.set(p.id,{...slot[i],kind:'dedicated',pair:p.character.set}));
 }
 const remaining=[...groups.flat(),...singles.flat()].sort((a,b)=>a.row-b.row||a.x-b.x),fallback=people.filter(p=>p.kind==='fallback');
 if(remaining.length!==fallback.length)throw Error('Photo study count mismatch');fallback.forEach((p,i)=>result.set(p.id,{...remaining[i],kind:'fallback'}));
 if(result.size!==40)throw Error('Photo study must retain forty guests');return result;
}
