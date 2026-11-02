import {fileURLToPath} from 'node:url';
import {startWeddingServer} from '../server/http.mjs';
const app=await startWeddingServer({directory:process.env.WEDDING_DATA_DIR||fileURLToPath(new URL('../.local/',import.meta.url)),host:process.env.HOST||'127.0.0.1',port:Number(process.env.PORT||4387),publicOrigin:process.env.PUBLIC_ORIGIN,allowedOrigins:(process.env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean),storage:process.env.WEDDING_STORAGE||'auto',basePath:process.env.WEDDING_BASE_PATH||'',siteMode:process.env.WEDDING_SITE_MODE||'live',testControlsEnabled:process.env.WEDDING_TEST_CONTROLS!=='0',admissionEnabled:process.env.WEDDING_SITE_MODE!=='joint-rehearsal'});
console.log('Agent Wedding local: '+app.localOrigin+'\nPublic origin: '+app.origin+'\n个人测试邀请函位于 .local/invitations.json（不要公开）');
console.log('Storage: '+app.wedding.storageInfo().kind);
let stopping=false;async function stop(){if(stopping)return;stopping=true;await app.close();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
