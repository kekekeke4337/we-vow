export const genericPalettes={sage:[130,155,128],sky:[126,154,184],lavender:[166,145,180],charcoal:[82,91,104]};
const cache=new WeakMap();
// Runtime bitmap tinting only: original PNGs, transparency, skin, white lace,
// gold details and dark outlines are preserved. Clothing still uses generated art.
export const warmSkinPixel=([r,g,b])=>r-g>8&&r-b>16&&g>=b*.95;
export function tintClothPixel(pixel,palette,eligible=true,preserveSkin=false,baseOverride){
 const base=baseOverride||genericPalettes[palette];if(!base)throw new Error('未知配色');const [r,g,b,a]=pixel;
 if(!eligible||!a||preserveSkin&&warmSkinPixel(pixel))return pixel;
 const light=(r*.2126+g*.7152+b*.0722)/255;
 if(light<.16||light>.91||r>g*1.12&&g>b*1.15&&r-b>50)return pixel;
 const baseLight=(base[0]*.2126+base[1]*.7152+base[2]*.0722)/255,ratio=light/baseLight*(palette==='charcoal'?.72:1);
 return [r,g,b].map((value,i)=>Math.round(Math.min(255,Math.max(0,value*.18+base[i]*ratio*.82)))).concat(a);
}
export function tintedClothFrame(atlas,frame,palette,part,paletteRGB){
 if(!Object.hasOwn(genericPalettes,palette))throw new Error('未知配色');
 let entries=cache.get(atlas.image);if(!entries){entries=new Map();cache.set(atlas.image,entries);}
 const key=[frame.x,frame.y,frame.width,frame.height,palette,part,paletteRGB?.join(',')||'catalog'].join(':');if(entries.has(key)){const hit=entries.get(key);entries.delete(key);entries.set(key,hit);return hit;}
 const canvas=document.createElement('canvas');canvas.width=frame.width;canvas.height=frame.height;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(atlas.image,frame.x,frame.y,frame.width,frame.height,0,0,frame.width,frame.height);const pixels=c.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
 for(let y=0;y<canvas.height;y++){const eligible=part==='body'?y>=canvas.height*.11&&y<canvas.height*.88:true;
  if(!eligible)continue;for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;if(!data[i+3])continue;const next=tintClothPixel([data[i],data[i+1],data[i+2],data[i+3]],palette,true,part==='arms',paletteRGB);data[i]=next[0];data[i+1]=next[1];data[i+2]=next[2];}
 }
 c.putImageData(pixels,0,0);entries.set(key,canvas);while(entries.size>32)entries.delete(entries.keys().next().value);return canvas;
}
