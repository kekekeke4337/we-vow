import {loadArtAtlas} from './photo-art.js';
import {prepareGenericRig,drawGenericRig} from './generic-art.js';
import {defaultAvatar} from './avatar-options.js';
import {directionArtVersion,directionalSources,directionalLayout,directionalScale} from './world-art-manifest.js';
export {directionArtVersion,directionalSources} from './world-art-manifest.js';
export const directionColumns={down:0,left:1,up:2,right:3};
export function directionalIdentity(person){
 const c=person.character;return c?.custom&&Object.hasOwn(directionalSources,c.set)&&Number.isInteger(c.member)&&c.member>=0&&c.member<directionalLayout(c.set).rows?{set:c.set,member:c.member}:null;
}
function genericIdentity(person){if(person.character?.custom)return null;const avatar={...defaultAvatar,...(person.character?.avatar||person.avatar||{})};return {set:'generic',member:0,avatar,key:'generic:'+JSON.stringify(avatar)};}
const calibratedSources=new Map();
// On the approved 1536x1024 sheet, the front ear begins at y579, while the
// boots end at y580 farther left. A horizontal gutter cuts the ear. This
// stepped, transparent gutter separates both silhouettes without repainting.
export const frontSeparation={width:1536,height:1024,left:0,right:384,stepX:256,leftY:581,rightY:578};
function calibrateFront(atlas){
 const canonical=frontSeparation,scaleX=atlas.width/canonical.width,scaleY=atlas.height/canonical.height;
 if(Math.abs(scaleX-scaleY)>=.002)throw new Error('小枫/玉衡原图比例变化，请重新校准');
 const s={width:atlas.width,height:atlas.height,left:Math.round(canonical.left*scaleX),right:Math.round(canonical.right*scaleX),stepX:Math.round(canonical.stepX*scaleX),leftY:Math.round(canonical.leftY*scaleY),rightY:Math.round(canonical.rightY*scaleY)};
 const frames=atlas.frames.map(f=>({...f}));let seamCrossings=0;
 for(let x=s.left;x<s.right;x++){const y=x<s.stepX?s.leftY:s.rightY;if(atlas.alphaAt(x,y-1)>=48&&atlas.alphaAt(x,y)>=48)seamCrossings++;}
 for(let y=s.rightY;y<s.leftY;y++)if(atlas.alphaAt(s.stepX-1,y)>=48&&atlas.alphaAt(s.stepX,y)>=48)seamCrossings++;
 if(seamCrossings)throw new Error('小枫/玉衡分离线穿过人物，请重新校准');
 for(const member of [0,1]){
  const image=document.createElement('canvas');image.width=atlas.width;image.height=atlas.height;const c=image.getContext('2d',{willReadFrequently:true});
  c.drawImage(atlas.image,0,0);
  if(member===0){c.clearRect(0,s.leftY,s.stepX,atlas.height);c.clearRect(s.stepX,s.rightY,s.right-s.stepX,atlas.height);}
  else{c.clearRect(0,0,s.stepX,s.leftY);c.clearRect(s.stepX,0,s.right-s.stepX,s.rightY);}
  const {data}=c.getImageData(0,0,atlas.width,atlas.height);let x0=s.right,y0=atlas.height,x1=0,y1=0,occupied=0;
  for(let y=0;y<atlas.height;y++)for(let x=s.left;x<s.right;x++)if(data[(y*atlas.width+x)*4+3]>=48){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);occupied++;}
  frames[member*4]={...frames[member*4],image,x:x0,y:y0,width:x1-x0+1,height:y1-y0+1,occupied,borderOccupied:false,crossings:[],calibration:'stepped-transparent-gutter-v1'};
 }
 return {...atlas,frames,seamCrossings};
}
export async function directionalAtlas(person,{snapshot}={}){
 if(snapshot?.kind==='generic'){const generic=genericIdentity({...person,role:'guest',character:{avatar:snapshot.avatar}});return {...generic,generic:await prepareGenericRig(snapshot.avatar,{snapshot})};}
 if(snapshot&&snapshot.version!==directionArtVersion)throw new Error('未知合影方向素材版本');
 const identity=snapshot?.kind==='directional'?{set:snapshot.set,member:snapshot.member}:directionalIdentity(person);if(!identity){const generic=genericIdentity(person);return generic?{...generic,generic:await prepareGenericRig(generic.avatar)}:null;}
 const file=snapshot?.file||'assets/directions/'+directionalSources[identity.set];
 const layout=snapshot?.columns?{columns:snapshot.columns,rows:snapshot.rows}:directionalLayout(identity.set);
 if(layout.columns!==4||![1,2].includes(layout.rows)||!Number.isInteger(identity.member)||identity.member<0||identity.member>=layout.rows)throw new Error('方向图成员或网格无效');
 const source={...await loadArtAtlas(file,layout.columns,layout.rows,{rowGutterFraction:.3}),heightScale:snapshot?.heightScale??directionalScale(identity.set,identity.member)};
 if(identity.set!=='feng-yuheng')return {...identity,...source};
 if(!calibratedSources.has(file))calibratedSources.set(file,calibrateFront(source));
 return {...identity,...calibratedSources.get(file),heightScale:source.heightScale};
}
// One static frame per direction. Never synthesize walk-animation frames or repaint source art.
export function drawDirectional(canvas,atlas,direction='down'){
 if(atlas.generic){const source=document.createElement('canvas');drawGenericRig(source,atlas.generic,{direction});canvas.width=256;canvas.height=176;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;const scale=160/350,width=256*scale;c.drawImage(source,0,0,256,350,128-width/2,12,width,160);canvas.dataset.direction=direction;canvas.dataset.artKey=atlas.key;return {x:128-width/2,y:12,width,height:160,footY:172};}
 const column=directionColumns[direction]??0,f=atlas.frames[atlas.member*4+column],row=atlas.frames.slice(atlas.member*4,atlas.member*4+4),scale=Math.min(160/Math.max(...row.map(f=>f.height)),248/Math.max(...row.map(f=>f.width)))*(atlas.heightScale??directionalScale(atlas.set,atlas.member));
 canvas.width=256;canvas.height=176;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
 c.drawImage(f.image||atlas.image,f.x,f.y,f.width,f.height,128-f.width*scale/2,172-f.height*scale,f.width*scale,f.height*scale);
 canvas.dataset.direction=direction;canvas.dataset.artKey=atlas.set+':'+atlas.member;
 return {x:128-f.width*scale/2,y:172-f.height*scale,width:f.width*scale,height:f.height*scale,footY:172};
}
const spriteFrames=new Map();
export function prebuiltDirectionStem(person){
 const identity=directionalIdentity(person);if(identity)return identity.set+'-'+identity.member;
 const generic=genericIdentity(person);return generic&&Object.entries(defaultAvatar).every(([key,value])=>generic.avatar[key]===value)?'generic-default-v2':null;
}
export function drawDirectionalPortrait(canvas,atlas){
 canvas.width=96;canvas.height=96;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
 if(atlas.generic){const source=document.createElement('canvas'),parts=drawGenericRig(source,atlas.generic),size=Math.max(parts.head.width,parts.head.height)+16;c.drawImage(source,128-size/2,Math.max(0,parts.head.y-8),size,size,0,0,96,96);}
 else{const f=atlas.frames[atlas.member*4],size=f.height*.43;c.drawImage(f.image||atlas.image,f.x+f.width/2-size/2,f.y,size,size,0,0,96,96);}
}
function spriteFrame(atlas,direction,key){
 const frameKey=key+':'+direction;if(spriteFrames.has(frameKey))return spriteFrames.get(frameKey);
 const canvas=document.createElement('canvas');drawDirectional(canvas,atlas,direction);const frame={src:canvas.toDataURL('image/png'),direction:canvas.dataset.direction,artKey:canvas.dataset.artKey};
 if(spriteFrames.size>=128)spriteFrames.delete(spriteFrames.keys().next().value);spriteFrames.set(frameKey,frame);return frame;
}
export function installDirectionalMarkers(){
 const entries=new WeakMap();
 return function paint(person,marker,direction){
  const identity=directionalIdentity(person)||genericIdentity(person);if(!identity)return;
  const key=identity.key||identity.set+':'+identity.member;let entry=entries.get(marker);
  if(!entry||entry.key!==key){
   entry={key,direction,image:document.createElement('img')};entry.image.className='character-sprite';entry.image.alt='来宾像素形象';entries.set(marker,entry);
   entry.prebuilt=prebuiltDirectionStem(person);
   entry.paint=()=>{if(entry.prebuilt){entry.image.src='assets/world-frames/'+entry.prebuilt+'-'+entry.direction+'.png';entry.image.dataset.direction=entry.direction;entry.image.dataset.artKey=entry.key;return;}if(!entry.atlas)return;const frame=spriteFrame(entry.atlas,entry.direction,entry.key);entry.image.src=frame.src;entry.image.dataset.direction=frame.direction;entry.image.dataset.artKey=frame.artKey;};
   const attach=()=>{marker.firstChild.replaceChildren(entry.image);marker.classList.add('directional-marker');entry.ready=true;entry.paint();};
   const fallback=()=>{if(entry.fallback)return;entry.fallback=true;entry.prebuilt=null;entry.image.onerror=null;directionalAtlas(person).then(atlas=>{if(entries.get(marker)!==entry||!marker.isConnected)return;entry.atlas=atlas;attach();}).catch(error=>{marker.dataset.artError=error.message;});};
   if(entry.prebuilt){entry.image.onerror=fallback;attach();}else fallback();
  }
  if(entry.direction!==direction){entry.direction=direction;if(entry.ready)entry.paint();}
  // The live state refresh must not replace a loaded canvas with a nickname initial.
  if(entry.ready&&marker.firstChild.firstChild!==entry.image)marker.firstChild.replaceChildren(entry.image);
 };
}
export function installDirectionalPortrait(){
 let entry;
 return function render(person,element){
  const id=directionalIdentity(person)||genericIdentity(person);if(!id)return;const key=id.key||id.set+':'+id.member;
  if(entry?.key!==key){const own={key,canvas:document.createElement('canvas')};entry=own;
   own.image=document.createElement('img');own.image.dataset.artKey=key;own.image.alt='我的像素头像';
   const fallback=()=>{own.image.onerror=null;directionalAtlas(person).then(atlas=>{if(entry!==own)return;drawDirectionalPortrait(own.canvas,atlas);own.image.src=own.canvas.toDataURL('image/png');own.loaded=true;element.replaceChildren(own.image);}).catch(error=>{element.dataset.artError=error.message;});};
   const stem=prebuiltDirectionStem(person);if(stem){own.image.onerror=fallback;own.image.src='assets/world-frames/'+stem+'-portrait.png';own.loaded=true;element.replaceChildren(own.image);}else fallback();
  }
  if(entry.loaded&&element.firstChild!==entry.image)element.replaceChildren(entry.image);
 };
}
