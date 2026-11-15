import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {database} from './itf-junior-recovery-fixture.mjs';
import {database as appDatabase} from './search-sqlite-fixture.mjs';
import {publication} from '../lib/itf-junior-ranking-batch.mjs';
import {publishPartialRanking} from '../lib/itf-junior-ranking-partial.mjs';
import {readItfRankingTargets} from '../lib/itf-junior-ranking-reader.mjs';
import {enrichItfJuniorRankings} from '../lib/itf-junior-ranking-enrichment.mjs';
import {renderItfRankingDiagnostics,renderItfRankingCoverage} from '../lib/admin-itf-junior-rankings.mjs';
import worker from '../src/index.js';
const stamp='2026-11-15T14:00:00Z',row=(id,rank=1)=>({playerId:id,rank,points:100/rank,playerGivenName:'Example',playerFamilyName:'Player',playerNationalityCode:'ITA',gender:'M'});
const partial=(items,date='2026-11-09',category='B')=>({category,rankingDate:date,total:1000,capturedAt:stamp,items,status:'partial',error:'incapsula_challenge'});
const adapter=d=>({prepare(sql){return{bind(...params){return{all:async()=>({results:await d.query(sql,params)})}}};}});
const target=(id,date=null)=>({playerId:String(id),category:'B',...(date?{matchDate:date}:{})});
test('match date uses closest publication, including later dates, and ties prefer the earlier publication',async()=>{
 const d=database();try{
  await d.execute(publication('B','2026-11-02',[row(800000001,500)],1,stamp).statements);
  await d.execute(publication('B','2026-11-09',[row(800000001,300)],1,stamp).statements);
  const values=await readItfRankingTargets(adapter(d),[target(800000001,'2026-11-07'),target(800000001,'2026-10-01'),target(800000001)]);
  assert.equal(values[0].ranking,300);assert.equal(values[0].rankingDate,'2026-11-09');assert.equal(values[1].rankingDate,'2026-11-02');assert.equal(values[2].rankingDate,'2026-11-09');
  await d.execute(publication('B','2026-11-04',[row(800000001,400)],1,stamp).statements);
  assert.equal((await readItfRankingTargets(adapter(d),[target(800000001,'2026-11-03')]))[0].rankingDate,'2026-11-02');
 }finally{d.close();}
});
test('unknown player in latest partial keeps older dated ranking; a complete absence subsequently clears it',async()=>{
 const d=database();try{
  await d.execute(publication('B','2026-11-02',[row(800000001,400)],1,stamp).statements);
  await publishPartialRanking(partial([row(800000002,321)]),d);
  let [rank]=await readItfRankingTargets(adapter(d),[target(800000001)]);assert.equal(rank.ranking,400);assert.equal(rank.rankingDate,'2026-11-02');assert.equal(rank.latestRankingDate,'2026-11-09');assert.equal(rank.latestIncomplete,true);
  await d.execute(publication('B','2026-11-09',[row(800000002,1)],1,stamp).statements);
  [rank]=await readItfRankingTargets(adapter(d),[target(800000001)]);assert.equal(rank.ranking,null);assert.equal(rank.status,'unranked');
 }finally{d.close();}
});
test('different partial attempts retain previously verified identities; native-ID homonyms cannot receive another ranking',async()=>{
 const d=database();try{
  await publishPartialRanking(partial([row(800000001,321)]),d);
  await publishPartialRanking({...partial([row(800000002,322)]),capturedAt:'2026-11-15T15:00:00Z'},d);
  const people=[{id:'self',name:'Same Name',worldTennisId:'800000001',sex:'M'},{id:'homonym',name:'Same Name',worldTennisId:'800000099',sex:'M'}];
  await enrichItfJuniorRankings(adapter(d),people);
  assert.equal(people[0].itfJuniorRanking.ranking,321);assert.equal(people[1].itfJuniorRanking.ranking,null);assert.equal(people[1].itfJuniorRanking.status,'pending');
 }finally{d.close();}
});
test('future ITF doubles match and opponent history rank all exact participant IDs using the match date',async()=>{
 const d=database();try{
  await publishPartialRanking(partial([1,2,3,4].map(n=>row(800000000+n,300+n))),d);
  await d.execute(['CREATE TABLE match_participants(match_id TEXT,source_player_id TEXT,team_index INTEGER,participant_key TEXT);',...[1,2,3,4].map((n,i)=>`INSERT INTO match_participants VALUES ('itf-test','${800000000+n}',${i<2?0:1},'${i}');`)]);
  const person={id:'self',worldTennisId:'800000001'},m={matchId:'itf-test',playerId:'self',circuit:'itf',event:'B-D-M',date:'2026-11-07'};
  const history=[{circuit:'itf',matches:[{date:'2026-11-07',event:'B-D-M',partners:[{profileId:'800000002'}],opponents:[{profileId:'800000003'},{profileId:'800000004'}]}]}];
  await enrichItfJuniorRankings(adapter(d),[person],[m],history);
  assert.equal(m.playerItfRanking.ranking,301);assert.deepEqual(m.partnerItfRankings.map(r=>r.ranking),[302]);assert.deepEqual(m.opponentItfRankings.map(r=>r.ranking),[303,304]);assert.equal(m.playerItfRanking.rankingDate,'2026-11-09');assert.equal(history[0].matches[0].opponents[0].itfJuniorRanking.ranking,303);
 }finally{d.close();}
});
const ui=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
const slice=(a,b)=>ui.slice(ui.indexOf(a),ui.indexOf(b,ui.indexOf(a)));
function view(){const ctx={displayDate:d=>d,esc:String,readableText:String,Date};vm.createContext(ctx);vm.runInContext(slice('const itfRankingText =','const playerRankingSummary =')+slice('function currentRankingCategoryAllowed(','async function loadCurrentPlayerRanking(')+slice('function opponentEuropeRankingText(','function renderOpponentHistory('),ctx);return ctx;}
test('real Worker player-ranking endpoint exposes persisted partial rank and actual UI labels display it, without writes',async()=>{
 const d=appDatabase({identityMapping:true});try{
  await d.query(readFileSync(new URL('../lib/itf-junior-ranking-schema.sql',import.meta.url),'utf8'));
  const p={canonicalId:'person:ranking-test',name:'Example Player',worldTennisId:'800000001',sex:'M'};
  d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[p.canonicalId,'EXAMPLE PLAYER',JSON.stringify(p)]);
  d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',['itf-test',p.canonicalId,'EXAMPLE PLAYER','itf','800000001','EXAMPLE PLAYER',p.name]);
  await publishPartialRanking(partial([row(800000001,321)]),{query:sql=>d.query(sql),execute:sql=>d.query(sql.join('\n'))});
  const before=d.writes(),response=await worker.fetch(new Request('https://app.test/app/api/player-ranking?playerId=person:ranking-test&name=Example%20Player',{headers:{'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'}}),{DB:d.db});
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.itfJuniorRanking.ranking,321);assert.equal(data.itfJuniorRanking.partial,true);assert.equal(d.writes(),before);
  const ctx=view(),labels=ctx.currentPlayerRankingLabels({itfJuniorRanking:data.itfJuniorRanking},[]).join(' ');assert.match(labels,/n°321 ITF Junior/);assert.doesNotMatch(labels,/2026-11-09|parziale|incompleto/);
  const opponentLabel=ctx.opponentEuropeRankingText({itfJuniorRanking:data.itfJuniorRanking});assert.match(opponentLabel,/n°321 ITF Junior/);assert.match(opponentLabel,/ranking del 2026-11-09/);assert.doesNotMatch(opponentLabel,/parziale|incompleto/);
 }finally{d.close();}
});
test('UI distinguishes pending partial data from confirmed unranked status and clears stale opponent cache',()=>{
 const ctx=view();
 assert.doesNotMatch(ctx.opponentEuropeRankingText({itfJuniorRanking:{ranking:null,status:'pending'}}),/non classificato/);
 assert.match(ctx.opponentEuropeRankingText({itfJuniorRanking:{ranking:null,status:'unranked',rankingDate:'2026-11-09'}}),/non classificato/);
 ctx.circuit=t=>t.circuit||'itf';vm.runInContext(slice('function mergeOpponentHistory(','async function fetchOpponentHistory('),ctx);
 const fresh=ctx.mergeOpponentHistory({profile:{itfJuniorRanking:{ranking:321}},tournaments:[]},{profile:{itfJuniorRanking:null},tournaments:[]});assert.equal(fresh.profile.itfJuniorRanking,null);
 vm.runInContext(slice('function mergeProgressiveRankingFields(','function applyPendingProgressiveRankings('),ctx);
 const state={players:[{id:'p',itfJuniorRanking:{ranking:1}}],matches:[{id:'m',playerId:'p',playerItfRanking:{ranking:1}}]};
 assert.equal(ctx.mergeProgressiveRankingFields(state,{players:[{id:'p',itfJuniorRanking:{ranking:null,status:'unranked'}}],matches:[{id:'m',playerId:'p',playerItfRanking:{ranking:321,partial:true}}]}),true);assert.equal(state.players[0].itfJuniorRanking.ranking,null);assert.equal(state.matches[0].playerItfRanking.ranking,321);
});
test('diagnostics reports partial availability separately from the pending recovery',async()=>{
 const d=database();try{await publishPartialRanking(partial([row(800000001,321)]),d);await d.execute(["INSERT INTO itf_junior_ranking_recovery(category,cycle_key,phase,next_retry_at,last_error,updated_at) VALUES ('B','cycle','failed','2026-11-15T15:17:00Z','incapsula_challenge','now');"]);const html=await renderItfRankingDiagnostics(adapter(d));assert.match(html,/Parziale/);assert.match(html,/2026-11-09/);assert.match(html,/incapsula_challenge/);assert.match(html,/15:17/);}finally{d.close();}
});
test('FITP numeric profile IDs and conflicting ITF identities never borrow a ranking',async()=>{
 const d=database();try{
  await publishPartialRanking(partial([row(800000001,321)]),d);
  const people=[{id:'fitp',sourceCircuit:'fitp',profileId:'800000001',sex:'M'},{id:'conflict',worldTennisId:'800000001',circuitProfiles:[{circuit:'itf',url:'https://www.world.tennis/en/players/another/800000002/ita/jt/s/'}]}];
  await enrichItfJuniorRankings(adapter(d),people);
  assert.equal(people[0].itfJuniorRanking,null);assert.equal(people[1].itfJuniorRanking,null);
 }finally{d.close();}
});
test('before partial schema migration, read-only audits encounter zero failed SQL statements and retain complete rankings',async()=>{
 const d=database();try{
  await d.execute(publication('B','2026-11-09',[row(800000001,321)],1,stamp).statements);
  await d.execute(['DROP TABLE itf_junior_ranking_partial_publications;']);let failed=0;
  const db={prepare(sql){return {bind(...params){return {all:async()=>{try{return {results:await d.query(sql,params)}}catch{failed++;throw Error('diagnostic_d1_request_failed:http_400:codes_7500')}}}}}}};
  const [value]=await readItfRankingTargets(db,[target(800000001)]);assert.equal(value.ranking,321);
  const html=await renderItfRankingDiagnostics(db);assert.match(html,/Completa/);assert.equal(failed,0);
  await assert.rejects(readItfRankingTargets({prepare(){throw Error('Real database failure')}},[target(800000001)]),/Real database failure/);
 }finally{d.close();}
});

