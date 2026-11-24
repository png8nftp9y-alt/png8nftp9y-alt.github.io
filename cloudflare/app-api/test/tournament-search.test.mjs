import test from 'node:test';import assert from 'node:assert/strict';
import {buildTournamentSearchIndex,searchTournaments} from '../lib/tournament-search.mjs';
const paths=['source_fitp_tournaments.json','source_tennis_europe_tournaments_sharded.json','source_itf_history_tournaments.json','source_itf_tournaments.json'];
let version=0;
function reader(rows){const stamp=String(++version);return{release:async()=>({documents:[...paths.map(p=>'dist/v3/'+p),'history/itf_official_metadata.json'].map(path=>({path,hash:stamp}))}),get:async path=>path==='history/itf_official_metadata.json'?{tournaments:{ITF1:{venueName:'Académie Centrale',address:'Via Test 12'}}}:{tournaments:path.endsWith(paths[0])?rows:path.endsWith(paths[3])?[{competitionId:'ITF1',tournamentName:'J30 Cuneo',location:'Cuneo',startDate:'2026-11-24',endDate:'2026-11-30'}]:[]}};}
const row={competitionId:'F1',name:'Super Next Gen',club:'Circolo Città Bianca',city:'Monza',startDate:'2026-11-21',endDate:'2026-11-27'};
test('catalogue searches club, city, name, accented words and dates inside an event, without participant requirements',async()=>{
 const r=reader([row]);for(const q of ['citta bianca','monza','super next','24/11/2026','2026-11-24','novembre'])assert.ok((await searchTournaments(r,{query:q})).results.some(t=>t.competitionId==='F1'),q);
 assert.equal((await searchTournaments(r,{query:'inesistente'})).results.length,0);
 assert.equal((await searchTournaments(r,{query:'centrale'})).results[0].competitionId,'ITF1');
 assert.equal((await searchTournaments(r,{competitionId:'f1',circuit:'fitp'})).tournament.name,row.name);
 assert.equal((await searchTournaments(r,{competitionId:'f1',circuit:'itf'})).tournament,null);
});
test('all results remain reachable with bounded pages and stable ordering',async()=>{
 const r=reader(Array.from({length:123},(_,i)=>({...row,competitionId:'F'+String(i).padStart(3,'0')})));
 const ids=[];let cursor='';do{const page=await searchTournaments(r,{query:'monza',cursor});assert.ok(page.results.length<=50);ids.push(...page.results.map(t=>t.competitionId));cursor=page.nextCursor;}while(cursor);
 assert.equal(ids.length,123);assert.equal(new Set(ids).size,123);await assert.rejects(()=>searchTournaments(r,{query:'monza',cursor:'-1'}));
});
test('catalogue deduplicates history/live and never substitutes a failed catalogue with empty success',()=>{
 assert.equal(buildTournamentSearchIndex([['itf',{tournaments:[row]}],['itf',{tournaments:[row]}]]).length,1);
 assert.throws(()=>buildTournamentSearchIndex([['itf',{}]]));
});
test('endpoint authenticates before reading any catalogue',async()=>{
 const {default:worker}=await import('../src/index.js');let calls=0;
 const response=await worker.fetch(new Request('https://app.test/app-api/tournament-search?q=Monza'),{DB:{prepare(){calls++;throw Error('unexpected read');}}});
 assert.equal(response.status,401);assert.equal(calls,0);
});
