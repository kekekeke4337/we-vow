import {loadMapImage} from './map-art.js';
import {normalizeCamera,photoCrop,photoWindow,defaultPhotoPosition,normalizePhotoPosition} from './photo-layout.js';
import {installPreviewDiagnostics} from './preview-diagnostics.js';
import {canvasPreviewTarget,syncCanvasPreview} from './canvas-preview.js';
const $=s=>document.querySelector(s);
// Local drafts never move live guests and are committed in one owner-authorized action.
export function installBoothFraming({getRoom,getPeople,drawPhoto,perform,toast}){
 const dialog=$('#booth-framing-dialog'),map=$('#framing-map'),photo=$('#framing-photo');
 const trigger=document.createElement('button');trigger.type='button';trigger.id='booth-framing-open';trigger.textContent='选地图背景／摆照片位置';$('#booth-owner').append(trigger);
 let draft,editingRoom,image,generation=0,pointer;
 const status=document.createElement('p'),retry=document.createElement('button');status.id='framing-render-status';status.setAttribute('role','status');retry.id='framing-preview-retry';retry.type='button';retry.textContent='重试取景预览';retry.hidden=true;map.after(status,retry);installPreviewDiagnostics(map.parentElement);
 function current(){return getPeople().filter(p=>p&&p.id);}
 function selected(){return $('#framing-person').value;}
 function position(){const people=current();if(getRoom()?.duo?.status==='accepted'&&getRoom().duo.artSnapshot?.version!=='duo-individual-v1'&&people.length===2)return people.reduce((point,p,i)=>{const at=draft.positions[p.id]||defaultPhotoPosition(i,people.length);return {x:point.x+at.x/2,y:point.y+at.y/2};},{x:0,y:0});const index=people.findIndex(p=>p.id===selected());return draft.positions[selected()]||defaultPhotoPosition(Math.max(0,index),people.length);}
 function placePerson(point){const normalized=normalizePhotoPosition(point),duo=getRoom()?.duo;if(duo?.status==='accepted'&&duo.artSnapshot?.version!=='duo-individual-v1'&&[duo.from,duo.to].includes(selected())){for(const p of current().filter(p=>[duo.from,duo.to].includes(p.id)))draft.positions[p.id]=normalized;}else draft.positions[selected()]=normalized;}
 async function paint(){
  if(!draft||!dialog.open)return;const revision=++generation;
  status.textContent='正在生成取景预览…';retry.hidden=true;
  image??=await loadMapImage();if(revision!==generation||!dialog.open)return;
  const c=map.getContext('2d');c.drawImage(image,0,0,map.width,map.height);
  const crop=photoCrop(image.naturalWidth,image.naturalHeight,draft.camera),sx=map.width/image.naturalWidth,sy=map.height/image.naturalHeight;
  c.fillStyle='#173b3370';c.beginPath();c.rect(0,0,map.width,map.height);c.rect(crop.x*sx,crop.y*sy,crop.width*sx,crop.height*sy);c.fill('evenodd');c.strokeStyle='#fff9df';c.lineWidth=3;c.strokeRect(crop.x*sx,crop.y*sy,crop.width*sx,crop.height*sy);
  syncCanvasPreview(map);
  const canvas=await drawPhoto({...getRoom(),camera:draft.camera,positions:draft.positions,people:current()});if(revision!==generation||!dialog.open)return;
  photo.getContext('2d').drawImage(canvas,0,0,photo.width,photo.height);
  syncCanvasPreview(photo);
  status.textContent='取景预览已生成。';
 }
 function sync(){const p=position();$('#framing-zoom').value=draft.camera.zoom;$('#framing-x').value=draft.camera.x;$('#framing-y').value=draft.camera.y;$('#framing-person-x').value=p.x;$('#framing-person-y').value=p.y;paint().catch(()=>{if(!dialog.open||!draft)return;status.textContent='取景素材加载失败，站位和取景草稿仍保留。';retry.hidden=false;});}
 retry.onclick=sync;
 trigger.onclick=()=>{const r=getRoom();if(!r||r.status!=='open')return;editingRoom=r.id;draft={camera:normalizeCamera(r.camera),positions:structuredClone(r.positions||{})};$('#framing-person').replaceChildren(...current().map(p=>new Option(p.name,p.id)));dialog.showModal();sync();};
 $('#framing-person').onchange=sync;
 for(const [id,key]of [['framing-zoom','zoom'],['framing-x','x'],['framing-y','y']])$('#'+id).oninput=event=>{draft.camera=normalizeCamera({...draft.camera,[key]:Number(event.target.value)});sync();};
 for(const [id,key]of [['framing-person-x','x'],['framing-person-y','y']])$('#'+id).oninput=event=>{placePerson({...position(),[key]:Number(event.target.value)});sync();};
 function aim(event){const r=canvasPreviewTarget(map).getBoundingClientRect();draft.camera=normalizeCamera({...draft.camera,x:(event.clientX-r.left)/r.width,y:(event.clientY-r.top)/r.height});sync();}
 map.addEventListener('pointerdown',event=>{if(!draft)return;pointer=event.pointerId;try{canvasPreviewTarget(map).setPointerCapture(pointer);}catch{}aim(event);});
 map.addEventListener('pointermove',event=>{if(pointer===event.pointerId)aim(event);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])map.addEventListener(name,()=>{pointer=undefined;});
 photo.onclick=event=>{if(!selected())return;const r=canvasPreviewTarget(photo).getBoundingClientRect(),x=(event.clientX-r.left)/r.width*1000,y=(event.clientY-r.top)/r.height*1150;if(x<photoWindow.x||x>photoWindow.x+photoWindow.width||y<photoWindow.y||y>photoWindow.y+photoWindow.height)return;placePerson({x:(x-photoWindow.x)/photoWindow.width,y:(y-photoWindow.y)/photoWindow.height});sync();};
 $('#framing-cancel').onclick=()=>dialog.close();
 $('#framing-save').onclick=async()=>{const button=$('#framing-save');button.disabled=true;try{if(getRoom()?.id!==editingRoom){toast('拍摄已切换，请重新打开取景。');return;}const result=await perform('booth_style',{camera:draft.camera,positions:draft.positions});if(result){dialog.close();toast('取景和照片站位已保存，现场位置没有改变。');}}finally{button.disabled=false;}};
 dialog.addEventListener('close',()=>{draft=null;generation++;pointer=undefined;});
 return {render(editable){trigger.disabled=!editable;}};
}
