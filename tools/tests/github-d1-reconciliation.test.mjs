import test from 'node:test';
import assert from 'node:assert/strict';
import {projectionComparison,catalogueComparison,relationComparison,historicalRelations} from '../../cloudflare/app-api/scripts/github-d1-reconciliation.mjs';
import {createReadOnlyD1Client} from '../../cloudflare/app-api/lib/read-only-d1-client.mjs';
test('equal counts cannot hide a missing record or differing nested score',()=>{const expected=[{id:'a',matches:[{score:'6-2'}]},{id:'b'}],actual=[{id:'a',payload:JSON.stringify({id:'a',matches:[{score:'6-3'}]})},{id:'c',payload:'{"id":"c"}'}];const r=projectionComparison(expected,actual);assert.deepEqual(r.missing,['b']);assert.deepEqual(r.different,['a']);});
test('timestamps and object key order do not cause false payload differences, substantive fields do',()=>{const expected=[{id:'a',name:'A',generatedAt:'new',items:[{lastSeen:'new',score:'6-2'}]}],actual=[{id:'a',payload:JSON.stringify({items:[{score:'6-2',lastSeen:'old'}],name:'A',generatedAt:'old',id:'a'})}];assert.deepEqual(projectionComparison(expected,actual).different,[]);actual[0].payload='{"id":"a","name":"B"}';assert.deepEqual(projectionComparison(expected,actual).different,['a']);});
test('catalogue identity is case-insensitive but does not replace a missing tournament with another',()=>{const r=catalogueComparison([{competitionId:'Ab'},{competitionId:'CD'}],[{sourceTournamentId:'AB'},{competitionId:'EF'}]);assert.equal(r.present,1);assert.equal(r.missing[0].competitionId,'CD');});
test('relations require circuit and player ID, not matching names or another player',()=>{const r=relationComparison([{circuit:'itf',playerId:'p',competitionId:'t'},{circuit:'fitp',playerId:'p',competitionId:'t'},{circuit:'itf',playerId:'q',competitionId:'t'}],[{circuit:'itf',playerId:'p',competitionId:'T'}]);assert.equal(r.present,1);assert.equal(r.missing.length,2);assert.match(r.scope,/timeline/);});
test('remote audit adapter refuses writes before making a request',async()=>{let calls=0;const c=createReadOnlyD1Client(async()=>{calls++;return[]});await assert.rejects(c.query('DELETE FROM tournaments'));assert.equal(calls,0);await c.query('SELECT id FROM tournaments WHERE id>? ORDER BY id LIMIT 200',['']);assert.equal(calls,1);});

import fs from 'node:fs/promises';
test('historical arrays and keyed maps preserve rows and reject malformed or incomplete data',()=>{
 const row={playerId:'p',competitionId:'t'};
 assert.deepEqual(historicalRelations({entries:[row]},'entries','array'),[row]);
 assert.deepEqual(historicalRelations({relations:{'p|t':row},relationCount:1},'relations','map'),[row]);
 assert.deepEqual(historicalRelations({relations:{},relationCount:0},'relations','empty'),[]);
 assert.throws(()=>historicalRelations({},'relations','absent'),/invalid_relations/);
 assert.throws(()=>historicalRelations({relations:{bad:null}},'relations','bad'),/invalid_relation_row/);
 assert.throws(()=>historicalRelations({relations:{one:row},relationCount:2},'relations','partial'),/incomplete_relations/);
});
test('all four real historical relation sources can be parsed without fabricated empty rows',async()=>{
 for(const [file,field]of [['player_tournaments','entries'],['itf_historical_player_tournaments','entries'],['itf_player_tournament_db','relations'],['tennis_europe_player_tournament_db','relations']]){
  const doc=JSON.parse(await fs.readFile(new URL('../../history/'+file+'.json',import.meta.url),'utf8'));
  const rows=historicalRelations(doc,field,file);assert.ok(rows.length>0,file);
  assert.equal(rows.length,Array.isArray(doc[field])?doc[field].length:Object.keys(doc[field]).length);
 }
});
