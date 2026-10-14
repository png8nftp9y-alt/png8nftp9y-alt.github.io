import test from 'node:test';
import assert from 'node:assert/strict';
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
