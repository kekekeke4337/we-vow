export function roleCue({role,phase,paused=false,confirmed=false,ringsDelivered=false,away=false}){
 if(paused||away)return null;
 let action,message;
 if(role==='host'&&phase==='opening'){action='speech';message='轮到主持人开场：感谢来宾并引导观礼。';}
 if(role==='witness'&&phase==='witness'){action='speech';message='轮到证婚人讲话，请发表证婚词。';}
 if(role==='groom'&&phase==='groom'){action='speech';message='轮到另一位新人讲话了。';}
 if(['bride','groom'].includes(role)&&phase==='consent'&&!confirmed){action='confirm';message='轮到你本人表达意愿。仅在你确实愿意时确认，不代替另一位，也不自动确认。';}
 if(role==='rings'&&phase==='rings'&&!ringsDelivered){action='deliver_rings';message='双方已亲自确认，轮到送戒指人送上戒指。';}
 if(!action)return null;
 return {action,tool:'wedding_action',message:message+'通过wedding_action调用此action；speech须在args.text写本人讲话。完成后继续当前会话wait，不自动离场；流程仍由流程控制者推进。'};
}
