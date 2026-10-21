import test from 'node:test';import assert from 'node:assert/strict';
import {syncAcquiredSearch} from '../scripts/sync-acquired-player-search.mjs';
import {documentRecord,documentSQL} from '../../../src/v3/itf-draw-document-d1.mjs';
import {database} from './search-sqlite-fixture.mjs';
const doc={competitionId:'J-J30-TST-2026-001',event:'B-S-M-KO',status:'complete',generatedAt:'2026-10-01T00:00:00Z',players:[{name:'Search Only',id:'800671267',nationality:'NED'}],matches:[{teams:[{players:[{name:'Search Only',id:'800671267',nationality:'NED'}]},{players:[{name:'Other Person'}]}]}]};
async function seed(d,data=doc){await d.query(documentSQL(documentRecord(data)).join('\n'));}
test('D1_TEST_INITIAL_IMPORT: complete D1 document players searchable without participant cache',async()=>{const d=database();try{await seed(d);const a=await syncAcquiredSearch(d.query);assert.equal(a.documentsProcessed,1);assert.equal(d.execute('SELECT * FROM search_acquired_players').length,2);assert.equal(d.execute('SELECT * FROM search_draw_indexed_versions').length,1)}finally{d.close()}});
test('D1_TEST_IDENTICAL_ZERO_WRITES: rerun skips content reads and all D1 mutations',async()=>{const d=database();try{await seed(d);await syncAcquiredSearch(d.query);const n=d.writes(),queries=[];const a=await syncAcquiredSearch(async sql=>{queries.push(sql);return d.query(sql)});assert.equal(d.writes(),n);assert.equal(a.playerWritesRequested,0);assert.equal(a.documentsProcessed,0);assert.ok(!queries.some(q=>/SELECT chunk/.test(q)))}finally{d.close()}});
test('D1_TEST_REAL_DELTAS_ONLY: newest complete version adds new player once and retains old identity',async()=>{const d=database();try{await seed(d);await syncAcquiredSearch(d.query);await seed(d,{...doc,generatedAt:'2026-10-02T00:00:00Z',players:[...doc.players,{name:'New Ordinary Player'}]});const a=await syncAcquiredSearch(d.query);assert.equal(a.documentsProcessed,1);assert.equal(a.playerWritesRequested,1);assert.equal(d.execute('SELECT * FROM search_acquired_players').length,3)}finally{d.close()}});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: corrupt chunks never certify a processed source',async()=>{const d=database();try{await seed(d);d.execute("UPDATE itf_draw_document_chunks SET content='broken'");await assert.rejects(syncAcquiredSearch(d.query),/hash\/size/);assert.equal(d.execute('SELECT * FROM search_draw_indexed_versions').length,0);assert.equal(d.execute('SELECT * FROM search_acquired_players').length,0)}finally{d.close()}});


test('hourly catch-up indexes intermediate ITF versions and never drops their unique players',async()=>{
 const d=database();try{
  const version=(n)=>({...doc,generatedAt:'2026-10-20T'+String(n).padStart(2,'0')+':00:00Z',players:[{name:'Version Player '+n,id:'8006712'+String(n).padStart(2,'0')}],matches:[{teams:[{players:[{name:'Version Player '+n,id:'8006712'+String(n).padStart(2,'0')}]},{players:[{name:'Opponent'}]}]}]});
  await seed(d,version(1));await seed(d,version(2));
  const result=await syncAcquiredSearch(d.query);assert.equal(result.documentsProcessed,2);
  assert.deepEqual(d.execute("SELECT display_name FROM search_acquired_players WHERE official_id<>'' ORDER BY display_name").map(r=>r.display_name),['Version Player 1','Version Player 2']);
  const writes=d.writes();assert.equal((await syncAcquiredSearch(d.query)).documentsProcessed,0);assert.equal(d.writes(),writes);
 }finally{d.close()}
});
test('catch-up paginates more than twenty versions and resumes after interruption without losing documents',async()=>{
 const d=database();try{
  for(let n=0;n<23;n++)await seed(d,{...doc,generatedAt:'2026-10-20T'+String(n).padStart(2,'0')+':00:00Z',players:[...doc.players,{name:'Retained '+n}]});
  let checkpoints=0;await assert.rejects(syncAcquiredSearch(async sql=>{if(sql.includes('INSERT INTO search_draw_indexed_versions')&&++checkpoints===1)throw Error('checkpoint unavailable');return d.query(sql)}),/checkpoint unavailable/);
  assert.equal(d.execute('SELECT COUNT(*) AS n FROM search_draw_indexed_versions')[0].n,0);
  const result=await syncAcquiredSearch(d.query);assert.equal(result.documentsProcessed,23);assert.equal(d.execute('SELECT COUNT(*) AS n FROM search_draw_indexed_versions')[0].n,23);
  assert.equal(d.execute("SELECT COUNT(*) AS n FROM search_acquired_players WHERE display_name LIKE 'Retained %'")[0].n,23);
 }finally{d.close()}
});
