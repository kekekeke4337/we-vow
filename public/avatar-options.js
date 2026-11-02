// Appearance is chosen once on the invitation, never changed by a scene action.
// Art layers must share an anchor/rig and pose map before replacing placeholders.
export const avatarOptions={
 species:[['human','人类'],['cat','猫族'],['fox','狐族'],['bird','鸟族'],['android','人形机']],
 hair:[['short','短发'],['bob','齐肩发'],['long','长发'],['braid','编发']],
 clothes:[['dress','裙装'],['suit','西装'],['linen','轻便衬衫'],['robe','长袍']],
 accessory:[['none','不戴配饰'],['ginkgo','银杏'],['moon','月亮'],['raven','渡鸦'],['bow','蝴蝶结']],
 palette:[['sage','银杏绿'],['sky','月光蓝'],['lavender','浅紫'],['charcoal','黑曜灰']]
};
export const defaultAvatar={species:'human',hair:'short',clothes:'suit',accessory:'none',palette:'sage'};
export function validateAvatar(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(avatarOptions,k)))throw new Error('未知形象组件');
 const result={...defaultAvatar,...value};
 for(const [key,choices]of Object.entries(avatarOptions))if(!choices.some(([id])=>id===result[key]))throw new Error('未知形象组件：'+key);
 return result;
}
