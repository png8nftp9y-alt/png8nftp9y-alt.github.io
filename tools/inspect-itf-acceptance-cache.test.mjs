import test from 'node:test';import assert from 'node:assert/strict';import {acceptanceInventory} from './inspect-itf-acceptance-cache.mjs';
test('counts tournaments and gender lists, preserving sections, withdrawals and unknown genders',()=>{
 const r=acceptanceInventory({participants:[
 {competitionId:'a',gender:'Boys',acceptanceCode:'MD'},
 {competitionId:'a',gender:'Boys',acceptanceCode:'Q'},
 {competitionId:'a',gender:'Girls',entryStatus:'withdrawn'},
 {competitionId:'b',playerTypeCode:'G',acceptanceCode:'A'},
 {competitionId:'b',gender:'',acceptanceCode:'MD'}]});
 assert.equal(r.tournaments,2);assert.equal(r.nonEmptyGenderLists,3);assert.equal(r.participantRows,5);assert.equal(r.unknownGenderRows,1);
 assert.deepEqual(r.byTournament[0].lists[0].sections,{MD:1,Q:1});assert.equal(r.byTournament[0].lists[1].withdrawn,1);
});
test('invalid inputs cannot silently produce an empty success',()=>{assert.throws(()=>acceptanceInventory({}),/invalid/);assert.throws(()=>acceptanceInventory({participants:[{}]}),/without_tournament/);assert.equal(acceptanceInventory({participants:[]}).tournaments,0)});
