import {duoArtVersion,duoPoses,supportedDuo,freezeDuoArt} from './duo-art-manifest.js';
import {loadArtAtlas} from './photo-art.js';
import {photoWindow,defaultPhotoPosition} from './photo-layout.js';
import {individualDuoVersion} from './individual-duo-art.js';
import {drawIndividualDuo} from './individual-duo-render.js';

export async function drawPhotoDuo(c,room){
 const duo=room.duo;if(duo?.status!=='accepted')return null;
 const allPeople=room.people||[],people=allPeople.filter(p=>[duo.from,duo.to].includes(p.id));if(people.length!==2)throw Error('双人动作的入镜身份不完整，请重新选择');
 // Consent pins the actual sources, even before capture. A catalog update must
 // not silently substitute another pose or invalidate an archived photograph.
 const art=duo.artSnapshot||freezeDuoArt(people,duo.pose);
 if(art?.version===individualDuoVersion){if(art.pose!==duo.pose||art.members.length!==2||!art.members.every(id=>people.some(p=>p.id===id)))throw Error('双人动作存档来源无效');return drawIndividualDuo(c,room,art);}
 if(!art||art.version!==duoArtVersion||art.pose!==duo.pose||art.members.length!==2||!art.members.every(id=>people.some(p=>p.id===id)))throw Error('双人动作存档来源无效，不能改用其他人物');
 const atlas=await loadArtAtlas(art.file,art.columns,art.rows),f=atlas.frames[art.column];
 const points=people.map(p=>room.positions?.[p.id]||defaultPhotoPosition(allPeople.findIndex(other=>other.id===p.id),allPeople.length));
 const center=points.reduce((a,p)=>({x:a.x+p.x/2,y:a.y+p.y/2}),{x:0,y:0});
 const footY=photoWindow.y+center.y*photoWindow.height,scale=Math.min(240/f.height,photoWindow.width*.85/f.width,Math.max(40,footY-photoWindow.y-8)/f.height),width=f.width*scale,height=f.height*scale;
 const x=Math.max(photoWindow.x+width/2,Math.min(photoWindow.x+photoWindow.width-width/2,photoWindow.x+center.x*photoWindow.width)),rect={x:x-width/2,y:footY-height,width,height};
 c.drawImage(atlas.image,f.x,f.y,f.width,f.height,rect.x,rect.y,width,height);
 c.font='22px "Microsoft YaHei",sans-serif';
 for(const [i,id]of art.members.entries()){
  const person=people.find(p=>p.id===id),anchor=x+(i?1:-1)*Math.min(82,width*.25),nameWidth=Math.min(180,c.measureText(person.name).width)+20;
  c.font='22px "Microsoft YaHei",sans-serif';c.fillStyle='#fff9ece6';c.fillRect(anchor-nameWidth/2,footY+25,nameWidth,32);c.fillStyle='#294c40';c.textAlign='center';c.fillText(person.name,anchor,footY+49,180);
 }
 return {people:art.members,rect,pose:duo.pose};
}

