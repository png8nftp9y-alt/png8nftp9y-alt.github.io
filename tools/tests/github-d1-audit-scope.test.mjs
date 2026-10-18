import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {relationScope,cachedDrawScope,projectionScope} from '../../cloudflare/app-api/scripts/github-d1-audit-scope.mjs';
test('only explicit rejected relations are excluded, unknown statuses remain findings',()=>{
 const rejected={permanenceStatus:'rejected_by_complete_singles_draws'},unknown={permanenceStatus:'pending'};assert.deepEqual(relationScope([rejected,unknown,{}]),{expected:[unknown,{}],excluded:[rejected]});
});
test('RR exclusion is per sex and main singles, and explicit exceptions remain visible',()=>{
 const scope=cachedDrawScope({x:{competitionId:'X',eventInventory:[{event:'B-S-M-RR',family:'B-S-M'}],eventCache:Object.fromEntries(['B-S-M-KO','G-S-M-KO','B-S-Q-KO','B-D-M-KO'].map(e=>[e,{populated:true}]))}});
 assert.deepEqual(scope.excluded.map(r=>r.event),['B-S-M-KO']);assert.equal(scope.expected.length,3);
 const exception=cachedDrawScope({x:{competitionId:'J-J200-TUR-2026-002',eventCache:{'G-S-Q-KO':{populated:true}}}});assert.equal(exception.excluded[0].reason,'explicit_user_exclusion');
});
test('real cached inventory preserves four unresolved raw qualifications and declares all exclusions',async()=>{
 const d=JSON.parse(await fs.readFile(new URL('../../history/itf_draw_target_db.json',import.meta.url),'utf8')),scope=cachedDrawScope(d.tournaments);
 for(const id of ['J-J30-LTU-2026-003','J-J60-ESP-2026-007'])for(const event of ['B-S-Q-KO','G-S-Q-KO'])assert.ok(scope.expected.some(r=>r.competitionId===id&&r.event===event));
 assert.equal(scope.excluded.filter(r=>r.reason==='explicit_user_exclusion').length,2);
 assert.ok(scope.excluded.filter(r=>r.reason==='singles_main_ko_in_rr_family').length>=23);
});

test('explicit ITF match exclusion removes only match/result reads, preserves FITP comparisons and ITF entries/schedules/tournaments',()=>{
 const rows=['fitp','tennis-europe','itf'].map(circuit=>({id:circuit,circuit}));
 for(const table of ['matches','results']){const scope=projectionScope(table,rows);assert.deepEqual(scope.expected,[rows[0]]);assert.equal(scope.excludedITFMatchRows,1);assert.equal(scope.excludedTennisEuropeRows,1);assert.match(scope.itfMatchScope,/explicit_user_request/);}
 assert.deepEqual(projectionScope('schedules',rows).expected,[rows[0],rows[2]]);
 for(const table of ['tournaments','entries','players'])assert.deepEqual(projectionScope(table,rows).expected,rows);
});
test('excluded ITF match/result IDs never reach the D1 transport; zero remaining rows cause zero requests',async()=>{
 const {readProjectionRows}=await import('../../cloudflare/app-api/scripts/read-audit-projection.mjs');
 let calls=0;for(const table of ['matches','results']){const {expected}=projectionScope(table,[{id:'itf-raw-match',circuit:'itf'}]);assert.deepEqual(await readProjectionRows(async()=>{calls++;throw Error('must not query excluded IDs');},table,expected.map(r=>r.id)),[]);}
 assert.equal(calls,0);
 const draw=cachedDrawScope({x:{competitionId:'J-J30-LTU-2026-003',eventCache:{'B-S-Q-KO':{populated:true}}}});assert.equal(draw.expected.length,1);
});
