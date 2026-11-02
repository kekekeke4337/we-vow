// Calibrated against unchanged map v7. These are clipping windows, not new artwork.
export const worldDepth=y=>10+Math.round(y*1000);
export const worldOccluders=[
 {id:'bridge-front-beam',footY:.633,polygon:[[.213,.571],[.230,.554],[.248,.548],[.268,.552],[.288,.565],[.310,.591],[.321,.609],[.320,.632],[.305,.611],[.286,.585],[.267,.573],[.248,.571],[.230,.580],[.214,.601]]},
 {id:'bridge-left-post',footY:.620,polygon:[[.202,.445],[.209,.438],[.214,.457],[.214,.477],[.219,.484],[.219,.500],[.215,.509],[.215,.601],[.210,.620],[.203,.612],[.202,.512],[.198,.501],[.199,.483],[.202,.477]]},
 {id:'bridge-right-post',footY:.660,polygon:[[.320,.493],[.325,.483],[.330,.500],[.330,.520],[.335,.531],[.334,.551],[.332,.556],[.333,.641],[.327,.660],[.320,.653],[.319,.557],[.316,.547],[.316,.531],[.320,.521]]}
];

export function installWorldOcclusion(track,map){
 const layers=worldOccluders.map(item=>{
  const image=document.createElement('img');image.className='world-occluder';image.dataset.occluder=item.id;image.alt='';image.setAttribute('aria-hidden','true');image.draggable=false;
  image.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;user-select:none';
  image.style.clipPath='polygon('+item.polygon.map(([x,y])=>`${x*100}% ${y*100}%`).join(',')+')';
  image.style.zIndex=String(worldDepth(item.footY));track.append(image);return image;
 });
 function sync(){const src=map.currentSrc||map.src;if(src)for(const image of layers)if(image.src!==src)image.src=src;}
 map.addEventListener('load',sync);sync();return layers;
}
