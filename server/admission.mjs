import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export function createAdmission({directory,enabled=false,clock=Date.now}){
 return async()=>{
  if(!enabled)return {enabled:false,open:true};
  let value={};try{value=JSON.parse(await readFile(resolve(directory,'schedule.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')return {enabled:true,open:false,opensAt:null,status:'schedule_error',message:'日期配置待核对，现场尚未开放。'};}
  const timestamp=typeof value.opensAt==='string'&&/([Zz]|[+-]\d\d:\d\d)$/.test(value.opensAt)?Date.parse(value.opensAt):NaN;
  const opensAt=Number.isFinite(timestamp)?new Date(timestamp).toISOString():null;
  const open=opensAt!==null&&clock()>=timestamp;
  return {enabled:true,open,opensAt,serverTime:clock(),status:open?'open':opensAt?'countdown':'date_pending',message:open?'婚礼已开放，可以签到入场。':opensAt?'请柬已准备好，婚礼开放前请等待倒计时。':'婚礼日期尚未公布，请柬可先准备；现场尚未开放。',nextAction:open?'wedding_join':'return_at_opening',keepWaiting:false};
 };
}
