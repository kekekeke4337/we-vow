// Keep the whole nickname visible without stretching it over neighbours.
// Grapheme boundaries preserve emoji, variation selectors and combining marks.
export function photoNameLines(name,columns=4){
 const text=String(name),parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(s=>s.segment):Array.from(text),lines=[];
 for(let i=0;i<parts.length;i+=columns)lines.push(parts.slice(i,i+columns).join(''));
 return lines.length?lines:[''];
}
