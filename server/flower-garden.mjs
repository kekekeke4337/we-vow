import {guestGroups} from './movement.mjs';

function flowerBed(slot,large=false){
 const band=slot%3,row=Math.floor(slot/3);
 if(large)return band===2?{x:.37+(row%7)*.022,y:.63+Math.floor(row/7)*.035}:{x:band===0?.338:.522,y:.40+row*.014};
 return band===2?{x:.37+(row%7)*.022,y:.63+Math.sin(row*1.7)*.004}:{x:band===0?.338:.522,y:.40+(row%8)*.034};
}

export function freezeFlowerGarden(guests,id,at){
 // Three flower beds frame the lawn instead of hiding the central aisle.
 // New blooms use this layout; existing frozen gardens are never rearranged.
 const groups=guestGroups(guests),large=guests.length>40;let slot=0;
 const people=groups.flatMap(group=>{const couple=group.some(g=>['bride','groom'].includes(g.role)),{x,y}=couple?{x:.43,y:.375}:flowerBed(slot++,large);
  return group.map((g,i)=>({guestId:g.id,name:g.name,seed:g.seed,x:x+(group.length===2?(i ? .0035 : -.0035):0),y:y+(i ? .001 : 0),scale:.88+(g.seed%5)*.06}));
 });return {id,at,layoutVersion:large?'lawn-flower-beds-80-v2':'lawn-flower-beds-v1',people};
}

export function addGardenGuest(garden,guest){
 if(!garden||garden.people.some(p=>p.guestId===guest.id))return;
 // Late arrivals get a free patch; never move or replay flowers already planted.
 let position;
 for(let slot=0;slot<69&&!position;slot++)for(const offset of [-.0035,.0035]){
  const patch=flowerBed(slot,garden.layoutVersion==='lawn-flower-beds-80-v2'),x=patch.x+offset,y=patch.y;
  if(garden.people.every(p=>Math.abs(p.x-x)>.006||Math.abs(p.y-y)>.025)){position={x,y};break;}
 }
 position??={x:.30+(garden.people.length%10)*.025,y:.81};
 garden.people.push({guestId:guest.id,name:guest.name,seed:guest.seed,...position,scale:.88+(guest.seed%5)*.06});
}