export function installPhotoDuo({perform,getRoom,getPeople,getState}){
 const root=document.createElement('fieldset'),legend=document.createElement('legend'),note=document.createElement('p'),pose=document.createElement('select'),target=document.createElement('select'),request=document.createElement('button'),accept=document.createElement('button'),decline=document.createElement('button'),cancel=document.createElement('button'),simulateAccept=document.createElement('button'),simulateDecline=document.createElement('button');
 root.id='booth-duo';root.style.cssText='margin:12px 0;padding:12px;border:1px solid #bdccb5;border-radius:12px';legend.textContent='双人动作 · 需双方同意';note.id='booth-duo-status';note.setAttribute('role','status');
 pose.id='booth-duo-pose';pose.setAttribute('aria-label','双人动作');for(const [key,value]of Object.entries(duoPoses))pose.add(new Option(value.name,key));
 for(const button of [request,accept,decline,cancel,simulateAccept,simulateDecline]){button.type='button';button.style.cssText='min-height:44px;margin:4px;padding:8px';}
 request.id='booth-duo-request';request.textContent='邀请对方做这个动作';accept.id='booth-duo-accept';accept.textContent='同意这个双人动作';decline.id='booth-duo-decline';decline.textContent='不用这个动作';cancel.id='booth-duo-cancel';cancel.textContent='退出双人动作';
 simulateAccept.id='booth-duo-simulate-accept';simulateAccept.textContent='仅演练：模拟对方同意';simulateDecline.id='booth-duo-simulate-decline';simulateDecline.textContent='仅演练：模拟对方拒绝';
 target.id='booth-duo-target';target.setAttribute('aria-label','双人动作邀请对象');
 root.append(legend,note,target,pose,request,accept,decline,cancel,simulateAccept,simulateDecline);document.querySelector('#booth-personal').append(root);
 request.onclick=()=>{const peer=getPeople().find(p=>p.id===target.value);if(peer)perform('booth_duo',{operation:'request',guestId:peer.id,pose:pose.value});};
 return function update(){
  const room=getRoom(),state=getState(),people=getPeople(),duo=room?.duo,me=people.find(p=>p.id===state.me.id),peers=people.filter(p=>p.id!==state.me.id),previous=target.value;
  const options=JSON.stringify(peers.map(p=>[p.id,p.name]));if(target.dataset.options!==options){target.replaceChildren(...peers.map(p=>new Option(p.name,p.id)));if(peers.some(p=>p.id===previous))target.value=previous;target.dataset.options=options;}
  const eligible=Boolean(me)&&supportedDuo([me,peers.find(p=>p.id===target.value)].filter(Boolean)),active=room?.status==='open'&&state.activitiesOpen;
  root.hidden=!state.boothOptions?.duoPoses;
  const participating=room&&(room.owner===state.me.id||room.invites.some(i=>i.guestId===state.me.id&&i.status==='accepted'));
  const handsBusy=[state.me.id,target.value].some(id=>room?.styles[id]?.prop&&room.styles[id].prop!=='none');
  pose.disabled=!active||!eligible||!participating;request.disabled=pose.disabled||handsBusy;target.disabled=!active||!participating;
  target.onchange=update;
  const incoming=duo?.status==='pending'&&duo.to===state.me.id;
  accept.hidden=decline.hidden=!incoming;accept.disabled=decline.disabled=!active;
  cancel.hidden=!duo||!['pending','accepted'].includes(duo.status)||![duo.from,duo.to].includes(state.me.id);cancel.disabled=!active;
  const requestId=duo?.id;accept.onclick=()=>perform('booth_duo',{operation:'respond',requestId,accept:true});decline.onclick=()=>perform('booth_duo',{operation:'respond',requestId,accept:false});cancel.onclick=()=>perform('booth_duo',{operation:'cancel',requestId});
  simulateAccept.hidden=simulateDecline.hidden=!state.rehearsal||duo?.status!=='pending'||incoming;simulateAccept.disabled=simulateDecline.disabled=!active;
  simulateAccept.onclick=()=>perform('rehearsal_duo_response',{requestId,accept:true});simulateDecline.onclick=()=>perform('rehearsal_duo_response',{requestId,accept:false});
  note.textContent=!eligible?'所选人物的独立双人动作素材尚待补齐；仍可用各自单人姿势一起拍，不会套用别人的形象。':handsBusy?'亲吻／挽手需要双方空手。你或对方还拿着道具，邀请尚未发送；请双方先选择“不拿道具”，再发邀请。':duo?.status==='pending'?(incoming?'对方邀请你'+duoPoses[duo.pose].name+'，是否愿意？':'正在等对方本人同意；可以取消，不代答。'):duo?.status==='accepted'?'双方已同意'+duoPoses[duo.pose].name+'。当前为空手动作，参与者改姿势或拿道具会退出；其他入镜者不受影响。':'先选择邀请对象与动作，再由对方本人同意。不限制情侣身份；其他入镜者可保留自己的姿势和道具。';
 };
}
