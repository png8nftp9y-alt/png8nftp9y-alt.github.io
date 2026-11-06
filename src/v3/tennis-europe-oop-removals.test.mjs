import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {unexplainedOopRemovals,resolvedPendingReplacements} from './tennis-europe-oop-removals.mjs';
const f=JSON.parse(readFileSync(new URL('./fixtures/te-resolved-rescheduled-slot-41735878225.json',import.meta.url)));
const previous={matches:[f.previous]},current={status:'green',tournaments:[{competitionId:f.current.competitionId}],matches:[f.current]};
test('actual Ekmekci slot becomes Kizilova-Ekmekci on a different court/order without losing the match',()=>{
 assert.equal(f.previous.court,'AtikSem 3');assert.equal(f.current.court,'AtikSem 2');
 assert.equal(unexplainedOopRemovals(previous,current).length,0);const r=resolvedPendingReplacements(previous,current);assert.equal(r.length,1);assert.equal(r[0].currentMatchId,f.current.id);
});
test('missing, ambiguous, wrong identity, date, event, round, circuit-native tournament or source still block',()=>{
 for(const changes of [{competitionId:'OTHER'},{date:'20261105'},{event:'GS14 - Girls Singles 14 Main Draw'},{round:'Quarter final'},{players:[{id:'7'},{id:'99'}]},{sourceUrl:'https://example.org'},{opponentPending:true},{court:''},{courtMatchNumber:null},{courtMatchNumberSource:''}])assert.equal(unexplainedOopRemovals(previous,{...current,matches:[{...f.current,...changes}]}).length,1);
 assert.equal(unexplainedOopRemovals(previous,{...current,matches:[]}).length,1);
 assert.equal(unexplainedOopRemovals(previous,{...current,matches:[f.current,{...f.current,id:'ambiguous'}]}).length,1);
 for(const changes of [{opponentPending:false},{status:'completed'},{score:'6-0 6-0'},{winnerPlayerIds:['92']}])assert.equal(unexplainedOopRemovals({matches:[{...f.previous,...changes}]},current).length,1);
});
test('normal acquired matches survive source ID/date changes; legitimate tournament rolloff stays allowed',()=>{
 assert.equal(unexplainedOopRemovals({matches:[f.current]},{...current,matches:[{...f.current,id:'new-id',date:'20261105'}]}).length,0);
 assert.equal(unexplainedOopRemovals({matches:[f.current]},{...current,matches:[]}).length,1);
 assert.equal(unexplainedOopRemovals({matches:[f.current]},{tournaments:[],matches:[]}).length,0);
});
test('actual compare command publishes the explanation and still fails on a real disappearance',()=>{
 const dir=mkdtempSync(join(tmpdir(),'te-removals-')),before=join(dir,'before.json'),after=join(dir,'after.json'),output=join(dir,'out.json');writeFileSync(before,JSON.stringify(previous));
 function replay(value){writeFileSync(after,JSON.stringify(value));return spawnSync(process.execPath,[new URL('./compare-tennis-europe-oop-live.mjs',import.meta.url).pathname],{env:{...process.env,TE_OOP_PREVIOUS:before,TE_OOP_CURRENT:after,TE_OOP_TRANSITIONS:output},encoding:'utf8'});}
 assert.equal(replay(current).status,0);let report=JSON.parse(readFileSync(output));assert.equal(report.status,'green');assert.equal(report.resolvedPendingReplacements.length,1);
 assert.notEqual(replay({...current,matches:[]}).status,0);report=JSON.parse(readFileSync(output));assert.equal(report.status,'red');assert.equal(report.unexplainedRemovals.length,1);
});

test('official same-slot provisional substitution is explained; uncertain or completed matches still block',()=>{
 const competitionId='903480F6-55DB-4501-B014-F13DD75DCC96',date='20261107';
 const old={competitionId,date,id:`te-slot|${competitionId}|${date}|Court 12|3`,event:'BS14 - Boys Singles 14 Qualifying',round:'Qualification round of 32',court:'Court 12',courtMatchNumber:3,courtMatchNumberSource:'official_schedule_subheader',sourceUrl:`https://te.tournamentsoftware.com/tournament/${competitionId}/matches/${date}`,opponentPending:true,status:'scheduled',players:[{id:'141'}]};
 const next={...old,players:[{id:'88'}]},before={matches:[old]},after={tournaments:[{competitionId}],matches:[next]};
 assert.deepEqual(unexplainedOopRemovals(before,after),[]);
 assert.equal(resolvedPendingReplacements(before,after)[0].reason,'official_provisional_slot_player_replaced');
 for(const matches of [[],[next,next],...[{id:'different'},{event:'BS16'},{round:'Final'},{status:'completed'},{score:'6-0'},{courtMatchNumberSource:''},{sourceUrl:'https://example.test'},{courtMatchNumber:4}].map(x=>[{...next,...x}])])
  assert.equal(unexplainedOopRemovals(before,{...after,matches}).length,1);
});
