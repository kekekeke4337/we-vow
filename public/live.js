import {installActivities} from './activities.js';
import {botanicalNames,botanicalIndex} from './botanicals.js';
import {installInvitations} from './invitations.js';
import {loadMapDataUrl} from './map-art.js';
import {installMobileUI,mobileQuery} from './mobile-ui.js';
import {installWalkingUI} from './walking-ui.js';
import {installSharedGarden} from './shared-garden.js';
import {installTestControls} from './test-controls.js';
import {installCompanionPlacement} from './companion-placement.js';
import {directionArtVersion,directionalAtlas,directionalIdentity,drawDirectional} from './direction-art.js';
import {basePath,jointRehearsal} from './site.js';
import {installRehearsalPicker} from './rehearsal-picker.js';
import {installCeremonyArt} from './ceremony-art.js';
import {installRingDeliveryArt} from './ring-delivery-art.js';
import {installPrewedding} from './prewedding.js';
import {installPublicRegistration} from './public-registration.js';
import {ceremonyTime,checkinTime,invitationDeadline} from './event-info.js';
import {isFrontPhoto} from './front-photo-layout.js';
import {stageLayout,photoStageLayout} from './stage-layout.js';
import {motionClock} from './motion-clock.js';
import {createSnapshotOrder} from './snapshot-order.js';
import {photoNameLines} from './photo-name.js';
import {groupCaptionVersion,planGroupCaptions} from './photo-captions.js';
const $=s=>document.querySelector(s);
const isRehearsal=location.pathname.slice(basePath.length).startsWith('/rehearsal'),sessionPrefix=jointRehearsal?'wedding.joint':'wedding',sessionKey=sessionPrefix+(isRehearsal?'.rehearsal.session':'.session'),rehearsalIdKey=sessionPrefix+'.rehearsal.id';
let rehearsalId=sessionStorage.getItem(rehearsalIdKey);
if(jointRehearsal){document.querySelector('#invitation .eyebrow').textContent='JOINT REHEARSAL · 联合彩排';document.querySelector('.invitation-copy').textContent='人和机共同参加的独立测试现场。不自动代演，不记录为正式婚礼。';document.querySelector('.date-rule em').textContent='联测 · 请使用测试专属邀请';document.querySelector('.topbar b').textContent='OUR WEDDING · 联测';}
document.querySelector('.topbar a[href="/rehearsal/"]').href=basePath+'/rehearsal/';
let rehearsalRecoveryTried=false;
const stops=[['checkin','签到台',.09,.58],['ceremony','仪式现场',.38,.62],['blessing','祝福花房',.58,.52],['games','林间游乐',.70,.58],['banquet','月光宴会',.89,.67]];
let state,session=sessionStorage.getItem(sessionKey)||(!isRehearsal?localStorage.getItem(sessionKey):null),place=0,busy=false,lastPhase,photoNotice,toastTimer,ownScene,connectionLost=false,companionPlacement;
let away=sessionStorage.getItem(sessionKey+'.away')==='1'||(!isRehearsal&&localStorage.getItem(sessionKey+'.away')==='1');
function rememberAway(value,mode){away=value;for(const storage of isRehearsal?[sessionStorage]:[sessionStorage,localStorage]){if(value){storage.setItem(sessionKey+'.away','1');if(mode)storage.setItem(sessionKey+'.departure',mode);}else{storage.removeItem(sessionKey+'.away');storage.removeItem(sessionKey+'.departure');}}$('#return-wedding').hidden=!session||!away;$('#return-wedding').textContent=(sessionStorage.getItem(sessionKey+'.departure')||localStorage.getItem(sessionKey+'.departure'))==='final'?'重新入场（需本人确认）':'用原身份返回现场';}
function rememberSession(value){session=value;if(value)sessionStorage.setItem(sessionKey,value);else sessionStorage.removeItem(sessionKey);if(!isRehearsal){if(value)localStorage.setItem(sessionKey,value);else localStorage.removeItem(sessionKey);}rememberAway(false);}
const markers=new Map();
const bloomShown=new Set(),bloomAcknowledged=new Set();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const show=id=>document.querySelectorAll('.scene').forEach(s=>{const active=s.id===id;if(s.classList.contains('active')!==active)s.classList.toggle('active',active);});
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
let transportSequence=0;const snapshotOrder=createSnapshotOrder();
async function api(path,body){
 const sentAt=performance.now(),requestId=++transportSequence;
 const headers={'content-type':'application/json'};
 if(session)headers.authorization=`Bearer ${session}`;
 if(isRehearsal&&rehearsalId)headers['x-wedding-rehearsal']=rehearsalId;
 if(path==='/api/state'&&!body&&!isRehearsal){const params=new URLSearchParams({incremental:'1'});if(state?.me.id&&session){if(state.messageCursor)params.set('afterMessageId',state.messageCursor);else if(state.messages?.length)params.set('afterMessageId',state.messages.at(-1).id);if(state.blessingVersion)params.set('blessingVersion',state.blessingVersion);if(state.boothVersion)params.set('boothVersion',state.boothVersion);}path+='?'+params;}
 if(path.startsWith('/api/state?')&&state?.gardenVersion)path+='&gardenVersion='+encodeURIComponent(state.gardenVersion);
 const r=await fetch(basePath+(isRehearsal?'/rehearsal':'')+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});
 const value=await r.json();if(!r.ok)throw Object.assign(new Error(value.error||'连接失败'),{status:r.status});Object.defineProperty(value,'_transport',{value:{sentAt,receivedAt:performance.now(),requestId},enumerable:false});return value;
}
async function act(type,args={}){const activeSession=session;try{const s=await api('/api/action',{type,args});if(session!==activeSession)return null;if(type!=='leave')render(s);return s;}catch(e){if(session===activeSession)toast(e.message);return null;}}
const activities=installActivities({act,getState:()=>state,toast});
const invitations=installInvitations({api,act,getState:()=>state,isRehearsal,toast,restore:async id=>{const saved=localStorage.getItem(sessionKey);if(!saved)return false;session=saved;try{const current=await api('/api/state');if(current.me.id!==id){session=null;return false;}await api('/api/join',{});rememberSession(saved);render(await api('/api/state'));show('garden');return true;}catch{session=null;return false;}}});
const prewedding=installPrewedding({api,show,invitations,isRehearsal,jointRehearsal,toast,resume:()=>{if(!session)return false;show('garden');void poll();return true;}});
const publicRegistration=installPublicRegistration({api,show,invitations,toast,onPrepared:value=>prewedding.acceptPrepared(value)});
$('#invitation-schedule').textContent=ceremonyTime+'\n'+(jointRehearsal?'测试场可提前彩排 · 正式场建议19:20签到':checkinTime);
$('#waiting-schedule').textContent=ceremonyTime+'\n'+checkinTime+'\n'+invitationDeadline+(jointRehearsal?'\n这是独立联测，可提前彩排；正式请柬另行发送。':'');
function camera(){const v=$('#world-viewport'),t=$('#world-track'),hotspot=$(`.map-hotspot[data-place-index="${place}"]`),normalFocusY=((parseFloat(hotspot.style.getPropertyValue('--map-y'))/100)+stops[place][3])/2,focusY=place===1&&v.clientWidth<700?Math.min(normalFocusY,.55):normalFocusY;v.scrollTo({left:Math.max(0,Math.min(t.offsetWidth-v.clientWidth,t.offsetWidth*stops[place][2]-v.clientWidth/2)),top:matchMedia(mobileQuery).matches?Math.max(0,Math.min(t.offsetHeight-v.clientHeight,t.offsetHeight*focusY-v.clientHeight/2)):0,behavior:'smooth'});document.querySelectorAll('[data-place-index]').forEach(b=>b.classList.toggle('active',Number(b.dataset.placeIndex)===place));}
async function visit(i){place=(i+5)%5;camera();if(companionPlacement?.isActive())return;return act('move',{scene:stops[place][0]});}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
document.querySelectorAll('.avatar').forEach(b=>{b.disabled=true;});
$('#guest-marker').remove();
const code=new URLSearchParams(location.hash.slice(1)).get('invite');
// Opening another invitation/group entry in the same tab is a new entry flow,
// even when the browser treats the fragment change as same-document navigation.
window.addEventListener('hashchange',()=>{if(location.hash==='#register'||new URLSearchParams(location.hash.slice(1)).has('invite'))location.reload();});
if(location.hash==='#register'&&!isRehearsal){session=null;sessionStorage.removeItem(sessionKey);}
if(code&&!isRehearsal){$('#invite-code').value=code;session=null;sessionStorage.removeItem(sessionKey);history.replaceState(null,'',location.pathname);show('invitation');invitations.preview(code);}
$('#invite-code').onchange=()=>invitations.preview($('#invite-code').value.trim());
$('#enter-wedding').onclick=async()=>{
 try{if(await publicRegistration.beforeJoin()||await prewedding.beforeJoin())return;const value=await api('/api/join',{invite:$('#invite-code').value.trim(),...invitations.joinOptions()});rememberSession(value.session);$('#invite-code').value='';show('garden');await poll();toast(value.resumed?'已返回原来的身份，种子、形象和进度都保留。':'签到完成，你领到了一颗种子。');}catch(e){$('#connection-status').textContent=e.message;}
};
$('#phase-button').onclick=()=>act('next');$('#pause-button').onclick=()=>act('pause');
$('#leave-button').onclick=()=>$('#departure-dialog').showModal();
async function depart(mode){companionPlacement?.cancel();if(await act('leave',{mode})){$('#departure-dialog').close();rememberAway(true,mode);show('invitation');toast(mode==='temporary'?'已暂离，想回来时沿用原身份。':'已离场，结束本次参与；不会自动重入。');}}
$('#temporary-leave').onclick=()=>depart('temporary');$('#final-leave').onclick=()=>depart('final');
$('#return-wedding').onclick=async()=>{try{if((sessionStorage.getItem(sessionKey+'.departure')||localStorage.getItem(sessionKey+'.departure'))==='final'&&!confirm('你已结束本次参与，确定重新入场吗？'))return;await api('/api/join',{});rememberAway(false);await poll();}catch(e){toast(e.message);}};
$('#rings-action').onclick=()=>act('rings');
$('#consent-action').onclick=()=>act('confirm');
$('#seat-action').onclick=async()=>{place=1;camera();await act('seat');};
$('#bless-action').onclick=activities.openBlessing;
$('#flower-action').onclick=()=>$('#flower-dialog').showModal();
$('#photo-action').onclick=()=>$('#photo-dialog').showModal();
$('#gather-button').onclick=async()=>{if(await act('gather')){place=photoStageLayout(state.photo)?1:4;camera();toast('已集合，等待大家就位。');}};
$('#chat-toggle').onclick=()=>{const closed=$('.chat-panel').classList.toggle('collapsed');$('#chat-toggle').textContent=closed?'+':'−';};
const mobileUI=installMobileUI();
const walkingUI=installWalkingUI({act});
const sharedGarden=installSharedGarden($('#world-track'),toast);
const ceremonyArt=installCeremonyArt($('#world-track'));
const ringDeliveryArt=installRingDeliveryArt($('#world-track'));
const testControls=installTestControls({api,render,getState:()=>state,toast,isRehearsal});
companionPlacement=installCompanionPlacement({api,render,getState:()=>state,toast,focusOwner:()=>{place=Math.max(0,stops.findIndex(p=>p[0]===state.me.scene));camera();}});
const isSpeech=s=>s?.me.broadcast||({groom:'groom',witness:'witness',rings:'rings'}[s?.me.role]===s?.phase.id);
let historyBefore;
async function loadHistory(){try{const data=await api('/api/messages'+(historyBefore?'?beforeSeq='+historyBefore:''));const fragment=document.createDocumentFragment();for(const message of data.messages){const p=document.createElement('p'),b=document.createElement('b');b.textContent=message.name+'：';p.append(b,document.createTextNode(message.text));p.style.whiteSpace='pre-wrap';fragment.append(p);}$('#history-list').prepend(fragment);historyBefore=data.beforeSeq;$('#history-older').disabled=!data.hasMore;}catch(e){toast(e.message);}}
$('#chat-history').onclick=async()=>{historyBefore=null;$('#history-list').replaceChildren();$('#history-dialog').showModal();await loadHistory();};$('#history-older').onclick=loadHistory;
$('#chat-form').onsubmit=async e=>{e.preventDefault();if(await act(isSpeech(state)?'speech':'chat',{text:$('#chat-input').value}))$('#chat-input').value='';};
document.querySelectorAll('[data-place-index]').forEach(b=>b.onclick=()=>{
 visit(Number(b.dataset.placeIndex));if(b.dataset.action==='sign')activities.openCheckin();if(b.dataset.action==='seat')act('seat');if(b.dataset.action==='bless')$('#flower-dialog').showModal();if(b.dataset.action==='photo')$('#photo-dialog').showModal();if(b.dataset.action==='games')activities.openBooth();
});
$('#world-prev').onclick=()=>visit(place-1);$('#world-next').onclick=()=>visit(place+1);
let down;
$('#world-viewport').addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});
$('#world-viewport').addEventListener('pointerup',e=>{
 if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;down=null;
 if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy))visit(place+(dx<0?1:-1));
 else if(e.target.classList.contains('world-map')){const r=$('#world-track').getBoundingClientRect(),point={scene:stops[place][0],x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};if(companionPlacement.isActive())companionPlacement.place(point);else act('move',point);}
});
window.addEventListener('resize',camera);$('.world-map').addEventListener('load',camera);
window.addEventListener('wedding:map-resized',camera);
if(matchMedia('(max-width:900px) and (orientation:landscape)').matches)$('.chat-panel').classList.add('collapsed');

