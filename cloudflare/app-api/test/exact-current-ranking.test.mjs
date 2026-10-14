import test from 'node:test';
import assert from 'node:assert/strict';
import {exactCurrentRankingRows} from '../lib/exact-current-ranking.mjs';
import {database} from './search-sqlite-fixture.mjs';

test('reversed full names find the same profile without scanning a surname or borrowing another profile',async()=>{
 const d=database({identityMapping:true});
 try {
  for(const [id,name,rank] of [['target','dirnbek ivona',388],['other','dirnbek eva',17]])
   d.execute('INSERT INTO tennis_europe_ranking_history(profile_id,ranking_date,publication_id,week_label,category,ranking,display_name,normalized_name,source_url,captured_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[id,'2026-10-13','pub','week','G14',rank,name,name,'https://example.test','2026-10-13']);
  const before=d.writes();
  const rows=await exactCurrentRankingRows(d.db,{name:'Ivona Dirnbek'});
  assert.deepEqual(rows.map(r=>r.profile_id),['target']);
  assert.deepEqual(await exactCurrentRankingRows(d.db,{name:'Missing Dirnbek'}),[]);
  assert.deepEqual(await exactCurrentRankingRows(d.db,{name:'Dirnbek'}),[]);
  d.execute('INSERT INTO tennis_europe_ranking_history(profile_id,ranking_date,publication_id,week_label,category,ranking,display_name,normalized_name,source_url,captured_at) VALUES(?,?,?,?,?,?,?,?,?,?)',['homonym','2026-10-13','pub','week','G14',22,'Ivona Dirnbek','ivona dirnbek','https://example.test','2026-10-13']);
  assert.deepEqual(await exactCurrentRankingRows(d.db,{name:'Ivona Dirnbek'}),[]);
  assert.equal(d.writes(),before+1);
 } finally {d.close();}
});

test('confirmed aliases retain their rankings and database failures remain failures',async()=>{
 const calls=[],row={profile_id:'native',category:'G14',ranking:20,ranking_date:'2026-10-13'};
 const db={prepare(sql){return{bind(...values){calls.push({sql,values});return{all:async()=>({results:[row]})}}}}};
 assert.deepEqual(await exactCurrentRankingRows(db,{playerId:'known',name:'Person Test'}),[row]);
 assert.equal(calls.length,1);
 const broken={prepare(){return{bind(){return{all:async()=>{throw Error('D1 failure')}}}}}};
 await assert.rejects(exactCurrentRankingRows(broken,{name:'Person Test'}),/D1 failure/);
});
