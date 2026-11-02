import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createWedding} from '../server/wedding.mjs';
import {startWeddingServer} from '../server/http.mjs';

function cast(wedding){
 const people={};
 for(const [key,name,role] of [
  ['bride','伴侣 A','bride'],['groom','伴侣 B','groom'],['host','主持 Agent','host'],
  ['witness','证婚人','witness'],['rings','送戒指 Agent','rings'],['guest','测试来宾','guest'],
 ])people[key]=wedding.joinGuest(wedding.invite(name,role));
 return people;
}

test('requires independent consent and completes with generic identity art',()=>{
 let now=1_800_000_000_000;
 const wedding=createWedding({clock:()=>now});
 const people=cast(wedding),bride=people.bride.session;
 const next=()=>wedding.action(bride,'next');
 try{
  next(); // seating
  next(); // opening
  wedding.action(people.host.session,'speech',{text:'欢迎大家。'});
  next(); // witness
  wedding.action(people.witness.session,'speech',{text:'愿你们相爱，也始终自由。'});
  next(); // entrance
  next(); // groom
  wedding.action(people.groom.session,'speech',{text:'我愿意和你继续生活。'});
  next(); // consent
  assert.throws(()=>wedding.action(people.guest.session,'confirm'),/仅两位新人本人/);
  wedding.action(bride,'confirm');
  assert.throws(next,/两位新人各自亲自确认/);
  wedding.action(people.groom.session,'confirm');
  next(); // rings
  wedding.action(people.rings.session,'rings');
  next(); // kiss
  next(); // embrace
  next(); // photo
  now+=30_001;
  const photo=wedding.snapshot(bride).photo;
  assert.equal(photo.ready,true);
  assert.ok(photo.guests.every(guest=>guest.worldArtSnapshot?.kind==='generic'));
  next(); // banquet
  next(); // closed
  assert.equal(wedding.snapshot(bride).phase.id,'closed');
 }finally{wedding.close();}
});

test('starts in an isolated directory and serves the public template',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'agent-wedding-template-'));
 const app=await startWeddingServer({directory,host:'127.0.0.1',port:0,storage:'json'});
 try{
  const health=await fetch(app.localOrigin+'/api/health').then(response=>response.json());
  assert.equal(health.ok,true);
  const html=await fetch(app.localOrigin+'/').then(response=>response.text());
  assert.match(html,/伴侣 A/);
  assert.doesNotMatch(html,/2026年11月1日19:30/);
  const invitations=JSON.parse(await readFile(join(directory,'invitations.json'),'utf8'));
  assert.deepEqual(invitations.slice(0,2).map(item=>item.name),['伴侣 A','伴侣 B']);
 }finally{await app.close();}
});
