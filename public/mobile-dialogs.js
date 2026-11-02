// Keep short messages complete; long forms scroll only their content, not controls.
export function installMobileDialogs(query){
 const records=[...document.querySelectorAll('dialog > .dialog-card')].map(card=>({card,children:[...card.childNodes],booth:card.querySelector('#booth-controls'),mounted:false}));
 for(const record of records)if(record.booth)record.boothChildren=[...record.booth.childNodes];
 function layout(){for(const r of records){
  if(query.matches&&!r.mounted){
   r.mounted=true;const make=name=>{const el=document.createElement('div');el.className='mobile-dialog-'+name;return el;};
   const heading=make('heading'),body=make('body'),actions=make('actions'),visual=make('visual');
   for(const node of r.children){if(node.nodeType!==1){body.append(node);continue;}if(node.matches('.dialog-close,.eyebrow,h2,h3')||node.matches('form')&&node.querySelector('.dialog-close'))heading.append(node);else if(node.matches('button'))actions.append(node);else if(node.matches('#generated-flower,#bloom-flower,#photo-preview'))visual.append(node);else body.append(node);}
   if(r.booth){
    const preview=r.booth.querySelector('#booth-preview'),group=document.createElement('div');group.className='booth-session-actions';
    // The original booth has just moved into the detached body above. Global
    // getElementById cannot find its buttons until the new layout is mounted.
    // Appending those null lookups literally printed "nullnullnull" on phones.
    visual.append(preview);for(const id of ['booth-capture','booth-cancel','booth-download']){const button=r.booth.querySelector('#'+id);if(!button)throw new Error('拍立得按钮缺失：'+id);group.append(button);}actions.append(group);
    const sync=()=>{preview.hidden=r.booth.hidden;group.hidden=r.booth.hidden;};r.observer=new MutationObserver(sync);r.observer.observe(r.booth,{attributes:true,attributeFilter:['hidden']});sync();
   }
   r.card.classList.toggle('has-mobile-visual',Boolean(visual.children.length));r.card.append(heading,visual,body,actions);
  }else if(!query.matches&&r.mounted){
   r.observer?.disconnect();if(r.booth){document.getElementById('booth-preview').hidden=false;r.booth.replaceChildren(...r.boothChildren);}
   r.card.replaceChildren(...r.children);r.card.classList.remove('has-mobile-visual');r.mounted=false;
  }
 }}
 query.addEventListener('change',layout);layout();
}
