import './bounded-player-map.test.mjs';
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
   assert.match(scopedResponse.headers.get('Server-Timing'),/total;dur=\d/);assert.match(scopedResponse.headers.get('Server-Timing'),/match_history;dur=\d/);assert.equal(fullResponse.headers.get('Server-Timing'),null);
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

test('scoped match history starts while entry profiles are still pending', {timeout:60000}, async()=>{
 const d=database({identityMapping:true}),original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({tournaments:[]})});
 try{seed(d,1);let release,overlap=false;
  function wrap(s,sql){return new Proxy(s,{get(t,k){const v=t[k];if(k==='bind')return(...args)=>wrap(v.apply(t,args),sql);
   if(k==='all')return async(...args)=>{
    if(sql.includes('JOIN opponent_entry_profiles'))return new Promise((resolve,reject)=>{release=()=>Promise.resolve(v.apply(t,args)).then(resolve,reject)});
    if(sql.includes('WITH candidate_matches AS MATERIALIZED')&&release){overlap=true;release();release=null;}
    return v.apply(t,args);
   };return typeof v==='function'?v.bind(t):v;}})}
  const db={prepare:sql=>wrap(d.db.prepare(sql),sql),batch:s=>d.db.batch(s)},before=d.writes();
  const response=await request(db,'others','cw-target-0');assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.matches.length,1);assert.equal(overlap,true);assert.equal(d.writes(),before);
 }finally{globalThis.fetch=original;d.close()}
});

test('scoped public presentation loads before match history finishes and final output matches the full snapshot', {timeout:60000}, async()=>{
 const d=database({identityMapping:true}),original=globalThis.fetch;
 let releaseHistory,startedHistory,overlap=false;
 const historyStarted=new Promise(resolve=>{startedHistory=resolve});
 globalThis.fetch=async()=>{throw Error('Unexpected HTTP metadata read')};
 d.publishRuntimeDocuments({'history/itf_official_metadata.json':{tournaments:{t0:{venueName:'Verified Club',qualificationStartDate:'2026-09-30'}}}});
 try{seed(d,1);
  function wrap(s,sql,values=[]){return new Proxy(s,{get(t,k){const v=t[k];if(k==='bind')return(...args)=>wrap(v.apply(t,args),sql,args);
   if(k==='all'&&sql.includes('runtime_document_chunks')&&values[0]==='history/itf_official_metadata.json')return async(...args)=>{await historyStarted;overlap=true;releaseHistory();return v.apply(t,args)};
   if(k==='all'&&sql.includes('WITH candidate_matches AS MATERIALIZED'))return(...args)=>new Promise((resolve,reject)=>{
    releaseHistory=()=>Promise.resolve(v.apply(t,args)).then(resolve,reject);startedHistory();
   });return typeof v==='function'?v.bind(t):v;}})}
  const db={prepare:sql=>wrap(d.db.prepare(sql),sql),batch:s=>d.db.batch(s)},before=d.writes();
  const response=await request(db,'others','cw-target-0');assert.equal(response.status,200);const scoped=await response.json();
  assert.equal(overlap,true);assert.equal(scoped.matches.length,1);assert.equal(scoped.tournaments[0].venueName,'Verified Club');
  assert.equal(scoped.tournaments[0].startDate,'2026-09-30');
  const full=await (await request(d.db,'others')).json();
  for(const key of ['players','tournaments','matches'])assert.deepEqual(scoped[key],full[key],key);
  assert.equal(d.writes(),before);
 }finally{globalThis.fetch=original;d.close()}
});

test('scoped ranking reads overlap history and a ranking outage still preserves the player snapshot', {timeout:60000}, async()=>{
 const d=database({identityMapping:true}),original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({tournaments:[]})});
 try{seed(d,1);const before=d.writes();
  for(const fail of [false,true]){
   let releaseHistory,startedHistory,overlap=false;const historyStarted=new Promise(resolve=>{startedHistory=resolve});
   function wrap(s,sql){return new Proxy(s,{get(t,k){const v=t[k];if(k==='bind')return(...args)=>wrap(v.apply(t,args),sql);
    if(k==='all')return async(...args)=>{
     if(sql.includes('WITH candidate_matches AS MATERIALIZED'))return new Promise((resolve,reject)=>{releaseHistory=()=>Promise.resolve(v.apply(t,args)).then(resolve,reject);startedHistory()});
     if(sql.includes('FROM tennis_europe_current_player_rankings')){await historyStarted;overlap=true;releaseHistory();if(fail)throw Error('injected_ranking_outage');}
     return v.apply(t,args);
    };return typeof v==='function'?v.bind(t):v;}})}
   const db={prepare:sql=>wrap(d.db.prepare(sql),sql),batch:s=>d.db.batch(s)};
   const response=await request(db,'others','cw-target-0');assert.equal(response.status,200);
   const result=await response.json();assert.equal(result.players[0].id,'cw-target-0');assert.equal(result.matches.length,1);assert.equal(overlap,true);
  }assert.equal(d.writes(),before);
 }finally{globalThis.fetch=original;d.close()}
});

