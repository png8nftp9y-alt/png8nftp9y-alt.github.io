import test from 'node:test';import assert from 'node:assert/strict';
import {completeAppRankings} from '../lib/missing-match-rankings.mjs';
import {database} from './search-sqlite-fixture.mjs';
const dates={G14:'2026-10-13',G16:'2026-10-13'};
function rank(d,id,name,date,value,category='G14'){d.execute('INSERT INTO tennis_europe_ranking_history(profile_id,ranking_date,publication_id,week_label,category,ranking,display_name,normalized_name,source_url,captured_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[id,date,'pub','week',category,value,name,name.toLowerCase(),'https://example.test',date]);}
test('any newly selected player and their new singles/doubles receive current ranking in one batch without writes',async()=>{
 const d=database({identityMapping:true});try{
  for(const [id,name,value] of [['a','New Player',250],['b','Partner Person',300],['c','Opponent Person',400]])rank(d,id,name,'2026-10-13',value);
  const players=[{id:'private-new',name:'New Player',sex:'F',birthYear:2012}],matches=[{id:'new',playerId:'private-new',playerName:'New Player',partner:'Partner Person',opponent:'Opponent Person',circuit:'tennis-europe',date:'2026-10-14',event:'GD14'}];
  let queries=0;const db={prepare(sql){queries++;return d.db.prepare(sql)}};const before=d.writes();
  await completeAppRankings(db,players,matches,dates,'2026-10-14');
  assert.equal(players[0].tennisEuropeRankings.u14,250);assert.equal(matches[0].playerTeRanking,250);assert.deepEqual(matches[0].partnerTeRankings,[300]);assert.deepEqual(matches[0].opponentTeRankings,[400]);assert.equal(queries,1);assert.equal(d.writes(),before);
 }finally{d.close()}
});
test('past rankings remain dated, completed historical snapshots never change and future ranks use latest publication',async()=>{
 const d=database({identityMapping:true});try{
  rank(d,'a','New Player','2026-10-06',300);rank(d,'a','New Player','2026-10-13',250);
  const rows=[{date:'2026-10-07'},{date:'2026-10-07',playerTeRanking:999,playerTeRankingDate:'2026-10-06'},{date:'2026-10-14',playerTeRanking:300,playerTeRankingDate:'2026-10-06'}].map((m,i)=>({...m,id:String(i),playerName:'New Player',circuit:'tennis-europe',event:'GS14'}));
  await completeAppRankings(d.db,[],rows,dates,'2026-10-14');assert.deepEqual(rows.map(m=>m.playerTeRanking),[300,999,250]);assert.deepEqual(rows.map(m=>m.playerTeRankingDate),['2026-10-06','2026-10-06','2026-10-13']);
 }finally{d.close()}
});
test('ambiguous names, absent latest rank and aged-out current categories are not invented',async()=>{
 const d=database({identityMapping:true});try{
  rank(d,'a','Same Player','2026-10-13',10);rank(d,'b','Same Player','2026-10-13',20);rank(d,'old','Old Player','2026-10-06',30);rank(d,'age','Age Player','2026-10-13',40);
  const players=[{name:'Same Player',sex:'F'},{name:'Old Player',sex:'F'},{name:'Age Player',sex:'F',birthYear:2010}];
  await completeAppRankings(d.db,players,[],dates,'2026-10-14');for(const p of players)assert.equal(p.tennisEuropeRankings,undefined);
 }finally{d.close()}
});
