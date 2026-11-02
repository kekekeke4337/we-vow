export const frontPhotoVersion='front-photo-v2';
export const largeFrontPhotoVersion='front-photo-80-v3';
export const isFrontPhoto=photo=>[frontPhotoVersion,largeFrontPhotoVersion].includes(photo?.layoutVersion);
export const frontPhotoBackground='assets/studies/front-photo-backdrop-v1.png';
// Runtime counterpart of the approved front-v2 study. Real ID groups replace
// the study's fixed forty-person cast; no grouping by nickname or species.
export function allocateFrontPhoto(people,{large=false}={}){
 if(!Array.isArray(people)||people.length>(large?80:40)||new Set(people.map(p=>p.id)).size!==people.length)throw Error('近景合影需要不重复且不超过'+(large?80:40)+'位的真实名单');
 const couple=people.filter(p=>['bride','groom'].includes(p.role)),regular=people.filter(p=>!couple.includes(p)),groups=new Map();
 for(const p of regular){const id=p.groupId||p.id;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(p);}
 if([...groups.values()].some(g=>g.length>2))throw Error('合影伙伴组不能超过两位');
 const slots=[],backCount=regular.length>38?16:14;
 const banks=large?[]:[{xs:Array.from({length:backCount},(_,i)=>.06+i*.88/(backCount-1)),y:.65,row:0,bank:0}];
 if(large){for(let row=0;row<5;row++)for(const side of [-1,1]){const inner=row===4?.14:.055;banks.push({xs:Array.from({length:8},(_,i)=>.5+side*(inner+(.44-inner)*i/7)).sort((a,b)=>a-b),y:.39+row*.13,row,bank:side});}}
 else for(const [row,y,inner]of [[1,.79,.14],[2,.92,.17]])for(const side of [-1,1])banks.push({xs:Array.from({length:6},(_,i)=>.5+side*(inner+(.44-inner)*i/5)).sort((a,b)=>a-b),y,row,bank:side});
 for(const b of banks)b.xs.forEach((x,i)=>slots.push({x,y:b.y+.025*(1-Math.abs(x-.5)/.44),row:b.row,bank:b.bank,index:i}));
 const used=new Set(),result=new Map(),score=items=>items.reduce((n,p)=>n+(p.x-.5)**2+(p.y-.90)**2,0)/items.length;
 // Reserve adjacent pairs first, then assign singles. This also handles forty
 // attendees arriving as twenty pairs, not just the review page's sample mix.
 const ordered=[...groups.values()].sort((a,b)=>b.length-a.length||Number(b.some(p=>p.character?.custom))-Number(a.some(p=>p.character?.custom))||String(a[0].id).localeCompare(String(b[0].id)));
 for(const group of ordered){
  const options=[];for(const s of slots){if(used.has(s))continue;if(group.length===1)options.push([s]);else{const next=slots.find(n=>!used.has(n)&&n.row===s.row&&n.bank===s.bank&&n.index===s.index+1);if(next)options.push([s,next]);}}
  options.sort((a,b)=>score(a)-score(b));const selected=options[0];if(!selected)throw Error('近景合影相邻位置不足');
  group.forEach((p,i)=>{used.add(selected[i]);result.set(p.id,{...selected[i],kind:p.character?.custom?'dedicated':'fallback'});});
 }
 for(const p of couple)result.set(p.id,{x:.5+(couple.length===1?0:p.role==='bride'?-.055:.055),y:large?.955:.90,row:large?4:2,kind:'couple'});
 return result;
}
