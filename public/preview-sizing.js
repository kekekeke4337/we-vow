// Explicit pixel fitting avoids percentage-height cycles for replaced canvases
// inside mobile grid/flex containers. Pixels painted into the canvas are unchanged.
const query='(max-width:700px),(max-width:1100px) and (max-height:600px)';
import {canvasPreviewTarget,ensureCanvasPreview} from './canvas-preview.js';
function fit(canvas,width,height){
 if(!canvas||width<4||height<4||!canvas.width||!canvas.height)return;
 const sourceWidth=canvas.naturalWidth||canvas.width,sourceHeight=canvas.naturalHeight||canvas.height,scale=Math.min(width/sourceWidth,height/sourceHeight);canvas.style.width=Math.floor(sourceWidth*scale)+'px';canvas.style.height=Math.floor(sourceHeight*scale)+'px';canvas.style.maxWidth='none';canvas.style.maxHeight='none';
}
export function fitPreviewCanvases(){
 const booth=document.querySelector('#booth-preview'),sourcePhoto=document.querySelector('#framing-photo'),sourceMap=document.querySelector('#framing-map'),sourceCanvas=booth?.querySelector('canvas');
 for(const el of [sourceCanvas,sourcePhoto,sourceMap].filter(Boolean))ensureCanvasPreview(el);
 const photo=sourcePhoto&&canvasPreviewTarget(sourcePhoto),map=sourceMap&&canvasPreviewTarget(sourceMap),canvas=sourceCanvas&&canvasPreviewTarget(sourceCanvas);
 if(!matchMedia(query).matches){for(const el of [booth,canvas,photo,map].filter(Boolean))for(const key of ['width','height','max-width','max-height'])el.style.removeProperty(key);return;}
 const visual=booth?.closest('.mobile-dialog-visual');
 if(visual&&visual.clientWidth&&visual.clientHeight){booth.style.width=visual.clientWidth+'px';booth.style.height=visual.clientHeight+'px';fit(canvas,visual.clientWidth,visual.clientHeight);}
 const workspace=photo?.parentElement,section=workspace?.querySelector('section');
 if(workspace?.clientHeight&&workspace.clientWidth&&section){const css=getComputedStyle(workspace),gap=parseFloat(css.columnGap)||0;fit(photo,workspace.clientWidth-section.getBoundingClientRect().width-gap-4,workspace.clientHeight-4);
  const padding=getComputedStyle(section),width=section.clientWidth-(parseFloat(padding.paddingLeft)||0)-(parseFloat(padding.paddingRight)||0)-2;
  fit(map,width,width*sourceMap.height/sourceMap.width);
 }
}
export function installPreviewSizing(){
 let frame;const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fitPreviewCanvases);};
 const observer=new ResizeObserver(schedule);for(const el of document.querySelectorAll('.booth-card,.framing-workspace'))observer.observe(el);
 const mutations=new MutationObserver(schedule);mutations.observe(document.querySelector('#booth-preview'),{childList:true});
 window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);matchMedia(query).addEventListener('change',schedule);schedule();
}
