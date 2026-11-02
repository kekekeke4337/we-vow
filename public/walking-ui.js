import {sampleWalk} from './walkways.js';
import {resolveFacing,createFacingTracker} from './facing.js';
import {installDirectionalMarkers,installDirectionalPortrait} from './direction-art.js';
import {worldDepth,installWorldOcclusion} from './world-depth.js';
import {motionClock} from './motion-clock.js';
import {worldMarkerSize,seatingRowGap} from './world-marker-size.js';
export function installWalkingUI({act}){
 const track=document.querySelector('#world-track'),garden=document.querySelector('#garden'),ns='http://www.w3.org/2000/svg';
 installWorldOcclusion(track,track.querySelector('.world-map'));
 const trail=document.createElementNS(ns,'svg'),line=document.createElementNS(ns,'polyline');trail.classList.add('walking-trail');trail.setAttribute('viewBox','0 0 3000 1000');trail.setAttribute('preserveAspectRatio','none');trail.setAttribute('aria-hidden','true');line.setAttribute('vector-effect','non-scaling-stroke');trail.append(line);track.append(trail);
 const follow=document.createElement('button');follow.id='companion-follow';follow.type='button';follow.hidden=true;document.querySelector('#profile-panel').append(follow);
 const paintCharacter=installDirectionalMarkers(),paintPortrait=installDirectionalPortrait();
 const turn=document.createElement('button');turn.id='character-turn';turn.type='button';turn.textContent='转身';turn.title='停下后转动本人朝向';document.querySelector('#profile-panel').append(turn);
 turn.onclick=()=>{const order=['down','left','up','right'],current=resolveFacing(state.me,motionClock.time());act('turn',{direction:order[(order.indexOf(current)+1)%4]});};
 let state,entries=[],frame,width=1,height=1,routeId;const positions=new WeakMap(),trackFacing=createFacingTracker();
 function measure(){width=track.clientWidth;height=track.clientHeight;const photoReady=Boolean(state?.photo?.ready&&state.photo.layoutVersion==='arch-t-v2'&&['photo','closed'].includes(state.phase.id)),seatedGap=state&&['seating','opening','witness','entrance','groom','consent','rings','kiss','embrace'].includes(state.phase.id)?seatingRowGap(state.guests):undefined;track.dataset.photoFormation=String(photoReady);track.style.setProperty('--walking-size',worldMarkerSize(Math.max(1,width),{photoReady,seatedGap})+'px');track.style.setProperty('--photo-name-width',width*.0085+'px');track.style.setProperty('--garden-flower-size',Math.max(18,Math.min(44,width*.013))+'px');paint();}
 new ResizeObserver(measure).observe(track);
 function place(el,point,direction,moving){const value={x:(point[0]*width).toFixed(2)+'px',y:(point[1]*height).toFixed(2)+'px',depth:String(worldDepth(point[1])),direction,moving},previous=positions.get(el)||{};
  if(previous.x!==value.x)el.style.setProperty('--walk-x',value.x);if(previous.y!==value.y)el.style.setProperty('--walk-y',value.y);if(previous.depth!==value.depth)el.style.zIndex=value.depth;if(previous.direction!==direction)el.dataset.direction=direction;if(previous.moving!==moving)el.classList.toggle('walking',moving);positions.set(el,value);
 }
 function paint(){
  cancelAnimationFrame(frame);const now=motionClock.time();let active=false,ownMoving=false;
  for(const [guest,el]of entries){const sample=sampleWalk(guest.motion,now,[guest.x,guest.y]),direction=trackFacing(guest,now,sample);place(el,sample.position,direction,sample.moving);paintCharacter(guest,el,direction);active||=sample.moving;if(guest.id===state?.me.id)ownMoving=sample.moving;}
  trail.style.display=ownMoving?'block':'none';
  if(active&&!document.hidden&&garden.classList.contains('active'))frame=requestAnimationFrame(paint);
 }
 follow.onclick=()=>{const target=state.me.partner?state.me:state.guests.find(g=>g.id===state.me.companionId);if(target)act('follow',{enabled:target.followPartner===false});};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)paint();else cancelAnimationFrame(frame);});
 new MutationObserver(paint).observe(garden,{attributes:true,attributeFilter:['class']});
 return {render(value,markers){state=value;paintPortrait(value.me,document.querySelector('#profile-initial'));motionClock.observeSnapshot(value);entries=value.guests.map(g=>[g,markers.get(g.id)]).filter(([,el])=>el);turn.disabled=value.phase.id==='closed'||value.phase.id==='photo'&&value.photo?.ready||sampleWalk(value.me.motion,motionClock.time(),[value.me.x,value.me.y]).moving;
  const companion=value.me.partner?value.me:value.guests.find(g=>g.id===value.me.companionId);follow.hidden=!value.me.partner&&!value.me.companionId;follow.disabled=!companion||value.phase.id==='closed';follow.textContent=!companion?'伴侣暂未在场':companion.followPartner===false?'恢复伴侣跟随':'暂停伴侣跟随';
  const own=value.guests.find(g=>g.id===value.me.id);if(own?.motion?.id!==routeId){routeId=own?.motion?.id;line.setAttribute('points',(own?.motion?.path||[]).map(([x,y])=>`${x*3000},${y*1000}`).join(' '));}
  measure();
 }};
}
