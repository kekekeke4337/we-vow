export const photoWindow={x:55,y:55,width:890,height:840};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function normalizeCamera(value={}){
 return {x:clamp(value.x??.38,0,1),y:clamp(value.y??.5,0,1),zoom:clamp(value.zoom??1,1,4)};
}
export function photoCrop(width,height,value){
 const camera=normalizeCamera(value),h=Math.min(height,width*photoWindow.height/photoWindow.width)/camera.zoom,w=h*photoWindow.width/photoWindow.height;
 return {x:clamp(camera.x*width-w/2,0,width-w),y:clamp(camera.y*height-h/2,0,height-h),width:w,height:h};
}
export function defaultPhotoLayout(index,count){
 if(!Number.isInteger(index)||!Number.isInteger(count)||index<0||count<1||index>=count)throw Error('照片人物序号无效');
 if(count<=4)return {x:.5+(index-(count-1)/2)*.215,y:.85,height:240};
 const columns=Math.min(8,Math.max(3,Math.ceil(Math.sqrt(count*1.45)))),rows=Math.ceil(count/columns),row=Math.floor(index/columns),column=index%columns;
 const inRow=Math.min(columns,count-row*columns),stepX=columns===1?0:.76/(columns-1),x=.5+(column-(inRow-1)/2)*stepX;
 const top=rows===1?.85:Math.max(.34,.68-(rows-2)*.055),bottom=.88,y=rows===1?.85:top+row*(bottom-top)/(rows-1);
 const height=Math.max(82,Math.min(190,720/(rows+1.35)));
 return {x,y,height};
}
export function defaultPhotoPosition(index,count){const {x,y}=defaultPhotoLayout(index,count);return {x,y};}
export function normalizePhotoPosition(value){return {x:clamp(value.x,.13,.87),y:clamp(value.y,.3,.89)};}
