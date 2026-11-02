import {createHash} from 'node:crypto';
const revision=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20);
export function incrementalWebView(snapshot,params){
 const {messages,blessings,booths,guests,bloomGarden,...rest}=snapshot,cursor=params.get('afterMessageId'),index=messages.findIndex(m=>m.id===cursor),reset=!cursor||index<0;
 const blessingVersion=revision(blessings),boothVersion=revision(booths),gardenVersion=revision(bloomGarden??null);
 const gardenFields={gardenVersion,...(params.get('gardenVersion')!==gardenVersion?{bloomGarden:bloomGarden??null}:{})};
 return {...rest,...gardenFields,guests:guests.map(({id,name,role,seed,x,y,symbol,character,scene,seated,motion,facing,followPartner,partner,companionId,kind})=>({id,name,role,seed,x,y,symbol,character,scene,seated,kind,facing,partner,companionId,followPartner,...(motion&&motion.startedAt+motion.duration>snapshot.serverTime?{motion}:{})})),messagesDelta:reset?messages.slice(-100):messages.slice(index+1),messagesReset:reset,messageCursor:messages.at(-1)?.id||null,blessingVersion,boothVersion,...(params.get('blessingVersion')!==blessingVersion?{blessings}:{}),...(params.get('boothVersion')!==boothVersion?{booths}:{})};
}