test('final profile resolution overlaps a pending catalogue and preserves exact snapshot with zero writes', {timeout:60000},async()=>{
 const d=database({identityMapping:true});let held=false,release,overlap=false,timer;
 try{seed(d,1);
  const expected=await (await request(d.db,'others','cw-target-0')).json();
  // A distinct published version ensures this test exercises a cold catalogue.
  d.publishRuntimeDocuments({'dist/v3/tournaments.json':{status:'fixture_complete',players:[{id:'fixture'}],tournaments:[{competitionId:'FIXTURE'}],testVersion:'pending-catalogue-overlap'}});
  const before=d.writes();
  function wrap(s,sql,values=[]){return new Proxy(s,{get(t,k){const v=t[k];if(k==='bind')return(...args)=>wrap(v.apply(t,args),sql,args);
   if(k==='all')return async(...args)=>{
    if(sql.includes('runtime_document_chunks')&&values[0]==='dist/v3/tournaments.json'&&!held){held=true;return new Promise((resolve,reject)=>{release=()=>Promise.resolve(v.apply(t,args)).then(resolve,reject);timer=setTimeout(()=>{release();release=null},5000)})}
    if(sql.includes('FROM observed_players WHERE normalized_name')&&held&&release){overlap=true;clearTimeout(timer);release();release=null;}
    return v.apply(t,args);
   };return typeof v==='function'?v.bind(t):v;}})}
  const db={prepare:sql=>wrap(d.db.prepare(sql),sql),batch:s=>d.db.batch(s)};
  const response=await request(db,'others','cw-target-0');assert.equal(response.status,200);
  const result=await response.json();assert.equal(overlap,true);assert.deepEqual({...result,generatedAt:null},{...expected,generatedAt:null});assert.equal(d.writes(),before);
 }finally{clearTimeout(timer);d.close()}
});

test('full group overlaps independent entries/history and bounds histories to three players, with unchanged membership and zero writes', {timeout:60000}, async()=>{
 const d=database({identityMapping:true}),original=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({tournaments:[]})});
 try{seed(d,5);let active=0,peak=0,releaseEntries,overlap=false;
  function wrap(statement,sql){return new Proxy(statement,{get(target,key){const value=target[key];if(key==='bind')return(...args)=>wrap(value.apply(target,args),sql);
   if(key==='all')return async(...args)=>{
    if(sql.includes('JOIN opponent_entry_profiles'))return new Promise((resolve,reject)=>{releaseEntries=()=>Promise.resolve(value.apply(target,args)).then(resolve,reject)});
    if(sql.includes('WITH candidate_matches AS MATERIALIZED')){
     peak=Math.max(peak,++active);await new Promise(resolve=>setImmediate(resolve));
     if(releaseEntries){overlap=true;releaseEntries();releaseEntries=null;}
     try{return await value.apply(target,args)}finally{active--;}
    }
    return value.apply(target,args);
   };return typeof value==='function'?value.bind(target):value;}});}
  const before=d.writes(),response=await request({prepare:sql=>wrap(d.db.prepare(sql),sql),batch:s=>d.db.batch(s)},'others');
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.players.length,5);assert.equal(body.matches.length,5);assert.equal(overlap,true);assert(peak>1&&peak<=3,String(peak));assert.equal(d.writes(),before);
 }finally{globalThis.fetch=original;d.close();}
});

test('new-player FITP and birth reads start before history completes and apply the same final data with zero writes', {timeout:60000}, async()=>{
 const d=database({identityMapping:true});
 try{seed(d,1);const row=d.execute("SELECT payload FROM user_app_player_additions WHERE courtwatch_id='cw-target-0'")[0];const player={...JSON.parse(row.payload),membershipCard:'1234567'};d.execute("UPDATE user_app_player_additions SET payload=? WHERE courtwatch_id='cw-target-0'",[JSON.stringify(player)]);
  d.execute('CREATE TABLE fitp_player_metadata(membership_card TEXT PRIMARY KEY,canonical_id TEXT,club TEXT,ranking TEXT,updated_at TEXT)');
  d.execute('CREATE TABLE player_birth_metadata(source_key TEXT PRIMARY KEY,canonical_id TEXT,circuit TEXT,official_id TEXT,birth_year INTEGER,status TEXT,source_url TEXT,checked_at TEXT,error TEXT)');
  d.execute('INSERT INTO fitp_player_metadata VALUES(?,?,?,?,?)',['1234567',player.id,'Verified Club','3.4','2026-10-30']);
  d.execute('INSERT INTO player_birth_metadata VALUES(?,?,?,?,?,?,?,?,?)',['fitp|id:1234567',player.id,'fitp','1234567',2012,'year_only','https://www.fitp.it/','2026-10-30','']);
  const expected=await (await request(d.db,'others','cw-target-0')).json();let fitp=false,birth=false,overlap=false;const held=[];
  function wrap(statement,sql){return new Proxy(statement,{get(target,key){const value=target[key];if(key==='bind')return(...args)=>wrap(value.apply(target,args),sql);
   if(key==='all')return async(...args)=>{
    if(sql.includes('WITH candidate_matches AS MATERIALIZED'))return new Promise((resolve,reject)=>{held.push(()=>Promise.resolve(value.apply(target,args)).then(resolve,reject));if(fitp&&birth){overlap=true;for(const finish of held.splice(0))finish();}});
    if(sql.includes('LEFT JOIN fitp_player_metadata'))fitp=true;
    if(sql.includes('JOIN player_birth_metadata'))birth=true;
    if(fitp&&birth&&held.length){overlap=true;for(const finish of held.splice(0))finish();}
    return value.apply(target,args);
   };return typeof value==='function'?value.bind(target):value;}});}
  const before=d.writes(),response=await request({prepare:sql=>wrap(d.db.prepare(sql),sql),batch:s=>d.db.batch(s)},'others','cw-target-0');assert.equal(response.status,200);const result=await response.json();
  assert.equal(overlap,true);assert.equal(d.writes(),before);assert.deepEqual({...result,generatedAt:null},{...expected,generatedAt:null});assert.equal(result.players[0].club,'Verified Club');assert.equal(result.players[0].ranking,'3.4');assert.equal(result.players[0].birthYear,2012);
 }finally{d.close();}
});
