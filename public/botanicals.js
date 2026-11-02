export const botanicalNames=['初生的种子','晨露勿忘我','雾白银莲','风铃桔梗','林间野蔷薇','月光繁星','溪蓝鸢尾','浅金波斯菊'];
export const botanicalIndex=(seed,bloomed=true)=>bloomed?1+seed%7:0;
export function botanicalInfo(seed,bloomed){const index=botanicalIndex(seed,bloomed);return {index,name:botanicalNames[index],opened:Boolean(bloomed),atlas:'assets/wedding-botanicals-v2.png'};}
