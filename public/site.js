export const basePath=new URL(document.baseURI).pathname.replace(/\/$/,'');
export const siteUrl=location.origin+basePath;
export const jointRehearsal=document.documentElement.dataset.siteMode==='joint-rehearsal';
