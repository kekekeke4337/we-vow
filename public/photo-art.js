import {photoArtVersion,photoArtKey,describePhotoArt,photoProps} from './photo-art-manifest.js';
import {freezeGenericArt} from './generic-art-manifest.js';
import {prepareGenericRig,drawGenericRig} from './generic-art.js';
const cache=new Map();
let layoutsPromise;
// Keep the canonical PNG path in frozen photo metadata and atlas-layout keys,
// but decode a half-resolution mobile derivative at display time. Android and
// OpenHarmony prefer WebP; iOS WebKit gets a PNG derivative first because some
// transparent WebP atlases can download successfully without completing image
// decode. Either mobile format may fall back to the other before the large
// canonical PNG is attempted.
function decodeCandidates(file){
 if(!/^assets\/(?:sprites|generic|directions)\/.+\.png$/.test(file))return [file];
 const stem=file.replace(/\.png$/,''),ios=/iPad|iPhone|iPod/.test(globalThis.navigator?.userAgent||'');
 // xiaosi-che mobile atlases were briefly published at half resolution.
 // Keep the stable canonical snapshot path, but bust only those stale mobile URLs.
 const revision='';
 return ios?[stem+'.mobile.png'+revision,stem+'.mobile.webp'+revision,file]:[stem+'.mobile.webp'+revision,stem+'.mobile.png'+revision,file];
}
function layouts(){if(!layoutsPromise)layoutsPromise=fetch(new URL('./atlas-layouts.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('layout metadata unavailable');return r.json();}).then(v=>v.version===1?v.layouts:{}).catch(()=>{layoutsPromise=undefined;return {};});return layoutsPromise;}
// Display-time alpha inspection and source rects only: never repaint the original PNGs.
export async function loadArtAtlas(file,columns,rows,{rowGutterFraction=.15,useLayout=true}={}){
 const layoutKey=file+':'+columns+':'+rows+':'+rowGutterFraction,key=layoutKey+(useLayout?'':':scan');
 if(!cache.has(key))cache.set(key,new Promise((resolve,reject)=>{
  const image=new Image(),candidates=decodeCandidates(file);let candidateIndex=0,settled=false,timer;
  const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);cache.delete(key);reject(error);};
  const tryNext=()=>{if(candidateIndex+1>=candidates.length)return false;candidateIndex++;image.src=candidates[candidateIndex];armTimeout();return true;};
  const armTimeout=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!tryNext())fail(new Error('角色素材解码超时：'+file));},7000);};
  image.decoding='async';image.onerror=()=>{if(!tryNext())fail(new Error('角色素材未加载：'+file));};image.onload=async()=>{
   try{
    const registered=useLayout?(await layouts())[layoutKey]:null;
    const scaleX=registered?image.naturalWidth/registered.width:1,scaleY=registered?image.naturalHeight/registered.height:1,proportional=registered&&Math.abs(scaleX-scaleY)<.002;
    if(registered&&proportional&&registered.frames?.length===columns*rows){
     const frames=scaleX===1&&scaleY===1?registered.frames:registered.frames.map(f=>({...f,x:f.x*scaleX,y:f.y*scaleY,width:f.width*scaleX,height:f.height*scaleY,left:f.left*scaleX,top:f.top*scaleY,cellWidth:f.cellWidth*scaleX,cellHeight:f.cellHeight*scaleY,crossings:f.crossings?.map(([x,y])=>[x*scaleX,y*scaleY])}));
     let pixels;const rgba=()=>{if(!pixels){const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);pixels=c.getImageData(0,0,canvas.width,canvas.height).data;}return pixels;};
     settled=true;clearTimeout(timer);resolve({image,frames,width:image.naturalWidth,height:image.naturalHeight,alphaAt:(x,y)=>rgba()[(Math.round(y)*image.naturalWidth+Math.round(x))*4+3],rgbaAt:(x,y)=>{const i=(Math.round(y)*image.naturalWidth+Math.round(x))*4;return Array.from(rgba().slice(i,i+4));}});return;
    }
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const {data}=c.getImageData(0,0,canvas.width,canvas.height),frames=[],columnCounts=new Uint32Array(canvas.width),rowCounts=new Uint32Array(canvas.height);
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>=48){columnCounts[x]++;rowCounts[y]++;}
    // Generated sheets have nominal grids, but actual transparent gutters may be a few pixels off.
    // Select the nearest least-occupied gutter, without altering or regenerating approved artwork.
    function boundaries(counts,cells,fraction=.15){const result=[0];for(let i=1;i<cells;i++){const center=counts.length*i/cells,radius=Math.floor(counts.length/cells*fraction);let best=Math.round(center);for(let k=Math.max(result.at(-1)+1,Math.floor(center-radius));k<Math.min(counts.length-1,center+radius);k++)if(counts[k]<counts[best]||counts[k]===counts[best]&&Math.abs(k-center)<Math.abs(best-center))best=k;result.push(best);}result.push(counts.length);return result;}
    const columnsAt=boundaries(columnCounts,columns);
    // Different poses may end on different scanlines: find each column's row gutter separately.
    const rowsByColumn=Array.from({length:columns},(_,col)=>{const counts=new Uint32Array(canvas.height);for(let y=0;y<canvas.height;y++)for(let x=columnsAt[col];x<columnsAt[col+1];x++)if(data[(y*canvas.width+x)*4+3]>=48)counts[y]++;return boundaries(counts,rows,rowGutterFraction);});
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
     const rowsAt=rowsByColumn[col],left=columnsAt[col],right=columnsAt[col+1],top=rowsAt[row],bottom=rowsAt[row+1];let x0=right,y0=bottom,x1=left,y1=top,occupied=0;
     for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(data[(y*canvas.width+x)*4+3]>=48){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);occupied++;}
     if(!occupied)throw new Error('角色图集有空帧：'+file);
     const solid=(x,y)=>x>=0&&y>=0&&x<canvas.width&&y<canvas.height&&data[(y*canvas.width+x)*4+3]>=48;
     // Touching the pixel BEFORE an empty gutter is safe; a silhouette crossing the cut is not.
     const crossings=[];
     for(let x=left;x<right;x++){if(solid(x,top)&&(top===0||solid(x,top-1)))crossings.push([x,top]);if(solid(x,bottom-1)&&(bottom===canvas.height||solid(x,bottom)))crossings.push([x,bottom]);}
     for(let y=top;y<bottom;y++){if(solid(left,y)&&(left===0||solid(left-1,y)))crossings.push([left,y]);if(solid(right-1,y)&&(right===canvas.width||solid(right,y)))crossings.push([right,y]);}
     frames.push({x:x0,y:y0,width:x1-x0+1,height:y1-y0+1,left:col*canvas.width/columns,top:row*canvas.height/rows,cellWidth:canvas.width/columns,cellHeight:canvas.height/rows,occupied,borderOccupied:crossings.length>0,crossings:crossings.slice(0,12)});
    }
    settled=true;clearTimeout(timer);resolve({image,frames,width:canvas.width,height:canvas.height,alphaAt:(x,y)=>data[(Math.round(y)*canvas.width+Math.round(x))*4+3],rgbaAt:(x,y)=>Array.from(data.slice((Math.round(y)*canvas.width+Math.round(x))*4,(Math.round(y)*canvas.width+Math.round(x))*4+4))});
   }catch(e){fail(e);}
  };image.src=candidates[0];armTimeout();
 }));
 return cache.get(key);
}
export async function preparePhotoSubjects(room){
 const modern=room.status!=='captured'||room.artVersion===photoArtVersion;
 return Promise.all((room.people||[]).map(async person=>{
  const key=modern?(Object.hasOwn(person,'artKey')?person.artKey:photoArtKey(person)):null,description=room.status==='captured'&&Object.hasOwn(person,'artSnapshot')?person.artSnapshot:describePhotoArt(key,person.pose||'stand',person.prop||'none')||(modern?freezeGenericArt(person):null);
  if(description?.kind==='generic'){const rig=await prepareGenericRig(description.avatar,{prop:person.prop||'none',snapshot:description}),canvas=document.createElement('canvas'),parts=drawGenericRig(canvas,rig,{pose:person.pose||'stand',prop:person.prop||'none'});return {person,description,generic:{canvas,parts},props:null,modern};}
  const atlas=description?await loadArtAtlas(description.file,description.columns,description.rows):null;
  const propSource=description?.props||photoProps,propImage=modern&&person.prop&&person.prop!=='none'?await loadArtAtlas(propSource.file,propSource.columns,propSource.rows):null;
  const props=propImage?{...propImage,indices:propSource.indices}:null;
  return {person,description,atlas,props,modern};
 }));
}
const propGrips={moon:[.51,.88],ginkgo:[.52,.87],raven:[.43,.86],heart:[.52,.88]};
export function drawProp(c,props,prop,point,height,angle=0){
 if(!props||!Object.hasOwn(props.indices,prop))return null;
 const f=props.frames[props.indices[prop]],grip=propGrips[prop],scale=height/f.height,rect={x:point[0]-f.width*scale*grip[0],y:point[1]-height*grip[1],width:f.width*scale,height};
 c.save();c.translate(point[0],point[1]);c.rotate(angle);c.drawImage(props.image,f.x,f.y,f.width,f.height,rect.x-point[0],rect.y-point[1],rect.width,rect.height);c.restore();
 const corners=[[rect.x,rect.y],[rect.x+rect.width,rect.y],[rect.x,rect.y+height],[rect.x+rect.width,rect.y+height]].map(([x,y])=>[point[0]+(x-point[0])*Math.cos(angle)-(y-point[1])*Math.sin(angle),point[1]+(x-point[0])*Math.sin(angle)+(y-point[1])*Math.cos(angle)]),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
 return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),angle};
}
export function drawPhotoSubject(c,prepared,{x,footY,height=240,ceiling=55}){
 if(prepared.generic){height=Math.min(height,Math.max(40,footY-ceiling-8));const scale=height/350,rect={x:x-128*scale,y:footY-height,width:256*scale,height};c.drawImage(prepared.generic.canvas,0,0,256,350,rect.x,rect.y,rect.width,rect.height);const p=prepared.generic.parts.propRect;return {drawn:true,propDrawn:Boolean(p),rect,grip:prepared.generic.parts.grip?.map((v,i)=>(i?rect.y:rect.x)+v*scale),propRect:p?{x:rect.x+p.x*scale,y:rect.y+p.y*scale,width:p.width*scale,height:p.height*scale}:undefined,key:'generic',pose:prepared.person.pose};}
 const {person,description:d,atlas,props}=prepared;
 if(!d||!atlas)return {drawn:false,propDrawn:false};
 height*=d.heightScale;
 if(props&&!d.grip)throw new Error('此人物动作的握持点尚未校准，请先不拿道具或稍后重试。');
 const f=atlas.frames[d.row*d.columns+d.column],propRatio=d.pose==='stand'?.21:.30;
 // Leave room above raised hands so props are not clipped by the photo window.
 const gripRatio=d.grip?(f.top+d.grip[1]*f.cellHeight-f.y)/f.height:.6,aboveHead=props?Math.max(0,propRatio*.9-gripRatio):0;
 height=Math.min(height,Math.max(40,(footY-ceiling-8)/(1+aboveHead)));
 const scale=height/f.height,rect={x:x-f.width*scale/2,y:footY-height,width:f.width*scale,height};
 c.drawImage(atlas.image,f.x,f.y,f.width,f.height,rect.x,rect.y,rect.width,rect.height);
 let point,propRect;
 if(d.grip&&props){
  point=[rect.x+(f.left+d.grip[0]*f.cellWidth-f.x)*scale,rect.y+(f.top+d.grip[1]*f.cellHeight-f.y)*scale];propRect=drawProp(c,props,person.prop,point,height*propRatio,d.propAngle);
  // Restore the ORIGINAL hand pixels over the handle; no synthetic finger shapes.
  c.save();c.beginPath();c.ellipse(point[0],point[1],f.cellWidth*.023*scale,f.cellHeight*.024*scale,0,0,Math.PI*2);c.clip();c.drawImage(atlas.image,f.x,f.y,f.width,f.height,rect.x,rect.y,rect.width,rect.height);c.restore();
 }
 return {drawn:true,propDrawn:Boolean(propRect),rect,grip:point,propRect,key:d.key,pose:d.pose};
}
export function drawPlaceholderProp(c,prepared,point,height=62){return drawProp(c,prepared.props,prepared.person.prop,point,height);}
