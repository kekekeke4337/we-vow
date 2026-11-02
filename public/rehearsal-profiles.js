import {roleNotes} from './characters.js';

const profile=(id,name,role,kind,set='garden',member=0,pair=null)=>({id,name,role,kind,pair,characterSet:set,member,character:{set,member,custom:false},artFile:null,roleNote:roleNotes[role]});
export const rehearsalProfiles=[
 profile('bride','伴侣 A','bride','person','garden',0,'newlyweds'),
 profile('groom','伴侣 B','groom','machine','garden',1,'newlyweds'),
 profile('host','主持 Agent','host','machine','stars',0),
 profile('witness','证婚人','witness','person','stars',1),
 profile('rings','送戒指 Agent','rings','machine','raven',0),
 profile('guest','测试来宾','guest','person','raven',1),
];
export const rehearsalVersion='rehearsal-generic-v1';
export const rehearsalMissingArt=[];
export function rehearsalProfile(id='bride'){
 const found=rehearsalProfiles.find(profile=>profile.id===id);
 if(!found)throw Object.assign(new Error('请选择已登记的彩排身份'),{status:400});
 return found;
}
