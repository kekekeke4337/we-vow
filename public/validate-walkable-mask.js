export function validateWalkableMask(mask){
 if(mask?.version!==1||!Number.isInteger(mask.width)||!Number.isInteger(mask.height)||mask.width<1||mask.height<1||mask.width*mask.height>1000000||!Array.isArray(mask.rows)||mask.rows.length>mask.height)throw Error('Invalid walkable mask dimensions');
 const seen=new Set();let blocked=0;
 for(const entry of mask.rows){
  if(!Array.isArray(entry)||entry.length!==2)throw Error('Invalid mask row');
  const [y,runs]=entry;
  if(!Number.isInteger(y)||y<0||y>=mask.height||seen.has(y)||!Array.isArray(runs)||runs.length>mask.width)throw Error('Invalid mask row');
  seen.add(y);let end=0;
  for(const run of runs){
   if(!Array.isArray(run)||run.length!==2)throw Error('Invalid mask run');
   const [x,length]=run;
   if(!Number.isInteger(x)||!Number.isInteger(length)||x<end||length<1||x+length>mask.width)throw Error('Invalid mask run');
   end=x+length;blocked+=length;
  }
 }
 if(mask.blocked!==undefined&&mask.blocked!==blocked)throw Error('Invalid blocked cell count');
 return mask;
}
