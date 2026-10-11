import test from 'node:test';import assert from 'node:assert/strict';
import {requirePlayerCircuitIds} from '../lib/required-player-circuit-id.mjs';
import {database} from './search-sqlite-fixture.mjs';
const guid='12345678-1234-1234-1234-123456789abc';
const source=(circuit,id='',key=circuit)=>({source_key:key,circuit,official_id:id,display_name:'Player One',payload:{name:'Player One',nationality:'ITA'}});
test('D1_TEST_INITIAL_IMPORT: every circuit ID and official profile URL are preserved without recovery queries',async()=>{
 const rows=[source('fitp','000123'),source('tennis-europe',guid.toUpperCase()),source('itf','800123456'),{...source('fitp','','url'),payload:{profileUrl:'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+btoa('123456789')}}];
 const r=await requirePlayerCircuitIds(async()=>{throw Error('unexpected query')},rows);assert.equal(r.rows.length,4);assert.equal(r.recovered,0);assert.deepEqual(new Set(r.rows.map(p=>p.official_id)),new Set(['000123',guid.toUpperCase(),'800123456','123456789']));
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: exact source recovery reads retained native evidence and never mutates D1',async()=>{
 const d=database({identityMapping:true});try{
  d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['legacy','tennis-europe',guid,'PLAYER ONE','Player One','{}']);const before=d.writes();
  const a=await requirePlayerCircuitIds(d.query,[source('tennis-europe','','legacy')]);assert.equal(a.recovered,1);assert.equal(a.rows[0].official_id,guid);assert.deepEqual(await requirePlayerCircuitIds(d.query,[source('tennis-europe','','legacy')]),a);assert.equal(d.writes(),before);
 }finally{d.close()}
});
test('D1_TEST_REAL_DELTAS_ONLY: source-bound recovery completes new records with IDs; unrelated old rows are not queried by name',async()=>{
 let called=0;const r=await requirePlayerCircuitIds(async()=>[],[source('tennis-europe')],{recoverMissing:async rows=>{called++;assert.equal(rows.length,1);return new Map([['tennis-europe',{officialId:guid,profileUrl:'https://te.tournamentsoftware.com/player-profile/'+guid}]]);}});
 assert.equal(r.rows[0].official_id,guid);assert.equal(r.recovered,1);assert.equal(called,1);
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: local IDs, another circuit, conflicting evidence and unresolved names cannot pass',async()=>{
 await assert.rejects(requirePlayerCircuitIds(async()=>[],[{...source('fitp','123456'),payload:'{private-person'}]),e=>e.message==='player_circuit_source_incomplete');
 for(const circuit of ['fitp','tennis-europe','itf'])await assert.rejects(requirePlayerCircuitIds(async()=>[],[source(circuit,'local-12')]),/player_circuit_id_required/);
 await assert.rejects(requirePlayerCircuitIds(async()=>[source('fitp','123456','tennis-europe')],[source('tennis-europe')]),/player_circuit_id_required/);
 await assert.rejects(requirePlayerCircuitIds(async()=>[source('tennis-europe',guid),source('tennis-europe','22345678-1234-1234-1234-123456789abc')],[source('tennis-europe')]),/player_circuit_id_required/);
 await assert.rejects(requirePlayerCircuitIds(async()=>[],[{...source('itf','800123456'),payload:{profileUrl:'https://www.itftennis.com/en/players/player/800999999/ita/jt/s/overview/'}}]),/player_circuit_id_required/);
 await assert.rejects(requirePlayerCircuitIds(async()=>[{...source('tennis-europe',guid),payload:{nationality:'FRA',birthYear:2012}}],[{...source('tennis-europe'),payload:{nationality:'ITA',birthYear:2012}}]),/player_circuit_id_required/);
 const r=await requirePlayerCircuitIds(async()=>{throw Error('query')},[source('tennis-europe','','tennis-europe|name:MOEZ BEN AMOR')]);assert.equal(r.excludedRecords,1);assert.equal(r.rows.length,0);
});
