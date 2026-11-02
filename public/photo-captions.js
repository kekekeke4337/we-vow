export const groupCaptionVersion='compact-roster-v1';
const graphemes=text=>typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(String(text))].map(s=>s.segment):Array.from(String(text));
export function wrapPhotoName(name,width,measure){
 if(!Number.isFinite(width)||width<=0||typeof measure!=='function')throw Error('姓名排版参数无效');
 const lines=[];let line='';
 for(const part of graphemes(name)){const next=line+part;if(line&&measure(next)>width){lines.push(line);line=part;}else line=next;}
 lines.push(line);return lines;
}
// Caption slots fit the existing T coordinates. Long names are not elided or
// squashed into a portrait; a numbered full-size roster extends only the frame.
export function planGroupCaptions(guests,{measureMarker,measureRoster}){
 const entries=guests.map((g,i)=>{const lines=wrapPhotoName(g.name,44,measureMarker),compact=lines.length<=2&&lines.every(line=>measureMarker(line)<=44);return {id:g.id,name:g.name,number:String(i+1).padStart(2,'0'),compact,markerLines:compact?lines:['#'+String(i+1).padStart(2,'0')],rosterLines:wrapPhotoName(g.name,298,measureRoster)};});
 const hasRoster=entries.some(e=>!e.compact);let top=1354;
 if(hasRoster)for(let i=0;i<entries.length;i+=4){const row=entries.slice(i,i+4),height=22+Math.max(...row.map(e=>e.rosterLines.length))*20;row.forEach((e,col)=>e.roster={x:80+col*360,y:top,width:348,height});top+=height+8;}
 return {version:groupCaptionVersion,entries,hasRoster,height:hasRoster?top+44:1320,imageHeight:77,imageY:-75.25};
}
