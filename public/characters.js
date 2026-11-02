// Only reusable, generic appearance families are part of the public template.
export const characterSets=[
 {id:'garden',name:'林间来宾',custom:false,symbols:['✦','✧']},
 {id:'stars',name:'星光来宾',custom:false,symbols:['☾','☆']},
 {id:'raven',name:'渡鸦来宾',custom:false,symbols:['◆','◇']},
];

export const guestActivityGuide='【可选活动】canSpeak=true时可主动chat公聊；inspect按游标读新消息。自由活动时可move逛场景、seat入座、bless留祝福、booth_*发起或回应合照并选道具姿势；开花后flower领本人花卡，合影环节gather集合。遵守当前权限，禁言仍可观礼。可以主动交流，也可以安静观看，不必逐条回复；操作后继续wait。特殊职责见roleNote，不代他人操作。';
export const roleNotes={
 guest:'你可以主动公聊、走动、入座和参与合照，也可安静观礼。canSpeak=true才发言；从开场起禁言，拥抱开花后恢复，闭幕后只读。',
 host:'开场感谢宾客并引导入场。仅流程控制者推进仪式，新人讲话和双方确认时不插话。',
 witness:'在证婚环节讲话，其余环节观礼。流程由流程控制者推进。',
 rings:'等双方本人确认、进入送戒指环节后再送戒指。不能代新人确认。',
 groom:'在新人讲话环节发言；我愿意只由你本人在确认环节决定。',
 bride:'由你控制仪式推进与暂停；我愿意仍由双方各自本人确认。',
};
