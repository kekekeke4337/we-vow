import {rehearsalProfiles,rehearsalVersion} from './rehearsal-profiles.js';
import {directionalAtlas,drawDirectional} from './direction-art.js';

export function installRehearsalPicker({start,toast}){
 const dialog=document.createElement('dialog');dialog.id='rehearsal-picker';dialog.tabIndex=-1;
 dialog.style.cssText='width:min(900px,94vw);max-height:88dvh;overflow:auto;border:1px solid #8eaa91;border-radius:16px;background:#fffaf0;padding:20px';
 const title=document.createElement('h2');title.textContent='独立彩排 · 选择身份';
 const note=document.createElement('p');note.textContent=rehearsalVersion+' · 以下均为模拟身份，不代表本人。选择后新建一轮独立演练，关闭本标签页的上一轮；不重置人机联测或正式现场，不消耗正式请柬。角色权限与正式规则共用；另有明确标注的演练推进按钮。';
 const list=document.createElement('div');list.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px';
 const close=document.createElement('button');close.textContent='返回';close.onclick=()=>dialog.close();
 dialog.append(title,note,list,close);document.body.append(dialog);let loaded=false;
 const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.loadPreview();observer.unobserve(entry.target);}},{root:dialog,rootMargin:'80px'}):null;
 async function fill(){
  if(loaded)return;loaded=true;
  for(const p of rehearsalProfiles){
   const button=document.createElement('button');button.type='button';button.dataset.identity=p.id;
   button.style.cssText='display:flex;flex-direction:column;align-items:center;padding:10px;background:#edf3e5;border:1px solid #bac9b6;border-radius:10px;color:#294438';
   const img=document.createElement('img');img.width=128;img.height=88;img.alt=p.name+'四方向定稿正面预览';img.style.cssText='image-rendering:pixelated;object-fit:contain';
   const name=document.createElement('b');name.textContent=p.name;
   const role=document.createElement('small');role.textContent=p.role==='guest'?'普通来宾':({bride:'新人 A · 控制流程',groom:'新人 B · 本人确认',host:'主持 · 开场',rings:'送戒指人',witness:'证婚人 · 讲话'})[p.role];
   const art=document.createElement('small');art.textContent='通用可组合形象';
   button.append(img,name,role,art);button.title=p.roleNote;
   button.onclick=async()=>{button.disabled=true;try{if(await start(p.id))dialog.close();}finally{button.disabled=false;}};
   list.append(button);
   button.loadPreview=()=>{if(img.dataset.started)return;img.dataset.started='1';img.decoding='async';
    img.onerror=()=>{img.onerror=null;directionalAtlas(p).then(atlas=>{const c=document.createElement('canvas');drawDirectional(c,atlas,'down');img.src=c.toDataURL('image/png');}).catch(()=>{img.remove();art.textContent='预览加载失败，请重试';});};
    img.src=p.artFile?'assets/previews/'+p.id.replaceAll(':','-')+'.png':'assets/world-frames/generic-default-v2-down.png';
   };
   if(observer)observer.observe(button);else button.loadPreview();
  }
 }
 return ()=>{fill().catch(e=>toast(e.message));if(!dialog.open)dialog.showModal();dialog.focus({preventScroll:true});dialog.scrollTop=0;};
}
