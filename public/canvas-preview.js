// Some embedded browsers hide canvas elements despite successful 2D painting.
// Keep the original lossless canvas for capture/download; show an image only
// when that specific canvas is hidden, never unhide a dialog or private panel.
const mirrors=new WeakMap();
export function releaseCanvasPreview(canvas){const entry=canvas&&mirrors.get(canvas);if(!entry)return;entry.revision++;if(entry.url)URL.revokeObjectURL(entry.url);entry.image.remove();mirrors.delete(canvas);}
export function ensureCanvasPreview(canvas){if(!canvas?.isConnected)return;if(getComputedStyle(canvas).display!=='none'){releaseCanvasPreview(canvas);return;}if(!mirrors.has(canvas))syncCanvasPreview(canvas);}
export function canvasPreviewTarget(canvas){return mirrors.get(canvas)?.image||canvas;}
export function syncCanvasPreview(canvas){
 if(!canvas?.isConnected||canvas.hidden)return;
 let entry=mirrors.get(canvas);if(!entry&&getComputedStyle(canvas).display!=='none')return;
 if(!entry){const image=document.createElement('img');image.id=(canvas.id||'booth-photo')+'-image';image.className='preview-canvas-image';image.alt=canvas.getAttribute('aria-label')||'拍立得照片预览';image.width=canvas.width;image.height=canvas.height;canvas.after(image);entry={image,revision:0};mirrors.set(canvas,entry);
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click'])image.addEventListener(type,event=>{if(type==='pointerdown')try{image.setPointerCapture(event.pointerId);}catch{}const EventClass=type==='click'?MouseEvent:PointerEvent;canvas.dispatchEvent(new EventClass(type,{clientX:event.clientX,clientY:event.clientY,pointerId:event.pointerId,pointerType:event.pointerType,buttons:event.buttons,bubbles:false}));});
 }
 const own=++entry.revision;canvas.toBlob(blob=>{if(!blob||entry.revision!==own||!entry.image.isConnected)return;const previous=entry.url;entry.url=URL.createObjectURL(blob);entry.image.src=entry.url;if(previous)URL.revokeObjectURL(previous);},'image/png');
}
