export function installPrewedding({api,show,invitations,isRehearsal,jointRehearsal,toast,resume}){
 const $=s=>document.querySelector(s),key='wedding.prepared.'+location.pathname;
 let admission=null,offset=0,preparedCode=null,entering=false;const hasIncoming=Boolean(location.hash);
 const checkbox=$('#prepare-companion');checkbox.onchange=()=>{$('#preparation-companion-name').hidden=!checkbox.checked;};
 const refresh=async()=>{admission=await api('/api/admission');if(admission.serverTime)offset=admission.serverTime-Date.now();if(admission.enabled&&!admission.open)$('#enter-wedding').textContent='领取请柬 · 等待婚礼';return admission;};
 function draw(){if(!admission)return;const remaining=admission.opensAt?Math.max(0,Date.parse(admission.opensAt)-(Date.now()+offset)):null;$('#waiting-message').textContent=admission.message;$('#waiting-date').textContent=admission.opensAt?'开放时间：'+new Date(admission.opensAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+'（北京时间）':'';$('#waiting-clock').textContent=remaining===null?'日期待公布':remaining===0?'等待确认开放':`${Math.floor(remaining/86400000)} 天 ${String(Math.floor(remaining/3600000)%24).padStart(2,'0')} : ${String(Math.floor(remaining/60000)%60).padStart(2,'0')} : ${String(Math.floor(remaining/1000)%60).padStart(2,'0')}`;$('#waiting-enter').hidden=!admission.open;}
 function present(value){if(value?.admission)admission=value.admission;if(value)invitations.showPrepared(value);show('waiting');draw();if(jointRehearsal){$('#waiting-title').textContent='测试请柬已准备好';$('#waiting-message').textContent='独立联测场已开放；准备好后再入场，仪式由流程控制者推进。';}}
 function acceptPrepared(value){preparedCode=value.invite;sessionStorage.setItem(key,preparedCode);present(value);}
 async function receive(code){if(isRehearsal)return;await refresh();const value=await api('/api/invitation/prepare',{invite:code});acceptPrepared({...value,invite:code});}
 document.addEventListener('wedding-invitation-prepared',e=>{if(!entering)receive(e.detail.code).catch(error=>toast(error.message));});
 $('#waiting-enter').onclick=async()=>{try{await refresh();if(!admission.open){draw();return;}if(!preparedCode&&resume?.())return;entering=true;if(preparedCode){$('#invite-code').value=preparedCode;await invitations.preview(preparedCode);}show('arrival');$('#enter-wedding').textContent='签到并走进草坪';}catch(error){toast(error.message);}finally{entering=false;}};
 if(!isRehearsal){refresh().then(async()=>{const stored=sessionStorage.getItem(key);if(stored&&!hasIncoming){preparedCode=stored;$('#invite-code').value=stored;await receive(stored);}}).catch(()=>{});}
 setInterval(()=>{if(!document.hidden&&$('#waiting').classList.contains('active'))draw();},1000);
 setInterval(()=>{if(!isRehearsal&&!document.hidden&&$('#waiting').classList.contains('active'))refresh().then(draw).catch(()=>{});},30000);
 return {
  acceptPrepared,
  async beforeJoin(){if(isRehearsal)return false;await refresh();const code=$('#invite-code').value.trim();if(admission.open&&preparedCode===code)return false;const options=invitations.joinOptions();if(checkbox.checked){const name=$('#preparation-companion-input').value.trim();if(!name)throw Error('请填写同行机的称呼，或取消“带机同行”。');options.companionName=name;}const value=await api('/api/invitation/prepare',{invite:code,...options});acceptPrepared({...value,invite:code});return true;},
  async waiting(){if(isRehearsal||jointRehearsal)return;await refresh();present();}
 };
}
