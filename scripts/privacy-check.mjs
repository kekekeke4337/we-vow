// Scans only Git-visible project files; never opens .local or unrelated agent data.
import {execFileSync} from 'node:child_process';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const forbidden=/(^|\/)(?:\.local|node_modules|outbox|inbox|journal|sessions|certificates)(\/|$)|(?:\.sqlite(?:-wal|-shm)?|\.db|\.pem|\.key|\.pfx|\.log|\.url|\.private\.json)$|(^|\/)(?:state|invitations|main-ack)\.json$|(^|\/)\.env(?!\.example$)/i;
const patterns=[/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,/\bgh[pousr]_[A-Za-z0-9]{20,}/g,/\bgithub_pat_[A-Za-z0-9_]{20,}/g,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,/[#?](?:invite|ticket|session)=[A-Za-z0-9_-]{24,}/g,/\bBearer\s+[A-Za-z0-9_-]{30,}\b/g];
const privateIdentity=/(?:37\s*[×x]\s*43|4337\.work|阿深|土豆片|来老师|观星|绒绒|闻野|林图安|星屿|林佳季|小吠|临川|言言|岑知|利未|克儿|Luna|米雪|栖衡|谢临)/i;
const errors=[],inventory=[];let bytes=0;
for(const file of files){
 if(forbidden.test(file)){errors.push({file,reason:'private/runtime/credential path'});continue;}
 let info;try{info=await stat(file);}catch(error){if(error.code==='ENOENT')continue;throw error;}if(!info.isFile())continue;
 const data=await readFile(file);bytes+=data.length;if(data.length>=95*1024**2)errors.push({file,reason:'file approaches GitHub single-file size limit'});
 const binary=/\.(png|webp|jpg|jpeg|gif|woff2?|ico|mp[34]|zip)$/i.test(file);
 if(!binary){const text=data.toString('utf8');for(const [i,pattern]of patterns.entries()){pattern.lastIndex=0;const match=pattern.exec(text);if(match)errors.push({file,line:text.slice(0,match.index).split('\n').length,reason:'credential-like content, pattern '+i});}if(!['README.md','LICENSE','scripts/privacy-check.mjs'].includes(file)){privateIdentity.lastIndex=0;const match=privateIdentity.exec(text);if(match)errors.push({file,line:text.slice(0,match.index).split('\n').length,reason:'private wedding identity marker'});}}
 inventory.push({file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}
const directory=resolve('.local','privacy-check-'+Date.now());await mkdir(directory,{recursive:true});
const report={passed:errors.length===0,scope:'Git-visible files only; path and credential-pattern scan, not a guarantee of legal rights or semantic privacy',files:inventory.length,totalBytes:bytes,errors,inventory};
await writeFile(resolve(directory,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,files:report.files,totalBytes:bytes,errors,evidence:directory},null,2));if(errors.length)process.exitCode=1;
