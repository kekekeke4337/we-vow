import {directionalAtlas,drawDirectional} from './direction-art.js';
import {allocateFrontPhoto,isFrontPhoto,largeFrontPhotoVersion,frontPhotoBackground} from './front-photo-layout.js';
const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
let backdrop;
async function background(){if(!backdrop)backdrop=new Promise((ok,no)=>{const img=new Image();img.onload=()=>ok(img);img.onerror=()=>{backdrop=null;no(Error('近景合影背景加载失败，请重试'));};img.src=frontPhotoBackground;});return backdrop;}
export async function renderFrontPhoto(photo){
 if(!isFrontPhoto(photo)||photo.frontBackground!==frontPhotoBackground)throw Error('未知近景合影版本，不能改画旧照片');
 const large=photo.layoutVersion===largeFrontPhotoVersion,people=photo.guests||[],slots=allocateFrontPhoto(people,{large}),canvas=document.createElement('canvas');canvas.width=large?2400:1800;canvas.height=large?1800:1200;
 const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#f6f0df';c.fillRect(0,0,canvas.width,canvas.height);c.strokeStyle='#b5c4a5';c.lineWidth=2;c.strokeRect(6,6,canvas.width-12,canvas.height-12);
 const rect={x:24,y:24,width:canvas.width-48,height:canvas.height-48},bg=await background(),scale=Math.max(rect.width/bg.width,rect.height/bg.height),sw=rect.width/scale,sh=rect.height/scale;c.drawImage(bg,(bg.width-sw)/2,(bg.height-sh)/2,sw,sh,rect.x,rect.y,rect.width,rect.height);
 const sprites=await Promise.all(people.map(async p=>{const art=await directionalAtlas(p,{snapshot:p.worldArtSnapshot});if(!art)throw Error('合影人物素材缺失：'+p.name);const image=document.createElement('canvas');drawDirectional(image,art,'down');const pixels=image.getContext('2d').getImageData(0,0,image.width,image.height).data;let left=image.width,top=image.height,right=-1,bottom=-1;for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>=48){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}if(right<left)throw Error('合影人物为空：'+p.name);return {p,image,left,top,width:right-left+1,height:bottom-top+1,scale:art.heightScale??1};}));
 const metrics=[];sprites.sort((a,b)=>slots.get(a.p.id).y-slots.get(b.p.id).y);
 for(const s of sprites){const slot=slots.get(s.p.id),depth=.92+slot.row*.04,near=slot.row>=1,layer=slot.kind==='couple'?.315:slot.kind==='dedicated'?.23*(near?1.10:1):.205*(near?1.04:1);let height=rect.height*layer*depth*s.scale,width=height*s.width/s.height;const x=rect.x+slot.x*rect.width,y=rect.y+slot.y*rect.height,fit=Math.min(1,(Math.min(x-rect.x,rect.x+rect.width-x)*2-8)/width);height*=fit;width*=fit;const drawY=y-height*(172-s.top)/s.height;
  if(large){const ratio=Math.min(1,(slot.kind==='couple'?240:190)/height,(slot.kind==='couple'?155:92)/width);height*=ratio;width*=ratio;}
  const finalY=large?y-height*(172-s.top)/s.height:drawY;
  if(x-width/2<rect.x-.01||x+width/2>rect.x+rect.width+.01||finalY<rect.y-.01||finalY+height>rect.y+rect.height+.01)throw Error('近景合影人物超出画面：'+s.p.name);
  c.save();c.filter='blur('+Math.max(.5,height*.008)+'px)';c.fillStyle='rgba(36,57,36,.16)';c.beginPath();c.ellipse(x,y+.4,Math.max(5,width*.29),Math.max(1.5,height*.018),0,0,Math.PI*2);c.fill();c.restore();c.drawImage(s.image,s.left,s.top,s.width,s.height,x-width/2,finalY,width,height);metrics.push({id:s.p.id,name:s.p.name,x,y,top:finalY,height,width});
 }
 const metadata=metrics.map(m=>`<g data-photo-guest-id="${esc(m.id)}" data-height="${m.height}" data-x="${m.x}" data-top="${m.top}" data-width="${m.width}"><title>${esc(m.name)}</title></g>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" data-photo-layout="${photo.layoutVersion}" data-guest-count="${people.length}" role="img" aria-label="婚礼近景合影，${people.length}位来宾"><image href="${canvas.toDataURL('image/png')}" width="${canvas.width}" height="${canvas.height}"/>${metadata}</svg>`;
}
