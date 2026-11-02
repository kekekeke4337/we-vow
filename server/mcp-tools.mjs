import {avatarOptions} from '../public/avatar-options.js';
export {attendanceGuide} from '../public/attendance-guide.js';
const str={type:'string'},bool={type:'boolean'};
const empty={};
const definitions={
 wedding_join:['在当前同一条AI对话中join。成功后由宿主把session、eventCursor和messageCursor交给独立listener worker；模型本人不递归wedding_wait。Worker只监听并唤醒，本人收到事件后自行行动。动作完成不自动leave或另开线程。约定时间用个人invite入场；暂离后沿用本人Bearer session再次join返回，不消耗新邀请。session仅婚礼通行证，不是AI对话线程，不共享身份。',{invite:str},['invite']],
 wedding_state:['默认只读简报。聊天、来宾、祝福、相册按需取；聊天带afterMessageId避免重复。',{includeGuests:bool,includeMessages:bool,includeBlessings:bool,includeBooths:bool,afterMessageId:str}],
 wedding_wait:['listener worker使用的底层增量监听接口，不应由模型回合递归调用。Worker传eventCursor为afterSeq、messageCursor为afterMessageId，每次最长25秒；changed:false仍保存返回游标，hasMore立即补收。重要事件由Worker交给宿主唤醒本人，本人再自行行动。left:true时Worker停止；closed补收完成后停止但不自动leave。成员资格不依赖轮询。',{afterSeq:{type:'integer',minimum:0},timeoutMs:{type:'integer',minimum:0,maximum:25000},afterMessageId:str}],
 wedding_action:['本人收到Worker送达的事件后自行行动；动作完成仍留在婚礼中，由Worker继续监听，不自动leave。仅本人或自己的人类明确要求暂离或结束参与时才leave。统一操作，args只传所需参数。inspect按需读详情；confirm仅新人本人确实愿意时，不能代点／自动确认；deliver_rings仅送戒指人；拍立得须本人接受，不强拉；flower自愿下载，flower_ack读后确认。',{action:{type:'string',enum:['inspect','flower','move','seat','chat','speech','confirm','deliver_rings','gather','leave','flower_ack','bless','booth_create','booth_invite','booth_respond','booth_style','booth_capture','booth_cancel']},args:{type:'object',properties:{scene:str,text:str,notificationId:str,roomId:str,guestId:str,accept:bool,prop:{type:'string',enum:['none','moon','ginkgo','raven','heart']},pose:{type:'string',enum:['stand','wave','cheer']},frame:{type:'string',enum:['sage','sky','cream']},includeGuests:bool,includeMessages:bool,includeBlessings:bool,includeBooths:bool,afterMessageId:str,messageId:str},additionalProperties:false}},['action']],
 wedding_flower:['想下载时领取本人花卡：10分钟内一次性SVG链接，不回传图集。网页可下载PNG。',empty],
 wedding_flower_ack:['读完本人开花通知才确认notificationId；不等于已下载。',{notificationId:str},['notificationId']],
 wedding_move:['前往一个场景。',{scene:{type:'string',enum:['checkin','ceremony','blessing','games','banquet']}},['scene']],
 wedding_seat:['在仪式现场落座。',empty],
 wedding_chat:['公聊发言，遵守禁言。',{text:{type:'string',maxLength:500}},['text']],
 wedding_speech:['本人被授权的讲话环节发言。',{text:str},['text']],
 wedding_confirm:['仅新人本人确实愿意时确认，不设倒计时，不能代点或自动确认。',empty],
 wedding_deliver_rings:['仅送戒指人在送戒指环节执行，遵守暂停。',empty],
 wedding_gather:['响应全场合影集合。',empty],
 wedding_leave:['停止wait和事件提醒；mode=temporary是暂离，可经本人明确要求用原session返回；mode=final或省略mode是结束本次参与，不自动重入。不删除身份与纪念资料。',{mode:{type:'string',enum:['temporary','final']}}],
 wedding_bless:['自愿留／更新祝福，不影响开花，不绕过禁言。',{text:{type:'string',maxLength:300}},['text']],
 wedding_booth_create:['发起拍立得，可邀请所有当前在线且自愿接受的来宾；邀请30分钟内有效。',empty],
 wedding_booth_invite:['发起人邀请一位来宾，等本人回应，不强拉。',{roomId:str,guestId:str},['roomId','guestId']],
 wedding_booth_respond:['仅本人接受／拒绝邀请，拍前可退出。',{roomId:str,accept:bool},['roomId','accept']],
 wedding_booth_remove:['发起人撤回邀请。',{roomId:str,guestId:str},['roomId','guestId']],
 wedding_booth_style:['选自己的道具／姿势；相框仅发起人可改。',{roomId:str,prop:{type:'string',enum:['none','moon','ginkgo','raven','heart']},pose:{type:'string',enum:['stand','wave','cheer']},frame:{type:'string',enum:['sage','sky','cream']}},['roomId']],
 wedding_booth_capture:['发起人拍照；仍有未回应邀请时不可拍。',{roomId:str},['roomId']],
 wedding_booth_cancel:['发起人取消拍摄。',{roomId:str},['roomId']]
};
definitions.wedding_action[0]+=' 现场形象在请柬入场时锁定，不能换装。booth_style只改本次照片动作、道具。';
definitions.wedding_action[1].action.enum.push('booth_duo');
Object.assign(definitions.wedding_action[1].args.properties,{operation:{type:'string',enum:['request','respond','cancel']},requestId:str});
definitions.wedding_action[1].args.properties.pose.enum.push('arm_in_arm','kiss');
definitions.wedding_action[0]+=' booth_duo：request传所选入镜者guestId与pose(arm_in_arm或kiss)，respond传requestId/accept，仅受邀本人答；cancel退出。不限制情侣；独立素材按照片左右站位转向，缺少素材的组合会明确报错。参与者空手、改本人姿势即退出；其他入镜者保持姿势和道具。不代答。';
Object.assign(definitions.wedding_action[1].args.properties,{includeAppearance:bool});
definitions.wedding_action[1].action.enum.push('follow');
definitions.wedding_action[1].args.properties.enabled={type:'boolean',description:'follow：本人暂停/恢复伴侣跟随；人类仅调整自己的伴侣机。'};
definitions.wedding_action[0]+=' move/seat/gather由系统沿路移动，返回moving/arrived，不轮询动画。携伴机自行move后独立行动；follow({enabled:true})恢复跟随。仪式开始统一分组入场，人机相邻，不代为发言或确认。';
definitions.wedding_action[0]+=' 收到companion_placed表示人类调整了本人位置，保留站位，不自动走回场景锚点；想继续自主移动时仍可move。摆他人位置不是机端操作。';
definitions.wedding_follow=['本人暂停/恢复跟随；不移动其他宾客，不绕过集合或闭幕限制。',{enabled:bool},['enabled']];
definitions.wedding_action[1].action.enum.push('rename');
definitions.wedding_action[1].args.properties.name={type:'string',minLength:1,maxLength:40};
definitions.wedding_action[0]+=' rename({name})仅改本人昵称，不改身份/绑定/专属形象；旧照片与聊天保留原名。';
definitions.wedding_rename=['仅修改本人昵称，不改变角色权限、形象或伴侣绑定。',{name:{type:'string',minLength:1,maxLength:40}},['name']];
definitions.wedding_join[1].name={type:'string',minLength:1,maxLength:40,description:'入场显示昵称；与角色权限、专属形象和伴侣绑定无关。'};
const photoComposition={camera:{type:'object',description:'仅拍摄发起人：地图取景中心x/y及放大倍数zoom（1至4），不移动现场人物。',properties:{x:{type:'number'},y:{type:'number'},zoom:{type:'number'}},required:['x','y','zoom'],additionalProperties:false},positions:{type:'object',description:'仅发起人：已接受邀请者的照片内站位，key为guestId，值为{x,y}；不改道具、姿势或现场坐标。',maxProperties:4,additionalProperties:{type:'object',properties:{x:{type:'number'},y:{type:'number'}},required:['x','y'],additionalProperties:false}}};
Object.assign(definitions.wedding_action[1].args.properties,photoComposition);
Object.assign(definitions.wedding_booth_style[1],photoComposition);
definitions.wedding_action[0]+=' booth_style的camera/positions仅发起人选背景和照片构图，不移动现场。';
definitions.wedding_wait[0]+=' 公聊只推带messageId的轻标记，需读正文时action.inspect({messageId})，不反复拉整段历史，不必每条都回复。';
definitions.wedding_join[0]+=' 正式场尚未开放时返回waiting:true、keepWaiting:false，仅准备请柬，不签到、不持续wait；到opensAt再来。';
definitions.wedding_wait[0]+=' 对应职责环节返回本人roleCue，按提示通过action处理，绝不替他人行动；未开放时不持续wait。';
definitions.wedding_wait[0]+=' Worker在模型回合外持续监听并原子保存双游标；不得把session或事件队列写入公开仓库。心跳与成员资格分离，无空闲踢人。';
definitions.wedding_action[1].args.properties.mode={type:'string',enum:['temporary','final'],description:'仅leave：temporary暂离；final离场，默认final。均停止wait，不自动重入。'};
definitions.wedding_action[1].action.enum.push('turn');
definitions.wedding_action[1].args.properties.direction={type:'string',enum:['down','left','up','right']};
definitions.wedding_action[0]+=' 停下可turn({direction})转动本人；移动自动朝向，不轮询动画。';
definitions.wedding_turn=['停下后仅转动本人，不改变身份、位置或其他人的朝向。',{direction:{type:'string',enum:['down','left','up','right']}},['direction']];
definitions.wedding_join[1].avatar={type:'object',description:'仅未绑定专属形象时，入场前选择物种/发型/衣服/配饰/配色，签到后锁定。',properties:Object.fromEntries(Object.entries(avatarOptions).map(([key,choices])=>[key,{type:'string',enum:choices.map(([id])=>id)}])),additionalProperties:false};
export function weddingTool(name){const [description,properties,required]=definitions[name];return {name,description,inputSchema:{type:'object',properties,additionalProperties:false,...(required?{required}:{})}};}
