// Pure placement shared by rendering and geometry tests. Source contacts are
// registered per sprite; this is alignment, not automatic hand recognition.
export function composeDuoLayout(subjects,{center,window,height=240,heightMode='contact-fit-v1'}){
 if(subjects.length!==2||new Set(subjects.map(s=>s.id)).size!==2)throw Error('双人动作必须有两份不同人物素材');
 for(const s of subjects)if(![s.frame.width,s.frame.height,...s.contact,s.heightScale??1].every(Number.isFinite)||s.frame.width<=0||s.frame.height<=0||(s.heightScale??1)<=0||s.contact[0]<0||s.contact[0]>s.frame.width||s.contact[1]<0||s.contact[1]>=s.frame.height)throw Error('双人动作接触点或尺寸无效');
 for(const s of subjects)if(s.sole!==undefined&&(!Number.isFinite(s.sole)||s.sole<=0||s.sole>s.frame.height))throw Error('双人动作脚底登记无效');
 if(![center.x,center.y,window.x,window.y,window.width,window.height,height].every(Number.isFinite)||window.width<=16||window.height<=16||height<=0)throw Error('照片窗口或位置无效');
 const baseline=window.y+Math.min(.89,Math.max(.3,center.y))*window.height;
 if(heightMode==='natural-depth-v1'){
  let rows=subjects.map(s=>{const scale=height*(s.heightScale||1)/s.frame.height;return {...s,width:s.frame.width*scale,height:s.frame.height*scale,contactX:(s.flip?s.frame.width-s.contact[0]:s.contact[0])*scale,contactY:s.contact[1]*scale};});
  const left=Math.max(...rows.map(s=>s.contactX)),right=Math.max(...rows.map(s=>s.width-s.contactX)),tallest=Math.max(...rows.map(s=>s.height)),fit=Math.min(1,(window.width-16)/(left+right),(window.height-68)/tallest);
  rows=rows.map(s=>({...s,width:s.width*fit,height:s.height*fit,contactX:s.contactX*fit,contactY:s.contactY*fit}));
  const minX=window.x+8+Math.max(...rows.map(s=>s.contactX)),maxX=window.x+window.width-8-Math.max(...rows.map(s=>s.width-s.contactX)),x=Math.max(minX,Math.min(maxX,window.x+center.x*window.width));
  // The alpha bottom may be a hanging hand or hair, not a shoe. New rigs carry
  // their anatomical sole independently; absent registrations retain old pixels.
  const rises=rows.map(s=>(s.sole??s.frame.height)/s.frame.height*s.height-s.contactY),wanted=baseline-rises.reduce((a,b)=>a+b,0)/rows.length,minY=window.y+8+Math.max(...rows.map(s=>s.contactY)),maxY=window.y+window.height-60-Math.max(...rows.map(s=>s.height-s.contactY)),y=Math.max(minY,Math.min(maxY,wanted));
  return {baseline,contact:{x,y},heightMode,depthSpread:Math.max(...rises)-Math.min(...rises),rects:rows.map((s,i)=>({id:s.id,x:x-s.contactX,y:y-s.contactY,width:s.width,height:s.height,footY:y+rises[i],side:s.side,flip:s.flip,contact:{x,y}}))};
 }
 let rise=Math.min(...subjects.map(s=>(s.frame.height-s.contact[1])/s.frame.height*height*(s.heightScale||1)));
 const available=baseline-window.y-8;
 const units=subjects.map(s=>({s,k:1/(s.frame.height-s.contact[1])}));
 rise=Math.min(rise,...units.map(({s,k})=>available/(s.frame.height*k)));
 let rows=units.map(({s,k})=>{const scale=rise*k,width=s.frame.width*scale,contactX=(s.flip?s.frame.width-s.contact[0]:s.contact[0])*scale;return {...s,width,height:s.frame.height*scale,contactX};});
 const left=Math.max(...rows.map(s=>s.contactX)),right=Math.max(...rows.map(s=>s.width-s.contactX)),fit=Math.min(1,(window.width-16)/(left+right));
 if(fit<1){rise*=fit;rows=rows.map(s=>({...s,width:s.width*fit,height:s.height*fit,contactX:s.contactX*fit}));}
 const minX=window.x+8+Math.max(...rows.map(s=>s.contactX)),maxX=window.x+window.width-8-Math.max(...rows.map(s=>s.width-s.contactX)),x=Math.max(minX,Math.min(maxX,window.x+center.x*window.width)),y=baseline-rise;
 return {baseline,contact:{x,y},rects:rows.map(s=>({id:s.id,x:x-s.contactX,y:baseline-s.height,width:s.width,height:s.height,footY:baseline,side:s.side,flip:s.flip,contact:{x,y}}))};
}
