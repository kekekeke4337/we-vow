import {rehearsalProfiles} from '../public/rehearsal-profiles.js';

// Shared approved test cast. Explicit IDs and reciprocal links, never nickname inference.
export function seedRehearsalCast(wedding,{selectedId,simulated=false}={}){
 const guestId=p=>'rehearsal-profile-'+p.id;
 return rehearsalProfiles.map(p=>{
  const mate=p.pair?rehearsalProfiles.find(q=>q.pair===p.pair&&q.member!==p.member):null;
  const name=!simulated?p.name:p.name+(p.id===selectedId?'（演练）':'（模拟）');
  const invite=wedding.invite(name,p.role,null,p.kind==='machine'&&mate?guestId(mate):null,{
   replaceId:guestId(p),kind:p.kind,...(p.characterSet&&p.characterSet!=='couple'?{characterSet:p.characterSet,member:p.member}:{}),
   ...(p.kind==='person'&&mate?{companionId:guestId(mate)}:{})
  });
  return {profile:p,invite};
 });
}