test('ITF player labels omit dates and acquisition status; opponent labels retain the actual ranking date',()=>{
 const ctx=view();
 for(const flags of [{partial:true},{latestIncomplete:true},{}]){
  const value={ranking:321,status:'ranked',rankingDate:'2026-11-09',...flags};
  const player=ctx.currentPlayerRankingLabels({itfJuniorRanking:value},[]).join(' ');
  assert.equal(player,'n°321 ITF Junior');
  const opponent=ctx.opponentEuropeRankingText({itfJuniorRanking:value});
  assert.equal(opponent,'n°321 ITF Junior · (ranking del 2026-11-09)');
 }
 const player=ctx.currentPlayerRankingLabels({itfJuniorRanking:{ranking:null,status:'unranked',rankingDate:'2026-11-09'}},[]).join(' ');assert.doesNotMatch(player,/2026-11-09/);
 assert.doesNotMatch(ctx.opponentEuropeRankingText({itfJuniorRanking:{status:'pending'}}),/parziale/);
});

test('ITF coverage shows only the newest publication date, deduplicates ready partials and waits for the other category',async()=>{
 const d=database();try{
  await d.execute(publication('B','2026-11-09',[row(800000001)],1,stamp).statements);
  await publishPartialRanking({...partial([row(800000002)],'2026-11-09','G'),total:3},d);
  await publishPartialRanking({...partial([row(800000002),row(800000003,2)],'2026-11-09','G'),total:3},d);
  let html=await renderItfRankingCoverage(adapter(d));assert.match(html,/09\/11\/2026/);assert.match(html,/2 \/ 3 acquisite/);assert.match(html,/<td>1<\/td>/);assert.match(html,/1 \/ 1 acquisite/);
  await publishPartialRanking({...partial([row(800000004)],'2026-11-16','B'),total:5891},d);
  html=await renderItfRankingCoverage(adapter(d));assert.match(html,/16\/11\/2026/);assert.match(html,/1 \/ 5891 acquisite/);assert.match(html,/<td>5890<\/td>/);assert.match(html,/0 \/ — acquisite/);assert.match(html,/In attesa di acquisizione/);assert.doesNotMatch(html,/09\/11\/2026|2 \/ 3 acquisite/);
  await d.execute(publication('G','2026-11-16',[row(800000005)],1,stamp).statements);html=await renderItfRankingCoverage(adapter(d));assert.match(html,/1 \/ 1 acquisite/);
 }finally{d.close();}
});
test('coverage stays between ITF metadata and draws, with reads restricted to the ITF view',()=>{
 const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');assert.ok(source.includes("view==='itf'?await renderItfRankingCoverage(env.DB):''"));
 const placement="${renderMetadataQueue(docs['itf_metadata_queue_status.json'],esc,age)}${itfRankingCoveragePanel}${itfQueueSection}";assert.ok(source.includes(placement));
});
