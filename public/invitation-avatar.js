import {directionalAtlas,drawDirectional,prebuiltDirectionStem} from './direction-art.js';

const previews=new Map();
function previewSource(person){
 const key=JSON.stringify([person.role||'guest',person.character||null,person.avatar||null]);
 if(!previews.has(key)){
  const promise=(async()=>{const stem=prebuiltDirectionStem(person);if(stem){const src='assets/world-frames/'+stem+'-down.png';try{const image=new Image();image.src=src;await image.decode();return src;}catch{/* Keep the composited fallback for missing prebuilt art. */}}
   const atlas=await directionalAtlas(person);if(!atlas)throw Error('此形象尚未登记');const canvas=document.createElement('canvas');drawDirectional(canvas,atlas,'down');return canvas.toDataURL('image/png');})();
  previews.set(key,promise);promise.catch(()=>{if(previews.get(key)===promise)previews.delete(key);});if(previews.size>32)previews.delete(previews.keys().next().value);
 }
 return previews.get(key);
}

// Read-only preview: selecting components never claims an invitation or alters a guest.
export function installInvitationAvatar(container){
 const figure=document.createElement('figure'),image=document.createElement('img'),status=document.createElement('figcaption');
 figure.id='arrival-avatar-preview';figure.style.cssText='margin:12px 0;text-align:center';
 image.alt='请柬形象预览';image.width=256;image.height=176;image.hidden=true;
 image.style.cssText='width:160px;height:110px;object-fit:contain;image-rendering:pixelated;max-width:100%';
 status.className='small-note';status.setAttribute('role','status');figure.append(image,status);container.after(figure);
 let revision=0;
 // Start loading composition layers when the visitor begins choosing, rather
 // than block the initial default portrait on several megabytes of PNG sheets.
 const warm=()=>{void directionalAtlas({role:'guest',character:{avatar:{}}}).catch(()=>{});};
 container.addEventListener('focusin',warm,{once:true});
 return async person=>{
  const current=++revision;figure.setAttribute('aria-busy','true');status.textContent=image.hidden?'正在预览形象…':'正在更新搭配…';
  try{
   const src=await previewSource(person);if(current!==revision)return;
   if(image.getAttribute('src')!==src)image.src=src;await image.decode();if(current!==revision)return;
   image.hidden=false;status.textContent='形象预览 · 签到后锁定，昵称仍可修改';
  }catch{if(current===revision)status.textContent='新搭配暂未加载成功，可稍后重试；不会消耗邀请。';}
  finally{if(current===revision)figure.setAttribute('aria-busy','false');}
 };
}
