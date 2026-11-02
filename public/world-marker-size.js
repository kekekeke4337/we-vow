// Preserve the approved 1.75x walking size outside the calibrated T formation.
// Formation columns are .01 world widths apart and rows .055 world heights;
// their map markers must fit those slots, not borrow the free-walking scale.
export function worldMarkerSize(width,{photoReady=false,seatedGap}={}){
 if(!Number.isFinite(width)||width<=0)throw Error('地图宽度无效');
 const walking=Math.max(15,Math.min(36,width*.011))*1.96;
 // Leave one short nameplate between rows; the world is a 3:1 map.
 // A photo camera is independent of the map. Neither seating nor gathering
 // silently shrinks the people who remain on that map.
 // Ceremony seating changes positions, never the character's established size.
 // Do not hide a crowded formation by silently shrinking everyone's sprite.
 return walking;
}
export function seatingRowGap(guests){
 const seated=guests.filter(g=>g.seated&&g.scene==='ceremony');if(!seated.length)return undefined;
 let gap=.06;
 for(let i=0;i<seated.length;i++)for(const b of seated.slice(i+1)){const a=seated[i],dy=Math.abs(a.y-b.y);if(Math.abs(a.x-b.x)<.025&&dy>.02)gap=Math.min(gap,dy);}
 return gap;
}
