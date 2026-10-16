import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import worker from '../src/index.js';
const owner='user-federico-181099';
function seed(d,count){
 for(let i=0;i<count;i++){
  const id='cw-target-'+i,native=String(800000000+i),p={id,name:'Case Player '+i,userAdded:true,sourceKey:'itf|id:'+native,sourceCircuit:'itf',sourcePlayerId:native,worldTennisId:native};
  d.execute('INSERT INTO user_app_player_additions VALUES(?,?,?,?,?)',[owner,id,p.sourceKey,JSON.stringify(p),'2026-10-17']);
  for(const table of ['user_app_players','user_app_other_players'])d.execute(`INSERT INTO ${table} VALUES(?,?,?)`,[owner,id,'2026-10-17']);
  d.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',['t'+i,'itf','t'+i,'2026-10-01','2026-10-07',JSON.stringify({name:'Tournament '+i,startDate:'2026-10-01',endDate:'2026-10-07'})]);
  d.execute('INSERT INTO matches VALUES(?,?,?,?,?)',['m'+i,'t'+i,'itf','2026-10-02',JSON.stringify({event:'GS14',score:'6-2 6-3',status:'completed'})]);
  d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',['m'+i,'self',native,p.name,p.name.toLowerCase(),'ITA',0,1,'{}']);
 }
}
function request(db,group,playerId){return worker.fetch(new Request('https://example.test/app/api/app-snapshot'+(playerId===undefined?'':'?playerId='+encodeURIComponent(playerId)),{headers:{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com','X-CourtWatch-Group':group}}),{DB:db});}
function counted(db){let calls=0;const sql=[];function wrap(s){return new Proxy(s,{get(t,k){const v=t[k];if(k==='bind')return(...args)=>wrap(v.apply(t,args));if(['all','first'].includes(k))return(...args)=>{calls++;return v.apply(t,args)};return typeof v==='function'?v.bind(t):v;}})}return{db:{prepare(s){sql.push(s);return wrap(db.prepare(s))},batch:s=>db.batch(s)},calls:()=>calls,sql};}
test('scoped snapshot returns the exact full-snapshot player, entries and match history in TCL and Others',async()=>{
 const d=database({identityMapping:true}),original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({tournaments:[]})});
 try{seed(d,3);const before=d.writes();
  for(const group of ['main','others']){
   const fullCounter=counted(d.db),fullResponse=await request(fullCounter.db,group);assert.equal(fullResponse.status,200);const full=await fullResponse.json();
   const scopedCounter=counted(d.db),scopedResponse=await request(scopedCounter.db,group,'cw-target-1');assert.equal(scopedResponse.status,200);const scoped=await scopedResponse.json();
   assert.equal(scoped.playerId,'cw-target-1');assert.equal(scoped.group,group);
   for(const [key,field] of [['players','id'],['tournaments','playerId'],['matches','playerId']])assert.deepEqual(scoped[key],full[key].filter(r=>r[field]==='cw-target-1'),key);
   assert.equal(scoped.matches.length,1);assert.equal(scoped.tournaments.length,1);
   assert.ok(scopedCounter.calls()<fullCounter.calls());console.log(JSON.stringify({group,fullQueries:fullCounter.calls(),scopedQueries:scopedCounter.calls()}));
  }assert.equal(d.writes(),before);
 }finally{globalThis.fetch=original;d.close()}
});
test('scoped enrichment work does not grow with unrelated selected players',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({tournaments:[]})});const counts=[];
 try{for(const count of [1,5]){const d=database({identityMapping:true});try{seed(d,count);const counter=counted(d.db),r=await request(counter.db,'others','cw-target-0');assert.equal(r.status,200);const b=await r.json();assert.equal(b.players.length,1);assert.equal(b.matches.length,1);counts.push(counter.calls());}finally{d.close()}}
 assert.equal(counts[0],counts[1],JSON.stringify(counts));
 }finally{globalThis.fetch=original}
});
test('scoped snapshots reject invalid, foreign and removed membership before reading histories',async()=>{
 const d=database({identityMapping:true});try{seed(d,1);
  assert.equal((await request(d.db,'main','')).status,400);assert.equal((await request(d.db,'main','x'.repeat(161))).status,400);
  const c=counted(d.db);assert.equal((await request(c.db,'main','foreign')).status,404);assert.ok(!c.sql.some(s=>s.includes('FROM matches')||s.includes('FROM app_matches')));
  d.execute('INSERT INTO user_app_player_removals VALUES(?,?,?)',[owner,'cw-target-0','2026-10-17']);
  assert.equal((await request(d.db,'main','cw-target-0')).status,404);
 }finally{d.close()}
});
