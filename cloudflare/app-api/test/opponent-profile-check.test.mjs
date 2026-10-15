import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {checkOpponentProfiles} from '../lib/opponent-profile-check.mjs';

test('checks every case once, keeps failures red and emits no names, identities or account',async()=>{
 const client={query:async()=>[{source_player_id:'12345678-1234-1234-1234-123456789abc'}]},requests=[];
 const worker={fetch:async(request)=>{requests.push(request);return Response.json(requests.length===2?{error:'internal_error'}:{tournaments:[{matches:[{}]}]},{status:requests.length===2?500:200});}};
 const report=await checkOpponentProfiles({worker,client,email:'private@example.test',names:['First Person','Second Person'],asOf:'2026-10-14'});
 assert.equal(requests.length,2);assert.equal(report.complete,false);
 assert.deepEqual(report.cases.map(row=>row.status),[200,500]);
 assert.equal(report.cases[0].matches,1);
 assert.equal(new URL(requests[0].url).searchParams.get('profileId'),'12345678-1234-1234-1234-123456789abc');
 assert.ok(!/First Person|Second Person|private@example|12345678/.test(JSON.stringify(report)));
});

test('guard prevents a Worker replay from writing and ambiguous native IDs are not guessed',async()=>{
 let writes=0;
 const client={query:async(sql)=>{if(/INSERT/.test(sql))writes++;return[{source_player_id:'12345678-1234-1234-1234-123456789abc'},{source_player_id:'22345678-1234-1234-1234-123456789abc'}];}};
 const worker={fetch:async(request,env)=>{
  assert.equal(new URL(request.url).searchParams.get('profileId'),'');
  await env.DB.prepare('INSERT INTO matches(id) VALUES(?)').bind('bad').all();
  return Response.json({tournaments:[]});
 }};
 const report=await checkOpponentProfiles({worker,client,email:'private@example.test',names:['First Person'],asOf:'2026-10-14'});
 assert.equal(report.complete,false);assert.equal(report.cases[0].error,'request_failed');assert.equal(writes,0);
});

test('HTTP 200 with an empty unidentified profile cannot certify the named opponent',async()=>{
 const report=await checkOpponentProfiles({worker:{fetch:async()=>Response.json({tournaments:[]})},client:{query:async()=>[]},email:'private@example.test',names:['Unknown Opponent'],asOf:'2026-10-15'});
 assert.equal(report.cases[0].status,200);
 assert.equal(report.cases[0].resolved,false);
 assert.equal(report.cases[0].error,'profile_not_identified');
 assert.equal(report.complete,false);
});

test('a uniquely mapped profile can legitimately have no tournament history',async()=>{
 const client={query:async sql=>sql.includes('p.canonical_id FROM player_identity_people')?[{canonical_id:'person:test'}]:[]};
 const worker={fetch:async request=>{
  assert.equal(new URL(request.url).searchParams.get('profileId'),'person:test');
  return Response.json({tournaments:[]});
 }};
 const report=await checkOpponentProfiles({worker,client,email:'private@example.test',names:['Known Opponent'],asOf:'2026-10-15'});
 assert.equal(report.cases[0].resolved,true);assert.equal(report.complete,true);
});

test('empty Europe tournaments distinguish missing acquisition from unprojected exact-name candidates',async()=>{
 let catalogReads=0,aggregates=0;
 const client={query:async(sql)=>{
  if(sql.includes('p.canonical_id FROM player_identity_people'))return[{canonical_id:'person:test'}];
  if(sql.startsWith('SELECT id,source_tournament_id FROM tournaments')){catalogReads++;return[{id:'t1',source_tournament_id:'C1'},{id:'t2',source_tournament_id:'C2'}];}
  if(sql.includes('COUNT(*) AS total'))return[++aggregates===1?{total:0,undated:0,future:0,named:0}:{total:8,undated:0,future:0,named:2}];
  return[];
 }};
 const worker={fetch:async()=>Response.json({tournaments:[
  {id:'entry:1',competitionId:'C1',name:'Past A',circuit:'tennis-europe',startDate:'2026-09-01',matches:[]},
  {id:'entry:2',competitionId:'C2',name:'Past B',circuit:'tennis-europe',startDate:'2026-09-08',matches:[]},
  {id:'future',name:'Future',circuit:'tennis-europe',startDate:'2026-11-01',matches:[]}
 ]})};
 const report=await checkOpponentProfiles({worker,client,email:'private@example.test',names:['Known Opponent'],asOf:'2026-10-15'});
 assert.equal(report.complete,false);assert.equal(report.cases[0].error,'past_europe_without_matches');
 assert.equal(report.cases[0].emptyPastEuropeTournaments,2);
 const details=report.cases[0].tournamentDetails;
 assert.equal(details[0].evidence,'matches_not_acquired');
 assert.equal(details[1].evidence,'named_candidates_not_projected');assert.equal(details[1].namedDatedCandidates,2);
 assert.equal(details[2].evidence,undefined);assert.equal(catalogReads,1);assert.equal(aggregates,2);
 assert.ok(!JSON.stringify(details).includes('person:test'));
});

test('current and upcoming empty entries are legitimate but all displayed past Europe tournaments must have matches',async()=>{
 const client={query:async sql=>sql.includes('p.canonical_id FROM player_identity_people')?[{canonical_id:'person:test'}]:[]};
 const tournaments=[{circuit:'tennis-europe',historyKind:'current',startDate:'2026-10-12',endDate:'2026-10-18',matches:[]},{circuit:'tennis-europe',historyKind:'upcoming',startDate:'2026-10-20',matches:[]},{circuit:'tennis-europe',historyKind:'past',startDate:'2026-09-01',endDate:'2026-09-07',matches:[{matchId:'m'}]}];
 const report=await checkOpponentProfiles({worker:{fetch:async()=>Response.json({tournaments})},client,email:'private@example.test',names:['Known Opponent'],asOf:'2026-10-15'});
 assert.equal(report.complete,true);assert.equal(report.cases[0].pastEuropeTournaments,1);assert.equal(report.cases[0].emptyPastEuropeTournaments,0);
});

test('archive coverage uses actual SQL and keeps nominal candidates separate from identified history',async()=>{
 const d=database();
 try {
  d.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',['private-t','tennis-europe','private-competition','2026-09-01','2026-09-07',JSON.stringify({name:'Public Tournament'})]);
  d.execute('INSERT INTO matches VALUES(?,?,?,?,?)',['private-match','private-t','tennis-europe','2026-09-03','{}']);
  d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',['private-match','private-person','private-local','Known Opponent','known opponent','ITA',0,0,'{}']);
  let calls=0;
  const client={query:async(sql,params)=>{
   if(sql.includes('COUNT(DISTINCT m.id)')){calls++;return d.execute(sql,params);}
   return sql.includes('p.canonical_id FROM player_identity_people')?[{canonical_id:'private-canonical'}]:[];
  }};
  const report=await checkOpponentProfiles({worker:{fetch:async()=>Response.json({tournaments:[]})},client,email:'private@example.test',names:['Known Opponent'],asOf:'2026-10-15'});
  assert.equal(calls,1);assert.equal(report.cases[0].tournaments,0);
  assert.deepEqual(report.cases[0].namedPastCandidates,[{name:'Public Tournament',startDate:'2026-09-01',endDate:'2026-09-07',matches:1}]);
  assert.ok(!JSON.stringify(report).includes('private-'));
 } finally {d.close();}
});
