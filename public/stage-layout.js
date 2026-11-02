// Coordinates calibrated against the approved v7 map, in whole-map units.
// The ceremony lawn is land; the former banquet-grid extension crossed water.
export const stageLayout=Object.freeze({
 version:'arch-t-v2',scene:'ceremony',
 couple:{x:.43,y:.35,gap:.018},
 rings:{x:.43,y:.395},
 photo:{left:.354,right:.506,barRows:[.35,.405],barSides:[[.354,.409],[.451,.506]],stemRows:[.465,.525,.585,.645],stemLeft:.415,stemRight:.445},
 crop:{left:.295,top:.12,right:.565,bottom:.7275},
});
const legacyStageLayout={version:'arch-lawn-v1',scene:'ceremony',couple:stageLayout.couple,rings:stageLayout.rings,photo:{left:.338,right:.522,rows:[.425,.565]},crop:{left:.315,top:.12,right:.545,bottom:.66}};
export const largeStageLayout={...stageLayout,version:'arch-t-80-v3',photo:{...stageLayout.photo,barRows:[.375,.4,.425,.45,.475,.5],stemRows:[.535,.57,.605,.64]}};
export const stageForCount=count=>count>40?largeStageLayout:stageLayout;
export function photoStageLayout(photo){if(photo?.worldLayoutVersion===largeStageLayout.version||photo?.layoutVersion===largeStageLayout.version)return largeStageLayout;return photo?.layoutVersion===stageLayout.version||photo?.layoutVersion==='front-photo-v2'&&photo.worldLayoutVersion===stageLayout.version?stageLayout:photo?.layoutVersion===legacyStageLayout.version?legacyStageLayout:null;}
export function archPhotoPlaces(groups,layout=stageLayout){
 if(layout.version===legacyStageLayout.version)return legacyArchPhotoPlaces(groups);
 const result=new Map(),regular=groups.filter(group=>!group.some(g=>['bride','groom'].includes(g.role))),barBands=layout.photo.barRows.length*2,bands=Array.from({length:barBands+layout.photo.stemRows.length},()=>[]),capacities=bands.map((_,i)=>i<barBands?6:4);
 for(const group of regular){const band=bands.findIndex((items,i)=>items.reduce((n,g)=>n+g.length,0)+group.length<=capacities[i]);if(band<0)throw Error('T形合影区域已满，请增加经过校准的站位');bands[band].push(group);}
 for(const group of groups.filter(group=>group.some(g=>['bride','groom'].includes(g.role))))for(const g of group)result.set(g.id,{scene:layout.scene,x:layout.couple.x+(g.role==='bride'?-.009:.009),y:layout.couple.y,group:group[0].id,zone:'couple'});
 bands.forEach((items,row)=>{
  const count=items.reduce((n,g)=>n+g.length,0);let slot=0;
  for(const group of items){
   for(const g of group){let x,y,zone;
    if(row<barBands){const side=row%2,[left,right]=layout.photo.barSides[side];x=left+(right-left)*slot/5;y=layout.photo.barRows[Math.floor(row/2)];zone='arch-bar';}
    else{x=layout.couple.x+(slot-(count-1)/2)*.01;y=layout.photo.stemRows[row-barBands];zone='central-aisle';}
    result.set(g.id,{scene:layout.scene,x,y,group:group[0].id,zone});slot++;
   }
  }
 });return result;
}
function legacyArchPhotoPlaces(groups){
 const stageLayout=legacyStageLayout;
 const result=new Map(),regular=groups.filter(group=>!group.some(g=>['bride','groom'].includes(g.role)));
 const rows=[[],[]];let count=0;const total=regular.reduce((n,g)=>n+g.length,0);
 for(const group of regular){const row=count<Math.ceil(total/2)?0:1;rows[row].push(group);count+=group.length;}
 for(const group of groups.filter(group=>group.some(g=>['bride','groom'].includes(g.role))))for(const g of group){
  result.set(g.id,{scene:stageLayout.scene,x:stageLayout.couple.x+(g.role==='bride'?-.009:.009),y:stageLayout.couple.y,group:group[0].id});
 }
 rows.forEach((groups,row)=>{const n=groups.reduce((sum,g)=>sum+g.length,0);let slot=0;
  for(const group of groups){const center=stageLayout.photo.left+(slot+(group.length+1)/2)/(n+1)*(stageLayout.photo.right-stageLayout.photo.left);group.forEach((g,i)=>{const x=center+(group.length===2?(i ? .0045 : -.0045):0);result.set(g.id,{scene:stageLayout.scene,x,y:stageLayout.photo.rows[row],group:group[0].id});});slot+=group.length;}
 });return result;
}
export function stagePhotoPoint(place,layout=stageLayout){
 const {crop}=layout;
 return {x:80+(place.x-crop.left)/(crop.right-crop.left)*1440,y:80+(place.y-crop.top)/(crop.bottom-crop.top)*1080};
}
