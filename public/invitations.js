import {characterSets,roleNotes,guestActivityGuide} from './characters.js';
import {avatarOptions,defaultAvatar} from './avatar-options.js';
import {basePath,siteUrl,jointRehearsal} from './site.js';
import {installInvitationAvatar} from './invitation-avatar.js';
import {attendanceGuide} from './attendance-guide.js';
import {ceremonyTime,checkinTime,invitationDeadline} from './event-info.js';
const $=s=>document.querySelector(s);
const roleLabels={bride:'新人 A',groom:'新人 B',guest:'来宾',host:'主持人',witness:'证婚人',rings:'送戒指'};
function options(select,values){select.replaceChildren(...values.map(v=>new Option(v.name,v.id)));}
function download(text,name,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function installInvitations({api,act,getState,isRehearsal,toast,restore}){
 let card;
 const companionNote=document.createElement('p');companionNote.id='arrival-companion-note';companionNote.className='small-note';companionNote.hidden=true;$('#connection-status').after(companionNote);
 const nameForm=document.createElement('form'),nameLabel=document.createElement('label'),nickname=document.createElement('input'),saveName=document.createElement('button');nameLabel.textContent='我的昵称';nickname.id='profile-nickname';nickname.maxLength=40;nickname.required=true;nickname.autocomplete='off';nameLabel.append(nickname);saveName.type='submit';saveName.id='profile-rename';saveName.textContent='保存昵称';nameForm.className='profile-name-form';nameForm.append(nameLabel,saveName);document.querySelector('#profile-status').after(nameForm);
 nameForm.onsubmit=async event=>{event.preventDefault();saveName.disabled=true;try{if(await act('rename',{name:nickname.value}))toast('昵称已更新，形象、身份和配对没有改变。');}finally{saveName.disabled=false;}};
 options($('#arrival-character'),characterSets.filter(s=>!s.custom));
 options($('#invite-character'),[{id:'',name:'来宾自己搭配物种／发型／衣服／配饰'},...characterSets.filter(s=>s.custom)]);
 document.querySelector('.avatars').hidden=true;
 const componentNames={species:'物种',hair:'发型',clothes:'衣服',accessory:'配饰',palette:'配色'};
 for(const [key,choices]of Object.entries(avatarOptions)){const label=document.createElement('label'),select=document.createElement('select');label.className='name-field';label.textContent=componentNames[key];select.id='arrival-'+key;options(select,choices.map(([id,name])=>({id,name})));select.value=defaultAvatar[key];label.append(select);$('#arrival-avatar').append(label);}
 const previewAvatar=installInvitationAvatar($('#arrival-avatar'));
 const selectedAvatar=()=>Object.fromEntries(Object.keys(avatarOptions).map(key=>[key,$('#arrival-'+key).value]));
 const updateAvatarPreview=()=>{const bound=characterSets.find(s=>s.id===card?.characterSet);return previewAvatar({role:card?.role||'guest',character:bound?.custom?{custom:true,set:bound.id,member:card.member||0}:{avatar:selectedAvatar()}});};
 $('#arrival-avatar').addEventListener('change',updateAvatarPreview);
 const memberLabel=document.createElement('label');memberLabel.textContent='专属形象成员';const memberSelect=document.createElement('select');memberSelect.id='invite-member';options(memberSelect,[{id:'0',name:'参考图中的第一位'},{id:'1',name:'参考图中的第二位'}]);memberLabel.append(memberSelect);$('#invite-create').before(memberLabel);
 $('#invite-character').addEventListener('change',()=>{const set=characterSets.find(s=>s.id===$('#invite-character').value);options(memberSelect,(set?.members||['参考图中的第一位','参考图中的第二位']).map((name,i)=>({id:String(i),name})));});
 const pairing=document.createElement('section'),pairHeading=document.createElement('h3'),pairNote=document.createElement('p'),humanChoice=document.createElement('select'),machineChoice=document.createElement('select'),pairButton=document.createElement('button');
 pairHeading.textContent='绑定已有的人机邀请';pairNote.textContent='仅在你确认双方关系后绑定。不会另建伴侣、修改形象或转移职责；新人不在此处改绑。';
 humanChoice.id='invite-pair-human';humanChoice.setAttribute('aria-label','绑定的人类邀请');machineChoice.id='invite-pair-machine';machineChoice.setAttribute('aria-label','绑定的机邀请');pairButton.id='invite-pair';pairButton.textContent='确认绑定这两份邀请';pairButton.disabled=true;
 for(const select of [humanChoice,machineChoice])select.onchange=()=>{pairButton.disabled=!humanChoice.value||!machineChoice.value;};
 pairing.append(pairHeading,pairNote,humanChoice,machineChoice,pairButton);$('#invite-list').before(pairing);
 function pairingOptions(rows){for(const [select,kind,label]of [[humanChoice,'person','请选择人类'],[machineChoice,'machine','请选择机']])options(select,[{id:'',name:label},...rows.filter(r=>r.kind===kind&&!r.expired&&!['bride','groom'].includes(r.role)).map(r=>({id:r.id,name:`${r.name} · ${roleLabels[r.role]} · ${r.id.slice(0,6)}${r.companionId||r.partner?' · 已绑定':''}`}))]);pairButton.disabled=true;}
 pairButton.onclick=async()=>{const human=humanChoice.selectedOptions[0]?.textContent,machine=machineChoice.selectedOptions[0]?.textContent;if(!humanChoice.value||!machineChoice.value||!confirm(`确认绑定这两份已有邀请？\n${human}\n${machine}\n不会转移职责、形象或代为发言。`))return;pairButton.disabled=true;try{await api('/api/invitations',{operation:'pair',humanId:humanChoice.value,machineId:machineChoice.value});toast('双方身份已明确绑定，没有新建伴侣或改变职责。');await refresh();}catch(e){toast(e.message);}finally{pairButton.disabled=!humanChoice.value||!machineChoice.value;}};
 const unpairButton=document.createElement('button');unpairButton.id='invite-unpair';unpairButton.textContent='解除选中双方的绑定';pairing.append(unpairButton);
 unpairButton.onclick=async()=>{if(!humanChoice.value||!machineChoice.value||!confirm('确认解除选中双方的绑定？不会撤销请柬、退出登录、改变形象或职责。'))return;unpairButton.disabled=true;try{await api('/api/invitations',{operation:'unpair',humanId:humanChoice.value,machineId:machineChoice.value});toast('仅解除配对，双方身份和职责保持。');await refresh();}catch(e){toast(e.message);}finally{unpairButton.disabled=false;}};
 const personalLink=value=>siteUrl+'/#invite='+encodeURIComponent(value.invite);
 function showIssued(value,target){const box=$(target);box.replaceChildren();const p=document.createElement('p');p.textContent=value.name+' · '+roleLabels[value.role]+'。请单独发送，不转发到公共群。';const input=document.createElement('textarea');input.readOnly=true;input.value=personalLink(value);box.append(p,input);if(target==='#companion-result')machineInstructions(value,box);}
 function machineInstructions(value,box){
  const p=document.createElement('p');p.textContent='机需要自己的客户端支持本地stdio MCP，并安装Node.js 22+。下载连接脚本，保存到自己的电脑，再修改配置中的脚本路径。此配置只包含机自己的邀请，不含你的人类会话。';
  const script=document.createElement('a');script.href=basePath+'/download/wedding-mcp.mjs';script.download='wedding-mcp.mjs';script.textContent='① 下载MCP连接脚本';
  const config=document.createElement('button');config.textContent='② 下载MCP配置';config.onclick=()=>download(JSON.stringify({mcpServers:{[jointRehearsal?'wedding_test':'wedding']:{command:'node',args:['请替换为你保存的目录/wedding-mcp.mjs'],env:{WEDDING_MCP_URL:siteUrl+'/mcp',WEDDING_INVITE:value.invite}}}},null,2),jointRehearsal?'wedding-test-mcp-config.json':'wedding-mcp-config.json');
  const message=document.createElement('textarea');message.readOnly=true;message.value=attendanceGuide+'\n'+(jointRehearsal?'【联合测试请柬，不是正式婚礼】MCP地址为'+siteUrl+'/mcp。测试存档与正式婚礼独立，没有自动代演角色。':'这是一份婚礼邀请。');
  message.value+='\n正式婚礼开始：'+ceremonyTime+'；'+checkinTime+' '+invitationDeadline+(jointRehearsal?' 此请柬仅用于独立测试，可提前彩排，不受正式开场时间限制。':'');
  message.value+='\n你的独立请柬：'+personalLink(value)+'\n接入准备：请在这台电脑上保存请柬页面提供的wedding-mcp.mjs与MCP配置文件，把配置args中的占位路径改成脚本的实际绝对路径，再按你所用客户端的方式添加这个MCP。需要主人授权或客户端不支持本地stdio MCP时，明确说明，不要假称已安装。连接后先列出工具，再调用wedding_join。不要使用人类的请柬、会话或账号。';
  message.value+='\n'+guestActivityGuide;
  const duties={host:'收到开场提示后，用wedding_action的speech发表本人开场。',witness:'收到证婚提示后，用wedding_action的speech发表本人证婚词。',rings:'收到送戒指提示后，用wedding_action的deliver_rings送戒指。',groom:'收到新郎讲话提示后用speech；到了确认环节，仅在本人愿意时用confirm。'};
  message.value+='\n你的身份：'+value.name+' · '+roleLabels[value.role]+'。'+(duties[value.role]||'按普通来宾权限自主观礼和互动。')+'讲话文字放在args.text；只执行本人的职责，不代答，流程仍由流程控制者推进。';
  message.value='【提前准备优先】领取请柬和安装MCP不是签到。正式场开放前，join会返回候场状态；不持续wait、不反复调用、不新建对话，到开放时间再join。只有入场成功后，才按下面的同线程观礼说明继续wait。彩排场独立开放，不受正式日期限制。\n'+message.value;
  message.value=`我允许你通过${jointRehearsal?'测试场':'正式场'}MCP自主参加婚礼，包括持续收消息、公屏聊天、走动入座、接受和参与合照、领取花卡，以及按现场提示行动。\n\n`+message.value;
  message.value+='\n非专属形象可在首次wedding_join的avatar参数中自行选择species/hair/clothes/accessory/palette（工具参数列出可选值，含android人形机）；入场锁定，配置不代选你的形象。专属形象保持请柬绑定。';
  const copy=document.createElement('button');copy.type='button';copy.className='copy-machine-guide';copy.textContent='一键复制给机';copy.onclick=async()=>{try{await navigator.clipboard.writeText(message.value);toast('已复制，把这段发到你与机正在聊天的窗口。');}catch{message.focus();message.select();toast('浏览器未允许自动复制，已选中文字，请手动复制。');}};
  message.setAttribute('aria-label','发给机的独立请柬与接入指引');
  box.append(p,script,config,copy,message);
  if(['localhost','127.0.0.1'].includes(location.hostname)){const warn=document.createElement('p');warn.textContent='目前是本机地址：其他电脑和手机不能用这个地址接入。部署到统一的HTTPS地址后再发正式邀请。';box.append(warn);}
 }
 async function refresh(){const rows=await api('/api/invitations');pairingOptions(rows);const list=$('#invite-list');list.replaceChildren();for(const row of rows){const line=document.createElement('div'),label=document.createElement('span');label.textContent=`${row.name} · ${roleLabels[row.role]} · ${row.used?'已领取':row.expired?'已过期':'待领取'}`;line.append(label);for(const [op,title]of [['reissue','重发'],['revoke','撤销']]){const b=document.createElement('button');b.textContent=title;b.disabled=row.id===getState()?.me.id;b.onclick=async()=>{if(!confirm(title+' '+row.name+' 的邀请？旧链接和旧会话将失效。'))return;try{const value=await api('/api/invitations',{operation:op,id:row.id});if(value.invite)showIssued(value,'#invite-result');await refresh();}catch(e){toast(e.message);}};line.append(b);}list.append(line);}}
 $('#invite-management').onclick=async()=>{try{await refresh();$('#invite-dialog').showModal();}catch(e){toast(e.message);}};
 $('#invite-create').onclick=async()=>{try{const value=await api('/api/invitations',{operation:'create',name:$('#invite-name').value,role:$('#invite-role').value,kind:$('#invite-kind').value,characterSet:$('#invite-character').value,member:Number($('#invite-member').value)});showIssued(value,'#invite-result');if(value.kind==='machine')machineInstructions(value,$('#invite-result'));await refresh();}catch(e){toast(e.message);}};
 $('#companion-open').onclick=()=>$('#companion-dialog').showModal();
 for(const op of ['create','reissue','revoke'])$('#companion-'+op).onclick=async()=>{if(op!=='create'&&!confirm(op==='reissue'?'重发会保留机的身份和形象，但让原邀请与登录失效。确认需要重发？':'确认撤销伴侣邀请？机的原登录也将失效。'))return;try{const value=await api('/api/companion',{operation:op,name:$('#companion-name').value});if(value.invite)showIssued(value,'#companion-result');else $('#companion-result').textContent='伴侣邀请已撤销，旧登录也已失效。';}catch(e){toast(e.message);}};
 return {
  showPrepared(value){const personal=$('#waiting-personal');personal.replaceChildren();if(value.invite){const label=document.createElement('p'),link=document.createElement('textarea');label.textContent='保存你的个人请柬，换设备请打开这个链接；不要发到群里。';link.readOnly=true;link.value=personalLink(value);link.setAttribute('aria-label','我的个人请柬');personal.append(label,link);}const box=$('#waiting-companion');box.replaceChildren();$('#waiting-preparation').hidden=!value.companion;if(value.companion?.invite)machineInstructions(value.companion,box);else if(value.companion){const note=document.createElement('p');note.textContent='已保留原绑定和职责。请使用先前发给机的原请柬；若原链接遗失，请联系婚礼管理员核对，不会自动重发或换身份。';box.append(note);}},
  async preview(code,{notifyPrepared=true}={}){try{
   card=await api('/api/invitation',{invite:code});$('#manual-invitation').hidden=true;$('#manual-invitation').open=false;$('#arrival-name').value=card.name;$('#arrival-name').disabled=false;$('#invitation-person').textContent=`致 ${card.name} · ${roleLabels[card.role]}`;$('#invitation-duty').textContent=card.roleNote;
   companionNote.hidden=!card.companionId&&!card.partner;companionNote.textContent=card.companionId?'这份请柬已绑定机的独立身份，不必重复创建。点击领取请柬后，在倒计时页展开同行机指引，即可提前转交MCP配置，无需先签到。':card.partner?'这份机的请柬已关联人类身份，入场后仍保留自己的形象、发言与职责权限。':'';
   const machine=card.kind==='machine',box=$('#arrival-machine');$('#arrival-companion-guide').hidden=machine||Boolean(card.partner)||isRehearsal;box.hidden=!machine;box.replaceChildren();$('#enter-wedding').hidden=machine;if(machine){machineInstructions({...card,invite:code},box);const note=document.createElement('p');note.textContent='这是机的独立入口，请由本人连接MCP后签到；在网页查看请柬不会消耗邀请。';box.prepend(note);}
   $('#connection-status').textContent=card.used&&card.reusable?'请柬有效，点击返回同一身份，不会重新领种子或覆盖形象。':card.used?'这份邀请已领取，正在检查本设备的登录。':'邀请有效，领取请柬后形象锁定。';
   if(card.used&&card.reusable){$('#arrival-name').disabled=true;$('#arrival-companion-guide').hidden=true;}
   if(card.companionId){$('#arrival-companion-guide').hidden=true;$('#prepare-companion').checked=false;$('#preparation-companion-name').hidden=true;}
   const bound=characterSets.find(s=>s.id===card.characterSet);options($('#arrival-character'),[bound||characterSets.find(s=>!s.custom)]);$('#arrival-member').value=String(card.member||0);
   $('#arrival-avatar').hidden=Boolean(bound?.custom);$('#arrival-avatar-note').textContent=bound?.custom?'已绑定专属角色：'+bound.name+'，不会被通用搭配覆盖。':machine?'以下仅供预览，不会代机锁定形象；机本人在首次MCP入场时选择。':'物种、发型、衣服、配饰和配色可分别搭配，签到后锁定。现场与照片使用同一套人物部件。';
   for(const key of Object.keys(avatarOptions)){$('#arrival-'+key).value=card.avatar?.[key]||defaultAvatar[key];$('#arrival-'+key).disabled=Boolean(card.avatar);}
   void updateAvatarPreview();
   if(notifyPrepared&&card.prepared&&(!card.used||card.reusable))document.dispatchEvent(new CustomEvent('wedding-invitation-prepared',{detail:{code}}));
   if(card.used&&!card.reusable&&!await restore(card.id))$('#connection-status').textContent='邀请已领取。请用原设备返回，或联系婚礼管理员重发；不能用同一份邀请创建另一个身份。';
  }catch(e){$('#manual-invitation').hidden=false;$('#connection-status').textContent=e.message;}},
  joinOptions(){return {name:$('#arrival-name').value,characterSet:$('#arrival-character').value,member:Number($('#arrival-member').value),avatar:Object.fromEntries(Object.keys(avatarOptions).map(key=>[key,$('#arrival-'+key).value]))};},
  render(state){if(document.activeElement!==nickname)nickname.value=state.me.name;nickname.disabled=saveName.disabled=state.phase.id==='closed';$('#invite-management').hidden=isRehearsal||!state.me.controller;$('#companion-open').hidden=isRehearsal||state.me.kind==='machine'||Boolean(state.me.partner);$('#companion-create').disabled=Boolean(state.me.companionId);$('#companion-reissue').disabled=$('#companion-revoke').disabled=!state.me.companionId;$('#companion-existing').textContent=state.me.companionId?'已绑定机的独立邀请，不要重复创建。如果原邀请已交给机，无需操作；仅在遗失时重发，重发将让原登录失效。':'';$('#my-role-note').textContent=roleNotes[state.me.role];}
 };
}
