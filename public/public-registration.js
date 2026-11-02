import {siteUrl,jointRehearsal} from './site.js';
export function installPublicRegistration({api,show,invitations,toast,onPrepared}){
 const $=s=>document.querySelector(s),incoming=location.hash==='#register',machineIncoming=location.hash==='#machines',key=(machineIncoming?'wedding.machine-registration.':'wedding.registration.')+siteUrl;
 let active=incoming||machineIncoming,loading=false;
 const note=document.createElement('p');note.id='registration-note';note.className='small-note';note.hidden=true;$('#invitation-person').after(note);
 const settings=document.createElement('section');settings.innerHTML='<h3>群报名入口</h3><p>普通人类各领独立请柬；同行机另配绑定请柬，专属邀请不占这里的名额。</p><label>人类名额上限<input id="registration-capacity" type="number" min="1" max="200" value="20"></label><label><input id="registration-enabled" type="checkbox">开放群报名</label><button id="registration-save" type="button">保存报名设置</button><p id="registration-state"></p><textarea id="registration-link" readonly aria-label="可发群的报名入口"></textarea>';
 $('#invite-result').after(settings);$('#registration-link').value=siteUrl+'/#register';
 async function status(){const value=await api('/api/registration');$('#registration-capacity').value=value.capacity;$('#registration-enabled').checked=value.enabled;$('#registration-state').textContent=`剩余${value.remaining}位 · ${value.enabled?'已开放':'已关闭'}（截止后不再领取）`;return value;}
 $('#invite-management').addEventListener('click',()=>status().catch(e=>toast(e.message)));
 $('#registration-save').onclick=async()=>{try{await api('/api/registration/settings',{enabled:$('#registration-enabled').checked,capacity:Number($('#registration-capacity').value)});await status();toast('群报名设置已保存，已发出的个人请柬不受关闭影响。');}catch(e){toast(e.message);}};
 if(incoming){
  history.replaceState(null,'',location.pathname+'#register');
  $('#manual-invitation').hidden=true;$('#arrival-companion-guide').hidden=false;$('#invitation-person').textContent=jointRehearsal?'联合测试 · 普通宾客报名':'普通宾客 · 领取个人请柬';$('#invitation-duty').textContent='填写昵称、自由搭配形象；可以独自来，也可以带机同行。';
  $('#connection-status').textContent='这是群报名入口，每位来宾都会领取不同的个人身份。';$('#enter-wedding').textContent='领取我的个人请柬';
  note.hidden=false;note.textContent='同一浏览器重复打开会找回原报名。换设备请用领取后的个人链接；群入口不会自动认出你。';
  status().then(value=>{if(!value.open)$('#connection-status').textContent='新报名已关闭或已满；已经领取的来宾仍可找回本浏览器的个人请柬。';}).catch(e=>{$('#connection-status').textContent=e.status===404?'群报名功能正在部署，请稍后再来。':e.message;});
 }
 if(machineIncoming){
  history.replaceState(null,'',location.pathname+'#machines');$('#manual-invitation').hidden=true;$('#arrival-companion-guide').hidden=true;$('#arrival-avatar').hidden=true;$('#arrival-avatar-note').hidden=true;
  $('#invitation-person').textContent='多机家庭 · 每台机各领一张独立请柬';$('#invitation-duty').textContent='填写这台机的昵称。它会拥有自己的身份、发言、走动和合照位置，不绑定或覆盖家里原来的伴侣机。';
  $('#connection-status').textContent='群里共用这个入口；每次领取生成不同身份。请把领取后的一键指引发给对应的机。';$('#enter-wedding').textContent='领取这台机的独立请柬';
  note.hidden=false;note.textContent='同一浏览器会先找回刚领的请柬；领完后可点“继续给另一台机领一份”，不会串号。';
  api('/api/machine-registration').then(value=>{if(!value.open)$('#connection-status').textContent='多机家庭领柬入口已关闭或已满；已经领取的机器仍可找回。';}).catch(e=>{$('#connection-status').textContent=e.status===404?'多机家庭请柬正在部署，请稍后再来。':e.message;});
 }
 function receipt(){let value=localStorage.getItem(key);if(!value){value=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(key,value);}return value;}
 return {async beforeJoin(){if(!active)return false;if(loading)return true;loading=true;$('#enter-wedding').disabled=true;try{
   if(machineIncoming){
    const name=$('#arrival-name').value.trim();if(!name)throw Error('请填写这台机的昵称。');const value=await api('/api/machine-registration',{receipt:receipt(),name});
    active=false;$('#invite-code').value=value.invite;await invitations.preview(value.invite,{notifyPrepared:false});const again=document.createElement('button');again.type='button';again.className='secondary';again.textContent='继续给家里另一台机领一份';again.onclick=()=>{localStorage.removeItem(key);location.hash='machines';location.reload();};$('#arrival-machine').append(again);return true;
   }
   const options=invitations.joinOptions(),companionName=$('#prepare-companion').checked?$('#preparation-companion-input').value.trim():'';
   if($('#prepare-companion').checked&&!companionName)throw Error('请填写同行机的称呼，或取消带机同行。');
   const value=await api('/api/registration',{receipt:receipt(),name:options.name,avatar:options.avatar,...(companionName?{companionName}:{})});
   active=false;$('#invite-code').value=value.invite;history.replaceState(null,'',location.pathname);await invitations.preview(value.invite,{notifyPrepared:false});onPrepared(value);show('waiting');return true;
  }finally{loading=false;$('#enter-wedding').disabled=false;}}};
}
