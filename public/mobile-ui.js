// Match short landscape screens too: modern phones can be wider than 900 CSS px.
import {installMobileDialogs} from './mobile-dialogs.js';
export const mobileQuery='(max-width: 700px), (max-width: 1100px) and (max-height: 600px)';
export function installMobileUI(){
 const garden=document.querySelector('#garden'),ceremony=document.querySelector('.ceremony-card'),chat=document.querySelector('.chat-panel');
 ceremony.id='ceremony-panel';chat.id='chat-panel';
 const query=matchMedia(mobileQuery),buttons=[...document.querySelectorAll('[data-mobile-panel]')];
 const profile=document.querySelector('#profile-panel'),profileToggle=document.querySelector('#profile-toggle');
 profile.append(document.querySelector('#invitation-tools'));
 function closeProfile(){profile.hidden=true;profileToggle.setAttribute('aria-expanded','false');}
 profileToggle.addEventListener('click',()=>{const open=profile.hidden;panel();profile.hidden=!open;profileToggle.setAttribute('aria-expanded',String(open));});
 document.querySelector('#profile-close').addEventListener('click',()=>{closeProfile();profileToggle.focus();});
 document.querySelector('#profile-seed').onclick=()=>document.querySelector('#flower-action').click();
 document.querySelector('#profile-checkin').onclick=()=>document.querySelector('[data-action="sign"]').click();
 installMobileDialogs(query);
 const viewport=document.querySelector('#world-viewport');let zoom=1.45,mapFrame;
 function mapSize(){
  if(!query.matches||!viewport.clientWidth||!viewport.clientHeight)return;
  // Keep a readable world scale on short/narrow landscape phones. Sprites have
  // a minimum display size; shrinking the map below this reference viewport
  // otherwise piles adjacent rows on top of one another. Zoom buttons retain
  // their existing relative range and positions; larger viewports are unchanged.
  const width=Math.round(Math.max(Math.max(viewport.clientWidth,844)*zoom,viewport.clientHeight*3));
  garden.style.setProperty('--mobile-map-width',width+'px');garden.style.setProperty('--mobile-map-height',width/3+'px');
  document.querySelector('#map-zoom-out').disabled=zoom<=1.15;document.querySelector('#map-zoom-in').disabled=zoom>=2.05;
  viewport.setAttribute('aria-label',`可左右探索的像素婚礼世界，视野${viewport.clientWidth}×${viewport.clientHeight}，可用加减按钮缩放`);
  window.dispatchEvent(new Event('wedding:map-resized'));
 }
 function scheduleMap(){cancelAnimationFrame(mapFrame);mapFrame=requestAnimationFrame(mapSize);}
 new ResizeObserver(scheduleMap).observe(viewport);window.visualViewport?.addEventListener('resize',scheduleMap);
 for(const [id,delta]of [['map-zoom-out',-.15],['map-zoom-in',.15]])document.getElementById(id).onclick=()=>{zoom=Math.max(1.15,Math.min(2.05,Math.round((zoom+delta)*100)/100));mapSize();};
 const controls=['rehearsal-reset','pause-button','phase-button'].map(id=>{const el=document.getElementById(id),anchor=document.createComment('desktop '+id);el.before(anchor);return {el,anchor};});
 function panel(name=''){
  closeProfile();
  garden.dataset.mobilePanel=name;
  for(const button of buttons)button.setAttribute('aria-expanded',String(button.dataset.mobilePanel===name));
  if(name==='chat'){chat.classList.remove('collapsed');document.querySelector('#chat-toggle').textContent='×';}
 }
 function resize(){
  panel();
  for(const {el,anchor}of controls){if(query.matches)document.querySelector('#mobile-ceremony-controls').append(el);else anchor.after(el);}
  document.querySelector('#chat-toggle').textContent='×';
  scheduleMap();
 }
 for(const button of buttons)button.addEventListener('click',()=>panel(garden.dataset.mobilePanel===button.dataset.mobilePanel?'':button.dataset.mobilePanel));
 document.querySelectorAll('.mobile-panel-close').forEach(button=>button.addEventListener('click',()=>{const previous=garden.dataset.mobilePanel;panel();buttons.find(b=>b.dataset.mobilePanel===previous)?.focus();}));
 document.querySelector('#chat-toggle').addEventListener('click',()=>{panel();buttons.find(b=>b.dataset.mobilePanel==='chat')?.focus();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){if(!profile.hidden){closeProfile();profileToggle.focus();}else if(garden.dataset.mobilePanel){const previous=garden.dataset.mobilePanel;panel();buttons.find(button=>button.dataset.mobilePanel===previous)?.focus();}}});
 viewport.addEventListener('click',event=>{if(event.target.closest('.map-hotspot'))return;panel();});
 query.addEventListener('change',resize);resize();
 let phase;
 return {render(state){const initial=document.querySelector('#profile-initial');if(!initial.querySelector('img')&&initial.textContent!==state.me.name.slice(0,1))initial.textContent=state.me.name.slice(0,1);document.querySelector('#profile-name').textContent=state.me.name;document.querySelector('#profile-status').textContent=state.me.canSpeak?'已签到 · 当前可以公屏发言':'已签到 · 当前公屏只读，仍可观礼';document.querySelector('#profile-seed').textContent=state.bloomed?'看看我的花':'看看我的种子';document.querySelector('#moment-peek-label').textContent=state.phase.label+(state.paused?' · 暂停':'');if(state.phase.id!==phase){phase=state.phase.id;if(state.me.canConfirm)panel('ceremony');if(state.me.role==='rings'&&state.phase.id==='rings')panel('actions');}}};
}
