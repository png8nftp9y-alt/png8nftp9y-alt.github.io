import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {mergeHistoricalCatalogue} from '../../src/v3/historical-tournament-catalogue.mjs';
const doc={tournaments:[{competitionId:'ABC',startDate:'2026-01-01',tournamentName:'Archive'}]};
test('catalogue survives without player entries and preserves richer projections case-insensitively',()=>{
 const projected={id:'existing',circuit:'fitp',sourceTournamentId:'abc',name:'Current',status:'accepted'};
 assert.deepEqual(mergeHistoricalCatalogue([projected],[['fitp',doc]]),[projected]);
 const rows=mergeHistoricalCatalogue([],[['fitp',doc]]);assert.equal(rows.length,1);assert.equal(rows[0].sourceTournamentId,'ABC');assert.equal(rows[0].status,'catalogued');
 assert.deepEqual(mergeHistoricalCatalogue(rows,[['fitp',doc]]),rows);
 assert.deepEqual(mergeHistoricalCatalogue([],[['fitp',doc],['fitp',{tournaments:doc.tournaments.map(r=>({...r,lastCatalogSeenAt:'later'}))}]]),rows);
});
test('malformed/missing catalogue fails rather than deleting archived rows',()=>{
 for(const value of [{},{tournaments:[]},{tournaments:[{}]},{tournaments:[{competitionId:'a',circuit:'itf'}]},{tournaments:[{competitionId:'a',startDate:'bad'}]}])assert.throws(()=>mergeHistoricalCatalogue([],[['fitp',value]]));
});
test('actual FITP and Europe catalogues retain every source identifier without creating player relations',async()=>{
 const sources=await Promise.all([['fitp','history/fitp_tournament_archive.json'],['tennis-europe','history/tennis_europe_tournament_catalog.json']].map(async([c,p])=>[c,JSON.parse(await fs.readFile(new URL('../../'+p,import.meta.url),'utf8'))]));
 const rows=mergeHistoricalCatalogue([],sources),keys=new Set(rows.map(r=>r.circuit+'|'+r.sourceTournamentId));
 for(const [c,d]of sources)for(const r of Object.values(d.tournaments))assert.ok(keys.has(c+'|'+r.competitionId.toUpperCase()));
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);assert.ok(rows.every(r=>!r.playerId));
});
