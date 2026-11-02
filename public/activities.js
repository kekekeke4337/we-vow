import {loadMapImage} from './map-art.js';
import {photoCrop,photoWindow,defaultPhotoPosition,defaultPhotoLayout} from './photo-layout.js';
import {installBoothFraming} from './booth-framing.js';
import {preparePhotoSubjects,drawPhotoSubject,drawPlaceholderProp} from './photo-art.js';
import {installPreviewDiagnostics} from './preview-diagnostics.js';
import {installPreviewSizing} from './preview-sizing.js';
import {syncCanvasPreview,releaseCanvasPreview} from './canvas-preview.js';
import {drawPhotoDuo,installPhotoDuo} from './photo-duo.js';
const $=s=>document.querySelector(s);
const propText={none:'',moon:'☾',ginkgo:'🍃',raven:'🐦‍⬛',heart:'♥'};
const statusText={pending:'等待本人回应',accepted:'已接受',declined:'已拒绝／退出'};
let background;
export async function drawPolaroid(room,rehearsal=false){
 if(!background)background=loadMapImage().catch(error=>{background=undefined;throw error;});
 const image=await background,canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1150;
 const c=canvas.getContext('2d'),colors={sage:'#e5eedc',sky:'#e2edf4',cream:'#fff3d8'};
 c.fillStyle=colors[room.frame]||colors.sage;c.fillRect(0,0,1000,1150);c.imageSmoothingEnabled=false;
 c.save();c.beginPath();c.rect(55,55,890,840);c.clip();
 const crop=photoCrop(image.naturalWidth,image.naturalHeight,room.camera);c.drawImage(image,crop.x,crop.y,crop.width,crop.height,55,55,890,840);
 const people=room.people||[],duo=await drawPhotoDuo(c,room),subjects=await preparePhotoSubjects(room);let artCount=duo?2:0,propCount=0;
 people.forEach((p,i)=>{
  if(duo?.people.includes(p.id))return;
  const layout=defaultPhotoLayout(i,people.length),position=room.positions?.[p.id]||layout,x=photoWindow.x+position.x*photoWindow.width,footY=photoWindow.y+position.y*photoWindow.height,y=footY-78;
  const rendered=drawPhotoSubject(c,subjects[i],{x,footY,height:layout.height,ceiling:photoWindow.y});
  if(rendered.drawn){artCount++;if(rendered.propDrawn)propCount++;}
  else{
  c.fillStyle=`hsl(${p.seed%360} 30% 45%)`;c.fillRect(x-27,y,54,78);c.fillStyle='#efd1b2';c.fillRect(x-23,y-40,46,43);
  c.strokeStyle=`hsl(${p.seed%360} 30% 45%)`;c.lineWidth=14;c.beginPath();c.moveTo(x-25,y+14);c.lineTo(x-48,y+(p.pose==='cheer'?-30:48));c.moveTo(x+25,y+14);c.lineTo(x+48,y+(p.pose==='stand'?48:-30));c.stroke();
  if(subjects[i].modern&&p.prop!=='none'){const hand=[x+48,y+(p.pose==='stand'?48:-30)];if(drawPlaceholderProp(c,subjects[i],hand))propCount++;}
  }
  c.font='22px "Microsoft YaHei",sans-serif';
  const nameWidth=Math.min(180,c.measureText(p.name).width)+20;
  c.fillStyle='#fff9ece6';c.fillRect(x-nameWidth/2,y+103,nameWidth,32);
  c.fillStyle='#294c40';c.textAlign='center';c.fillText(p.name,x,y+127,180);
  if(!subjects[i].modern){c.font='48px "Segoe UI Emoji","Microsoft YaHei",sans-serif';c.fillText(propText[p.prop]||'',x+56,y-65);}
 });c.restore();
 c.fillStyle='#355749';c.textAlign='center';c.font='36px "Microsoft YaHei",sans-serif';c.fillText('OUR WEDDING · 林间的一张拍立得',500,970);
 c.font='22px "Microsoft YaHei",sans-serif';c.fillText(room.capturedAt?new Date(room.capturedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):'拍摄预览 · 等待所有邀请回应',500,1020);
 c.font='18px "Microsoft YaHei",sans-serif';c.fillText(rehearsal?'独立演练 · 模拟人物，不是正式婚礼记录':artCount===people.length&&people.length?'像素人物与独立道具 · 当时的你们':subjects.some(s=>s.modern)?'部分形象仍为占位 · 专属素材逐步接入':'人物预览 · 定制角色素材待接入',500,1080);
 canvas.dataset.artCount=String(artCount);canvas.dataset.propCount=String(propCount);
 if(duo)canvas.dataset.duoPose=duo.pose;
 return canvas;
}
export function installActivities({act,getState,toast}){
 let selected,signature='',previewGeneration=0,previewCanvas;const noticed=new Set();
 const room=()=>getState()?.booths.find(r=>r.id===selected);
 const open=id=>{if(!$(id).open)$(id).showModal();};
 function openBlessing(){open('#blessing-dialog');}
 function openCheckin(){open('#checkin-dialog');}
 function openBooth(){open('#booth-dialog');}
 $('#flower-blessing').onclick=()=>{$('#flower-dialog').close();openBlessing();};
 $('#checkin-flower').onclick=()=>{$('#checkin-dialog').close();open('#flower-dialog');};
 $('#send-blessing').onclick=async()=>{if(await act('blessing',{text:$('#blessing-text').value})){toast('你的祝福已留在花房。');}};
 $('#booth-action').onclick=openBooth;$('#booth-close').onclick=()=>$('#booth-dialog').close();
 $('#booth-create').onclick=async()=>{const result=await act('booth_create');if(result){selected=result.booths.find(r=>r.owner===result.me.id&&r.status==='open')?.id;signature='';render(result);}};
 $('#booth-rooms').onchange=()=>{selected=$('#booth-rooms').value;signature='';render(getState());};
 const perform=(type,args={})=>act(type,{roomId:room()?.id,...args});
 const peopleForRoom=()=>{const r=room(),s=getState();if(!r)return [];return r.people||[r.owner,...r.invites.filter(i=>i.status==='accepted').map(i=>i.guestId)].map(id=>{const guest=s.guests.find(g=>g.id===id),invite=r.invites.find(i=>i.guestId===id),snapshot=id===r.owner?r.ownerPerson:invite;return {id,name:guest?.name||snapshot?.name||(id===r.owner?r.ownerName:''),seed:guest?.seed??snapshot?.seed??0,role:guest?.role??snapshot?.role,character:guest?.character??snapshot?.character,...r.styles[id]};});};
 const framing=installBoothFraming({getRoom:room,getPeople:peopleForRoom,drawPhoto:r=>drawPolaroid(r,Boolean(getState().rehearsal)),perform,toast});
 const renderDuo=installPhotoDuo({perform,getRoom:room,getPeople:peopleForRoom,getState});
 installPreviewDiagnostics(document.querySelector('#booth-status').parentElement);
 installPreviewSizing();
 function refreshPreview(){const r=room(),s=getState();if(!r||!s)return;const generation=++previewGeneration,box=$('#booth-preview');box.dataset.state='loading';delete box.dataset.error;drawPolaroid({...r,people:peopleForRoom()},Boolean(s.rehearsal)).then(canvas=>{if(generation===previewGeneration){releaseCanvasPreview(box.querySelector('canvas'));previewCanvas=canvas;box.replaceChildren(canvas);syncCanvasPreview(canvas);box.dataset.state='ready';delete box.dataset.error;}}).catch(reason=>{if(generation===previewGeneration){releaseCanvasPreview(box.querySelector('canvas'));const error=document.createElement('p'),retry=document.createElement('button');box.dataset.error=reason?.message||'unknown preview error';error.textContent='照片预览加载失败，当前拍摄与人物选择仍保留。';error.setAttribute('role','status');retry.type='button';retry.id='booth-preview-retry';retry.textContent='重试预览';retry.onclick=refreshPreview;box.replaceChildren(error,retry);box.dataset.state='error';}});}
 $('#booth-invite').onclick=()=>perform('booth_invite',{guestId:$('#booth-guests').value});
 $('#booth-accept').onclick=()=>perform('booth_respond',{accept:true});$('#booth-decline').onclick=()=>perform('booth_respond',{accept:false});
 $('#booth-prop').onchange=()=>perform('booth_style',{prop:$('#booth-prop').value});$('#booth-pose').onchange=()=>perform('booth_style',{pose:$('#booth-pose').value});$('#booth-frame').onchange=()=>perform('booth_style',{frame:$('#booth-frame').value});
 $('#booth-capture').onclick=()=>perform('booth_capture');$('#booth-cancel').onclick=()=>perform('booth_cancel');
 $('#booth-download').onclick=async()=>{
  const photo=room();if(photo?.status!=='captured')return;
  try{const canvas=await drawPolaroid(photo,Boolean(getState().rehearsal)),blob=await new Promise(ok=>canvas.toBlob(ok,'image/png'));if(!blob)throw new Error('图片生成失败');
   const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=(getState().rehearsal?'演练-':'')+'林间拍立得.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{toast('照片暂未生成，请稍后重试。');}
 };
 function render(s){
  $('#checkin-name').textContent=s.me.name+' · 已签到';$('#checkin-time').textContent='入场：'+new Date(s.me.joinedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'});
  $('#send-blessing').disabled=!s.activitiesOpen;$('#blessing-note').textContent=s.activitiesOpen?'可以自愿留言，也可以只看看。':'仪式安静进行中／已闭幕：祝福墙可读，暂不提交。';
  const wall=$('#blessing-wall'),wallKey=JSON.stringify(s.blessings);
  if(wall.dataset.key!==wallKey){wall.dataset.key=wallKey;wall.replaceChildren();for(const b of s.blessings){
   let variation=0;for(const c of b.guestId)variation=(variation*31+c.charCodeAt(0))>>>0;
   const item=document.createElement('article'),name=document.createElement('b'),p=document.createElement('p'),pin=document.createElement('span');
   item.className='wish-note handwriting-'+variation%5;item.style.setProperty('--note-tilt',`${variation%7-3}deg`);item.style.setProperty('--note-hue',String(variation%4));
   pin.className='wish-pin';pin.textContent='♥';pin.setAttribute('aria-hidden','true');name.textContent='— '+b.name;p.textContent=b.text;item.append(pin,p,name);wall.append(item);
  }if(!s.blessings.length){const empty=document.createElement('p');empty.className='wish-empty';empty.textContent='这里留着一块柔软的位置，等一张自愿留下的便签。';wall.append(empty);}}
  const pending=s.booths.filter(r=>r.status==='open'&&r.invites.some(i=>i.guestId===s.me.id&&i.status==='pending'));
  $('#booth-badge').textContent=pending.length?`拍立得 · ${pending.length}邀请`:'拍立得';
  for(const r of pending)if(!noticed.has(r.id)){noticed.add(r.id);toast(r.ownerName+'邀请你合照，可在拍立得里接受或拒绝。');}
  $('#booth-create').disabled=!s.activitiesOpen;
  if(!s.booths.some(r=>r.id===selected))selected=pending[0]?.id||s.booths.at(-1)?.id;
  const key=JSON.stringify({selected,open:s.activitiesOpen,rooms:s.booths,guests:s.guests.map(g=>({id:g.id,name:g.name}))});
  if(signature===key)return;signature=key;
  const options=$('#booth-rooms');options.replaceChildren();for(const r of s.booths){const option=new Option(`${r.ownerName} · ${r.status==='captured'?'已拍摄':r.status==='open'?'待拍摄':r.status==='expired'?'已过期':'已取消'}`,r.id);options.add(option);}options.value=selected||'';
  const r=room();$('#booth-controls').hidden=!r;if(!r)return;
  renderDuo();
  const owner=r.owner===s.me.id,inv=r.invites.find(i=>i.guestId===s.me.id),active=r.status==='open',editable=active&&s.activitiesOpen,accepted=owner||inv?.status==='accepted';
  framing.render(owner&&editable);
 $('#booth-status').textContent=r.status==='captured'?'拍摄完成，照片已保存，入镜来宾都可下载。':!active?'本次拍摄已取消或过期。':!s.activitiesOpen?'仪式正在安静进行，拍摄与邀请暂停。':'邀请30分钟内有效；可邀请所有在线来宾，未回应时不会被强行拍入。';
  $('#booth-owner').hidden=!owner||!active;$('#booth-response').hidden=owner||!active;
  $('#booth-accept').disabled=!editable||inv?.status==='accepted';$('#booth-decline').disabled=!editable||inv?.status==='declined';
  $('#booth-personal').hidden=!accepted||!active;$('#booth-prop').value=r.styles[s.me.id]?.prop||'none';$('#booth-pose').value=r.styles[s.me.id]?.pose||'stand';$('#booth-frame').value=r.frame;
  for(const id of ['#booth-prop','#booth-pose','#booth-frame'])$(id).disabled=!editable;
  const members=$('#booth-members');members.replaceChildren();for(const i of r.invites){const row=document.createElement('p');row.textContent=i.name+' · '+statusText[i.status];if(owner&&active){const button=document.createElement('button');button.type='button';button.textContent='撤回邀请';button.disabled=!editable;button.onclick=()=>perform('booth_remove',{guestId:i.guestId});row.append(button);}members.append(row);}
  const guests=$('#booth-guests'),previous=guests.value;guests.replaceChildren();for(const g of s.guests.filter(g=>g.id!==s.me.id&&!r.invites.some(i=>i.guestId===g.id)))guests.add(new Option(g.name,g.id));if([...guests.options].some(o=>o.value===previous))guests.value=previous;
 $('#booth-invite').disabled=!editable||!guests.options.length;
  $('#booth-capture').hidden=!owner||!active;$('#booth-capture').disabled=!editable||r.invites.some(i=>i.status==='pending');$('#booth-cancel').hidden=!owner||!active;$('#booth-cancel').disabled=!editable;
  $('#booth-download').hidden=r.status!=='captured';
  const people=peopleForRoom();
  refreshPreview();
 }
 return {render,openCheckin,openBlessing,openBooth};
}