const botanicalPosition=i=>`${(i%4)/3*100}% ${Math.floor(i/4)*100}%`;
function flower(seed,bloomed=true){return `<span class="botanical" role="img" aria-label="${botanicalNames[botanicalIndex(seed,bloomed)]}" style="background-position:${botanicalPosition(botanicalIndex(seed,bloomed))}"></span>`;}
let botanicalImage;
async function flowerCard(seed,name){
 if(!botanicalImage)botanicalImage=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('花朵图片加载失败，请稍后再试'));img.src='assets/wedding-botanicals-v2.png';});
 const img=await botanicalImage,i=botanicalIndex(seed),tileW=img.naturalWidth/4,tileH=img.naturalHeight/2;
 const canvas=document.createElement('canvas');canvas.width=720;canvas.height=900;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#faf8ee';ctx.fillRect(0,0,720,900);ctx.strokeStyle='#c2cfb3';ctx.lineWidth=3;ctx.strokeRect(28,28,664,844);
 ctx.textAlign='center';ctx.fillStyle='#7c927d';ctx.font='16px "Microsoft YaHei",sans-serif';ctx.fillText('A FLOWER FOR YOUR PRESENCE',360,85);
 ctx.imageSmoothingEnabled=false;ctx.drawImage(img,(i%4)*tileW,Math.floor(i/4)*tileH,tileW,tileH,100,135,520,520);
 ctx.fillStyle='#385546';ctx.font='28px "Microsoft YaHei",sans-serif';ctx.fillText(botanicalNames[i],360,710);ctx.font='20px "Microsoft YaHei",sans-serif';ctx.fillText(name+' · 你曾在这里',360,765);ctx.fillStyle='#7c927d';ctx.font='17px "Microsoft YaHei",sans-serif';ctx.fillText('OUR WEDDING · 银杏与月光',360,827);
 return canvas;
}
function render(s){
 if(!snapshotOrder.accept(s,s._transport?.requestId))return false;
 motionClock.observeSnapshot(s);
 mobileUI.render(s);
 if(s.messagesDelta){const prior=state?.me.id===s.me.id?state:null;s.messages=s.messagesReset?s.messagesDelta:[...(prior?.messages||[]),...s.messagesDelta];s.messages=[...new Map(s.messages.map(m=>[m.id,m])).values()].slice(-200);s.blessings??=prior?.blessings||[];s.booths??=prior?.booths||[];}
 if(s.bloomGarden===undefined&&s.me.id===state?.me.id)s.bloomGarden=state.bloomGarden;
 const recovered=connectionLost;connectionLost=false;rehearsalRecoveryTried=false;state=s;$('#connection-status').textContent='已连接';if(recovered)toast('已重新连接，现场状态已同步。');
 activities.render(s);$('#rehearsal-banner').hidden=!s.rehearsal;$('#rehearsal-reset').hidden=!s.rehearsal;
 $('#chat-history').hidden=Boolean(s.rehearsal);
 if(ownScene!==s.me.scene){ownScene=s.me.scene;place=Math.max(0,stops.findIndex(p=>p[0]===ownScene));camera();}
 invitations.render(s);
 testControls.render(s);
 companionPlacement.render(s);
 $('#phase-label').textContent=(s.rehearsal?'演练 · ':jointRehearsal?'联测 · ':'')+s.phase.label+(s.paused?' · 暂停':'');$('#moment-title').textContent=s.phase.label;$('#moment-copy').textContent=s.phase.copy;
 $('#progress-bar').style.width=`${s.phaseIndex/(s.phaseCount-1)*100}%`;
 $('#authority-note').textContent=`${s.guests.length}位在场 · 你是${s.me.name} · ${s.me.controller?'由你掌握仪式节奏':'流程控制者掌握仪式流程'}`;
 $('#phase-button').hidden=!s.me.controller;$('#pause-button').hidden=!s.me.controller;$('#pause-button').textContent=s.paused?'恢复':'暂停';$('#phase-button').disabled=s.paused||s.phase.id==='closed'||(s.phase.id==='consent'&&!(s.confirmations.bride&&s.confirmations.groom))||(s.phase.id==='rings'&&!s.ringsDelivered)||(s.phase.id==='photo'&&!s.photo?.ready);
 $('#consent-panel').hidden=s.phase.id!=='consent';$('#consent-status').textContent=`伴侣 A：${s.confirmations.bride?'已确认':'等待本人确认'} · 伴侣 B：${s.confirmations.groom?'已确认':'等待本人确认'}`;
 $('#consent-action').hidden=!['bride','groom'].includes(s.me.role);$('#consent-action').disabled=!s.me.canConfirm;$('#consent-action').textContent=s.confirmations[s.me.role]?'你已确认我愿意':jointRehearsal?'彩排：我愿意':'我愿意';
 $('#couple-flowers').hidden=!s.rootsJoined;
 $('#couple-flowers').style.left=stageLayout.couple.x*100+'%';
 $('#couple-flowers').style.top=(stageLayout.couple.y+.045)*100+'%';
 for(const [i,g]of s.couple.entries()){const plant=$('#couple-flowers').children[i];if(plant){plant.style.backgroundPosition=botanicalPosition(botanicalIndex(g.seed));plant.setAttribute('aria-label',g.name+'的花');}}
 $('#rings-action').hidden=!(s.me.role==='rings'&&s.phase.id==='rings');$('#rings-action').disabled=s.ringsDelivered;
 if(s.paused)$('#rings-action').disabled=true;
 if(isSpeech(s))$('#chat-input').removeAttribute('maxlength');else $('#chat-input').setAttribute('maxlength','500');
 $('#chat-input').disabled=!s.me.canSpeak;$('#chat-form button').disabled=!s.me.canSpeak;$('#chat-input').placeholder=s.phase.id==='closed'?'纪念馆 · 聊天只读':s.me.canSpeak?'在公屏说句话……':'仪式中 · 花开后恢复公聊';
 const ids=new Set();for(const g of s.guests){ids.add(g.id);let el=markers.get(g.id);if(!el){el=document.createElement('div');el.className='guest-marker map-guest';el.append(document.createElement('span'),document.createElement('b'));const plant=document.createElement('i');plant.className='guest-botanical botanical';el.append(plant);$('#world-track').append(el);markers.set(g.id,el);}
  const position=`${g.x}:${g.y}`;if(el.dataset.position!==position){el.dataset.position=position;el.style.setProperty('--guest-x',`${g.x*100}%`);el.style.setProperty('--guest-y',`${g.y*100}%`);}
  if(!el.firstChild.querySelector('.character-sprite')&&el.firstChild.textContent!==g.name.slice(0,1))el.firstChild.textContent=g.name.slice(0,1);
  const appearance=`${g.name}:${g.seed}:${g.id===s.me.id}:${s.bloomed}`;if(el.dataset.appearance!==appearance){el.dataset.appearance=appearance;el.firstChild.style.backgroundColor=`hsl(${g.seed%360} 25% 42%)`;el.children[1].textContent=g.name+(g.id===s.me.id?'（你）':'');el.lastChild.style.backgroundPosition=botanicalPosition(botanicalIndex(g.seed,s.bloomed));el.lastChild.classList.toggle('flower-open',s.bloomed);}
 }
 for(const [id,el]of markers)if(!ids.has(id)){el.remove();markers.delete(id);}
 const planted=sharedGarden(s);for(const [id,el]of markers)el.lastChild.hidden=planted.has(id);
 for(const g of s.guests){const marker=markers.get(g.id);marker.dataset.guestId=g.id;marker.title=g.name;}
 walkingUI.render(s,markers);
 ceremonyArt(s,markers);
 ringDeliveryArt(s,markers);
 const list=$('#chat-list');const signature=s.messages.at(-1)?.id||'';
 if(list.dataset.last!==signature){const near=list.scrollHeight-list.scrollTop-list.clientHeight<60;list.replaceChildren();for(const m of s.messages){const article=document.createElement('article'),body=document.createElement('div'),name=document.createElement('b'),p=document.createElement('p');name.textContent=m.name;p.textContent=m.text;body.append(name,p);article.append(body);list.append(article);}list.dataset.last=signature;if(near)list.scrollTop=list.scrollHeight;}
 $('#flower-action').lastChild.textContent=s.bloomed?'我的花':'我的种子';$('#download-flower').disabled=!s.bloomed;
 const flowerKey=s.me.seed+':'+s.bloomed;if($('#generated-flower').dataset.key!==flowerKey){$('#generated-flower').dataset.key=flowerKey;$('#generated-flower').innerHTML=flower(s.me.seed,s.bloomed);}$('#flower-name').textContent=botanicalNames[botanicalIndex(s.me.seed,s.bloomed)];$('#flower-meaning').textContent=s.bloomed?'不必说什么，也已经在今天留下了自己的颜色。':'拥抱的那一刻，它会和大家的种子一起开花。';
 const bloomNotice=s.notifications.find(n=>n.type==='flower_bloomed');
 if(bloomNotice){
  const key='wedding.flower.seen.'+bloomNotice.id;let previouslyShown=bloomShown.has(key);try{previouslyShown||=localStorage.getItem(key)==='1';}catch{}
  if(!previouslyShown){
   $('#bloom-flower').innerHTML=flower(s.me.seed,true);$('#bloom-name').textContent=s.flower.name;$('#bloom-owner').textContent=s.me.name+'，这是属于你的花。';
   bloomShown.add(key);queueMicrotask(()=>{if(!$('#bloom-dialog').open)$('#bloom-dialog').showModal();try{localStorage.setItem(key,'1');}catch{}});
  }
  if(!bloomAcknowledged.has(key)){bloomAcknowledged.add(key);queueMicrotask(()=>act('flower_ack',{notificationId:bloomNotice.id}));}
 }
 if(lastPhase!==s.phase.id){if(lastPhase&&s.phase.id==='embrace')toast('种子开花了！禁言已解除，可以在公屏发言啦。');if(s.phase.id==='seating')toast('请宾客入座，可以点击下方的入座按钮。');lastPhase=s.phase.id;}
 const p=s.photo;
 $('#photo-preview').classList.toggle('front-photo-frame',isFrontPhoto(p));
 if(p&&!p.ready&&s.phase.id==='photo'){
  const remaining=Math.max(0,Math.ceil((p.deadline-s.serverTime)/1000));$('#photo-status').textContent=`${remaining}秒后自动集合拍照。提前点击集合也可以。`;$('#gather-button').hidden=!p.members.includes(s.me.id);
  if(photoNotice!==p.id){photoNotice=p.id;if(!$('#photo-dialog').open)$('#photo-dialog').showModal();}
 }else{$('#gather-button').hidden=true;$('#photo-status').textContent=p?.ready?`这张合影共${p.guests?.length||0}位，已经就位，可以下载啦。`:'由流程控制者发起全场合影。';}
 $('#download-photo').disabled=!p?.ready;
 if(p?.ready&&$('#photo-preview').dataset.id!==p.id){$('#photo-preview').dataset.id=p.id;makePhoto(p).then(svg=>{if(state.photo?.id===p.id)$('#photo-preview').innerHTML=svg;}).catch(e=>toast(e.message));}
}
let background;
export async function makePhoto(p){
 if(isFrontPhoto(p))return (await import('./front-photo.js')).renderFrontPhoto(p);
 if(!background)background=loadMapDataUrl().catch(error=>{background=null;throw error;});
 const bg=await background,layout=photoStageLayout(p),modern=Boolean(layout),guests=p.guests||[],coupleCount=guests.filter(g=>g.role==='bride'||g.role==='groom').length,rows=Math.max(1,Math.ceil(Math.max(0,guests.length-coupleCount)/10)),height=modern?1320:Math.max(650+rows*100,...guests.map(g=>(g.photoY||0)+140));
 let captions;
 if(modern&&p.nameLayoutVersion===groupCaptionVersion){const c=document.createElement('canvas').getContext('2d');captions=planGroupCaptions(guests,{measureMarker:text=>{c.font='9px "Microsoft YaHei",sans-serif';return c.measureText(text).width;},measureRoster:text=>{c.font='14px "Microsoft YaHei",sans-serif';return c.measureText(text).width;}});}
 const people=(await Promise.all(guests.map(async(g,i)=>{const couple=g.role==='bride'||g.role==='groom';let x,y;if(Number.isFinite(g.photoX)&&Number.isFinite(g.photoY)){x=g.photoX;y=g.photoY;}else if(couple){x=g.role==='bride'?720:880;y=350;}else{const j=i-coupleCount;const row=Math.floor(j/10),col=j%10,n=Math.min(10,guests.length-coupleCount-row*10);x=800+(col-(Math.max(1,n)-1)/2)*135;y=480+row*100;}const nameWidth=Math.min(112,Math.max(36,Array.from(g.name).length*18))+16;
 let figure=`<rect x="-20" y="-24" width="40" height="42" rx="8" fill="hsl(${g.seed%360} 35% 55%)"/><circle cy="-32" r="16" fill="#edcfb4"/>`;
 // Older archives had generic placeholders: do not retroactively replace them with today's rig.
 const hasRecordedArt=g.worldArtSnapshot||(!Object.hasOwn(g,'worldArtSnapshot')&&directionalIdentity(g));
 const art=p.artVersion===directionArtVersion&&hasRecordedArt?await directionalAtlas(g,{snapshot:g.worldArtSnapshot}):null;if(art){const canvas=document.createElement('canvas');drawDirectional(canvas,art,'down');const tShape=layout?.version==='arch-t-v2';figure=`<image class="group-character-art" href="${canvas.toDataURL('image/png')}" x="${modern?-60:-80}" y="${captions?captions.imageY:tShape?-80.625:modern?-120:-90}" width="${modern?120:160}" height="${captions?captions.imageHeight:tShape?82.5:modern?120:110}"/>`;}
 if(captions){const caption=captions.entries[i],lines=caption.markerLines,text=lines.map((line,j)=>`<tspan x="0" y="${13+j*10}">${esc(line)}</tspan>`).join('');return `<g data-photo-guest-id="${esc(g.id)}" transform="translate(${x} ${y})"><title>${esc(g.name)}</title>${figure}<rect class="photo-nameplate" x="-26" y="2" width="52" height="${4+lines.length*10}" rx="4" fill="#fff9ec" fill-opacity=".9"/><text class="${captions.hasRoster?'photo-marker-name':'photo-guest-name'}" data-name-id="${esc(g.id)}" text-anchor="middle" fill="#263f38" font-size="9">${text}</text></g>`;}
 const labelWidth=modern?Math.min(layout.version==='arch-t-v2'?52:54,nameWidth):nameWidth;
 const lines=modern?photoNameLines(g.name):[g.name],name=modern?lines.map((line,i)=>`<tspan x="0" y="${19+i*13}">${esc(line)}</tspan>`).join(''):esc(g.name);
 return `<g transform="translate(${x} ${y})"><title>${esc(g.name)}</title>${figure}<rect class="photo-nameplate" x="${-labelWidth/2}" y="${modern?5:23}" width="${labelWidth}" height="${modern?7+lines.length*13:28}" rx="5" fill="#fff9ec" fill-opacity=".9"/><text class="photo-guest-name" y="${modern?19:43}" text-anchor="middle" fill="#263f38" font-size="${modern?10:18}" ${modern?'':`textLength="${labelWidth-8}" lengthAdjust="spacingAndGlyphs"`}>${name}</text></g>`;}))).join('');
 if(modern){const crop=layout.crop,photoHeight=captions?.height||1320,roster=captions?.hasRoster?`<text x="80" y="1332" font-size="20" fill="#375346">共同在场的名字 · 编号与照片对应</text>`+captions.entries.map(e=>{const r=e.roster;return `<g transform="translate(${r.x} ${r.y})"><rect class="photo-roster-cell" width="${r.width}" height="${r.height}" rx="9" fill="#edf1e6"/><text x="12" y="25" font-size="13" fill="#708f80">${e.number}</text><text class="photo-guest-name" data-name-id="${esc(e.id)}" font-size="14" fill="#263f38">${e.rosterLines.map((line,i)=>`<tspan x="44" y="${25+i*20}">${esc(line)}</tspan>`).join('')}</text></g>`;}).join(''):'';return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${photoHeight}" viewBox="0 0 1600 ${photoHeight}"><rect width="1600" height="${photoHeight}" rx="24" fill="#faf5e9"/><rect x="26" y="26" width="1548" height="${photoHeight-52}" rx="18" fill="none" stroke="#708f80" stroke-width="5"/><svg x="80" y="80" width="1440" height="1080" viewBox="${crop.left*2172} ${crop.top*724} ${(crop.right-crop.left)*2172} ${(crop.bottom-crop.top)*724}" preserveAspectRatio="none"><image href="${bg}" width="2172" height="724"/></svg>${people}<text x="800" y="1240" text-anchor="middle" fill="#375346" font-size="32">☾ OUR WEDDING · 银杏与月光下，我们共同在场</text><text x="800" y="1280" text-anchor="middle" fill="#63766a" font-size="20">${new Date(p.capturedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})}</text>${roster}</svg>`;}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${height}" viewBox="0 0 1600 ${height}"><defs><clipPath id="frame"><rect x="35" y="35" width="1530" height="${height-70}" rx="20"/></clipPath></defs><rect width="1600" height="${height}" fill="#f5eedb"/><image href="${bg}" x="35" y="35" width="1530" height="${height-70}" preserveAspectRatio="xMidYMid slice" clip-path="url(#frame)"/><path d="M650 320V210Q800 70 950 210V320" fill="none" stroke="#eee4c8" stroke-width="18"/><rect class="photo-caption-backdrop" x="400" y="59" width="800" height="64" rx="16" fill="#fff9ec" fill-opacity=".9"/><text x="800" y="105" text-anchor="middle" fill="#294c40" font-size="38">☾ OUR WEDDING · 我们共同在场</text>${people}<rect x="20" y="20" width="1560" height="${height-40}" rx="20" fill="none" stroke="#829978" stroke-width="8"/><rect class="photo-caption-backdrop" x="540" y="${height-75}" width="520" height="44" rx="12" fill="#fff9ec" fill-opacity=".9"/><text x="800" y="${height-45}" text-anchor="middle" fill="#375346" font-size="20">银杏与月光 · ${new Date(p.capturedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})}</text></svg>`;
}
async function download(svg,name){
 const blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),img=new Image();
 try{await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw new Error('图片生成失败');const link=document.createElement('a'),target=URL.createObjectURL(png);link.href=target;link.download=name+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(target),1000);}finally{URL.revokeObjectURL(url);}
}
async function downloadMyFlower(){try{const canvas=await flowerCard(state.me.seed,state.me.name);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('图片生成失败');const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='婚礼纪念花.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){toast(e.message);}}
$('#download-flower').onclick=downloadMyFlower;$('#bloom-download').onclick=downloadMyFlower;
$('#download-photo').onclick=async()=>{try{await download(await makePhoto(state.photo),'婚礼合影');}catch(e){toast(e.message);}};
async function poll(){if(!session||away||busy||navigator.onLine===false||$('#waiting').classList.contains('active'))return;busy=true;const activeSession=session;try{const result=await api('/api/state');if(session!==activeSession||away)return;if(!snapshotOrder.accept(result,result._transport?.requestId))return;if(result.me?.away){rememberAway(true);show('invitation');return;}render(result);show('garden');}catch(e){
 if(session!==activeSession)return;
 if(isRehearsal&&e.status===401&&!rehearsalRecoveryTried){rehearsalRecoveryTried=true;rememberSession(null);state=null;rehearsalId=null;sessionStorage.removeItem(rehearsalIdKey);busy=false;show('arrival');chooseRehearsal();toast('演练已结束，请重新选择身份；不会自动获得流程控制权限。');return;}
 if(!isRehearsal&&e.status===401){rememberSession(null);state=null;show('arrival');$('#connection-status').textContent='登录已结束或邀请已重发，请使用新的个人邀请。';return;}
 if(e.status===423){await prewedding.waiting();return;}
 connectionLost=true;$('#connection-status').textContent=e.message;$('#authority-note').textContent='连接暂时中断，正在重连';
 }finally{busy=false;}}
window.addEventListener('offline',()=>{if(!session)return;connectionLost=true;$('#connection-status').textContent='网络已断开';$('#authority-note').textContent='连接暂时中断，正在重连';});
window.addEventListener('online',poll);
let rehearsalStarting=false;
async function startRehearsal(identityId='bride'){
 if(rehearsalStarting)return false;rehearsalStarting=true;
 try{const value=await api('/api/start',{identityId});rememberSession(null);state=null;for(const marker of markers.values())marker.remove();markers.clear();bloomShown.clear();bloomAcknowledged.clear();photoNotice=null;ownScene=null;lastPhase=null;companionPlacement?.cancel?.();
  session=value.session;rehearsalId=value.rehearsalId;sessionStorage.setItem(sessionKey,session);sessionStorage.setItem(rehearsalIdKey,rehearsalId);busy=false;await poll();toast('已切换独立演练身份；正式现场保持原样。');return true;
 }catch(e){toast(e.message);return false;}finally{rehearsalStarting=false;}
}
const chooseRehearsal=isRehearsal?installRehearsalPicker({start:startRehearsal,toast}):null;
$('#rehearsal-reset').onclick=chooseRehearsal;$('#rehearsal-reset').textContent='切换演练身份';
if(isRehearsal){$('#enter-wedding').textContent='选择独立彩排身份';$('#enter-wedding').onclick=chooseRehearsal;$('#manual-invitation').hidden=true;
 const next=document.createElement('button');next.id='rehearsal-next';next.type='button';next.textContent='仅演练：推进模拟流程';next.onclick=()=>act('rehearsal_next');$('#rehearsal-banner').after(next);
 const choose=document.createElement('button');choose.id='rehearsal-profile-choice';choose.type='button';choose.textContent='切换演练身份';choose.onclick=()=>{$('#profile-close').click();chooseRehearsal();};$('#profile-panel').append(choose);
 $('#rehearsal-banner').textContent='独立演练 · 当前身份按真实职责操作；“仅演练”推进由模拟流程控制者执行，不代表真人，不影响正式现场。';
}
let lastScheduledPoll=0;
if(isRehearsal&&(!session||!rehearsalId)){const requestedIdentity=new URLSearchParams(location.search).get('identity');if(requestedIdentity)startRehearsal(requestedIdentity);else chooseRehearsal();}else if(session){if(away){rememberAway(true);show('invitation');}else poll();}setInterval(()=>{const at=performance.now(),moving=state?.guests.some(g=>g.motion&&g.motion.startedAt+g.motion.duration>motionClock.time()),interval=moving?250:1000;if(!document.hidden&&at-lastScheduledPoll>=interval){lastScheduledPoll=at;poll();}},250);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
