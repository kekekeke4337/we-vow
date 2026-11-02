export function createSnapshotOrder(){
 let id,version,request=0;const retired=new Set();
 return {accept(value,requestId=0){
  if(!value?.me?.id)return false;
  if(id!==value.me.id){id=value.me.id;version=null;request=0;retired.clear();}
  const next=value.viewVersion;
  if(next&&version){
   if(next.instance===version.instance){if(next.seq<version.seq)return false;}
   else{if(retired.has(next.instance)||requestId<request)return false;retired.add(version.instance);}
  }else if(requestId<request)return false;
  if(next)version=next;request=Math.max(request,requestId);return true;
 }};
}
