// Selected after a browser pixel-by-pixel check: identical decoded pixels to PNG.
export const mapArt={preferred:'assets/wedding-map-v7-lossless.webp',fallback:'assets/wedding-map-v7.png'};
let imagePromise,dataPromise;
export function loadMapImage(){if(!imagePromise){const attempt=new Promise((ok,no)=>{const image=new Image();image.onload=()=>ok(image);image.onerror=()=>{if(image.src.endsWith(mapArt.fallback))no(new Error('地图加载失败'));else image.src=mapArt.fallback;};image.src=mapArt.preferred;});imagePromise=attempt.catch(error=>{imagePromise=undefined;throw error;});}return imagePromise;}
export function loadMapDataUrl(){if(!dataPromise)dataPromise=loadMapImage().then(image=>fetch(image.src)).then(r=>{if(!r.ok)throw Error('照片背景加载失败');return r.blob();}).then(blob=>new Promise((ok,no)=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.onerror=no;reader.readAsDataURL(blob);})).catch(error=>{dataPromise=undefined;throw error;});return dataPromise;}
