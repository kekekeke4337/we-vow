import {botanicalIndex,botanicalNames} from './botanicals.js';

export function installSharedGarden(track,toast){
 const root=document.createElement('div');root.id='shared-flower-garden';root.setAttribute('aria-label','所有来宾共同开花的草坪');root.hidden=true;track.append(root);
 const entries=new Map();let gardenId;
 return snapshot=>{
  const garden=snapshot.bloomed&&snapshot.bloomGarden;
  if(!garden){root.hidden=true;root.replaceChildren();entries.clear();gardenId=null;return new Set();}
  if(garden.id!==gardenId){root.replaceChildren();entries.clear();gardenId=garden.id;root.dataset.bloomId=garden.id;}
  root.hidden=false;
  for(const person of garden.people){
   let flower=entries.get(person.guestId);
   if(!flower){flower=document.createElement('button');flower.type='button';flower.className='shared-flower botanical';flower.dataset.guestId=person.guestId;
    const index=botanicalIndex(person.seed);flower.dataset.flowerIndex=index;flower.style.backgroundPosition=`${index%4/3*100}% ${Math.floor(index/4)*100}%`;
    flower.style.setProperty('--flower-x',person.x*100+'%');flower.style.setProperty('--flower-y',person.y*100+'%');
    flower.style.setProperty('--flower-scale',String(person.scale||1));
    flower.style.setProperty('--bloom-elapsed',-Math.max(0,snapshot.serverTime-garden.at)+'ms');
    flower.title=person.name+' · '+botanicalNames[index];flower.setAttribute('aria-label',person.name+'的'+botanicalNames[index]);
    flower.onclick=event=>{event.stopPropagation();toast(flower.title+(person.guestId===snapshot.me.id?' · 你的花卡可从“我的花”下载':''));};
    entries.set(person.guestId,flower);root.append(flower);
   }
   flower.classList.toggle('is-own',person.guestId===snapshot.me.id);
  }
  return new Set(entries.keys());
 };
}
