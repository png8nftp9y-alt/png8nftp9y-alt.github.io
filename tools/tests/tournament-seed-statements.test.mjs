import test from 'node:test';import assert from 'node:assert/strict';import {database} from '../../cloudflare/app-api/test/search-sqlite-fixture.mjs';import {tournamentSeedStatements} from '../../cloudflare/app-api/lib/tournament-seed-statements.mjs';
const rows=Array.from({length:203},(_,i)=>({id:'t'+i,circuit:'fitp',sourceTournamentId:'source'+i,startDate:'2026-01-01',endDate:'2026-01-02',name:"Torneo d'Italia 🎾",source:{id:i}}));
test('D1_TEST_INITIAL_IMPORT: JSON batches preserve every field and reduce 203 statements to three',()=>{
 const d=database();try{const statements=tournamentSeedStatements(rows);assert.equal(statements.length,3);for(const sql of statements)d.execute(sql);const stored=d.execute('SELECT payload FROM tournaments ORDER BY id').map(r=>JSON.parse(r.payload));assert.deepEqual(stored.sort((a,b)=>a.id.localeCompare(b.id)),[...rows].sort((a,b)=>a.id.localeCompare(b.id)));}finally{d.close();}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES and D1_TEST_REAL_DELTAS_ONLY: replay does zero writes; one delta updates one row',()=>{
 const d=database();try{for(const sql of tournamentSeedStatements(rows))d.execute(sql);let before=d.writes();for(const sql of tournamentSeedStatements(rows))d.execute(sql);assert.equal(d.writes(),before);
 const changed=rows.map((r,i)=>i===101?{...r,name:'Changed'}:r);before=d.writes();for(const sql of tournamentSeedStatements(changed))d.execute(sql);assert.equal(d.writes()-before,1);
 }finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: invalid batches/identities fail before import',()=>{assert.throws(()=>tournamentSeedStatements([{}]));assert.throws(()=>tournamentSeedStatements(rows,{batchSize:101}));assert.deepEqual(tournamentSeedStatements([]),[]);});
