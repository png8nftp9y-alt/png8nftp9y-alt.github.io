import test from 'node:test';import assert from 'node:assert/strict';
import {allAppRankingInput} from '../lib/all-app-ranking-input.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
const staticPlayers=[{id:'public',name:'Public Player'}],projection={complete:true,players:[{id:'personal-main',name:'New Main Player'},{id:'personal-other',name:'New Other Player'}],matches:[{id:'match',playerId:'personal-main',partner:'Partner Person'}]};
test('D1_TEST_INITIAL_IMPORT: public, TCL additions and Altri additions are all included',()=>{
 const input=allAppRankingInput(staticPlayers,projection);assert.deepEqual(input.players.map(p=>p.id),['public','personal-main','personal-other']);assert.equal(input.matches[0].playerId,'personal-main');assert.equal(input.matches[0].partner,'Partner Person');
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: repeated identical selected player input has no delta',()=>{
 const input=allAppRankingInput(staticPlayers,projection);assert.equal(buildIncrementalSyncPlan({current:input.players,incoming:allAppRankingInput(staticPlayers,projection).players,keyOf:p=>p.id}).writes,0);
});
test('D1_TEST_REAL_DELTAS_ONLY: newly added player is the only new identity; no registry removals',()=>{
 const before=allAppRankingInput(staticPlayers,projection),after=allAppRankingInput(staticPlayers,{...projection,players:[...projection.players,{id:'new',name:'Another Player'}]});
 const delta=buildIncrementalSyncPlan({current:before.players,incoming:after.players,keyOf:p=>p.id});assert.deepEqual(delta.inserts.map(p=>p.id),['new']);assert.equal(delta.deletes.length,0);
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: incomplete or invalid projection cannot silently fall back to the static registry',()=>{
 for(const value of [null,{...projection,complete:false},{...projection,players:[{name:'No ID'}]},{...projection,matches:[{playerId:'x'}]}])assert.throws(()=>allAppRankingInput(staticPlayers,value));
});
