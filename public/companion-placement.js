export function installCompanionPlacement({api,render,toast,getState,focusOwner}){
 const panel=document.querySelector('#profile-panel'),view=document.querySelector('#world-viewport'),toggle=document.createElement('button'),beside=document.createElement('button');
 toggle.id='companion-place-toggle';toggle.type='button';toggle.textContent='点地图摆放我的机';toggle.setAttribute('aria-pressed','false');beside.id='companion-place-beside';beside.type='button';beside.textContent='让机站我旁边';toggle.hidden=beside.hidden=true;panel.append(toggle,beside);
 let active=false,busy=false;
 function cancel(){active=false;toggle.textContent='点地图摆放我的机';toggle.setAttribute('aria-pressed','false');view.classList.remove('companion-placement-mode');}
 function update(snapshot){const owner=snapshot.me,companion=snapshot.guests.find(g=>g.id===owner.companionId),eligible=owner.kind!=='machine'&&!owner.partner&&Boolean(owner.companionId),blocked=busy||snapshot.paused||!['garden','banquet'].includes(snapshot.phase.id)||Boolean(companion&&companion.role!=='guest');toggle.hidden=beside.hidden=!eligible;toggle.disabled=beside.disabled=blocked;if(!eligible||blocked)cancel();}
 async function place(args){cancel();busy=true;if(getState())update(getState());try{render(await api('/api/companion/place',args));if(args.mode==='beside')focusOwner?.();toast('已只调整你的伴侣机；已暂停跟随，可由本人继续移动或恢复跟随。');}catch(e){toast(e.message);}finally{busy=false;if(getState())update(getState());}}
 toggle.onclick=()=>{if(active){cancel();return;}active=true;toggle.textContent='取消摆位模式';toggle.setAttribute('aria-pressed','true');view.classList.add('companion-placement-mode');document.querySelector('#profile-close').click();toast('下一次点空地图只移动你的机；拖动先浏览，点完退出摆位。仅入场和宴会开放。');};
 beside.onclick=()=>{document.querySelector('#profile-close').click();place({mode:'beside'});};
 return {render:update,cancel,isActive:()=>active,place};
}
