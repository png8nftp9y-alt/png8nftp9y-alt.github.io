import test from 'node:test';import assert from 'node:assert/strict';
import {publication} from '../lib/itf-junior-ranking-batch.mjs';
import {database} from './itf-junior-recovery-fixture.mjs';
const stamp='2026-11-09T18:17:00Z',row=(id,rank=1)=>({playerId:id,rank,points:100/rank,playerGivenName:"D'Angelo",playerFamilyName:'Example',playerNationalityCode:'ITA',gender:'M'});
const stored=(db,key)=>db.query('SELECT player_id,ranking,points,display_name,nationality,source_gender FROM itf_junior_ranking_history WHERE '+key);
test('D1_TEST_INITIAL_IMPORT: all verified rows reach the real SQLite archive',async()=>{
 const d=database();try{const p=publication('B','2026-11-09',[row(800000001),row(800000002,2)],2,stamp);assert.equal(p.syncPlan.writes,2);await d.execute(p.statements);assert.equal((await stored(d,p.key)).length,2);assert.equal((await d.query('SELECT complete FROM itf_junior_ranking_publications'))[0].complete,1);}finally{d.close();}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: identical verified publication has no delta and zero SQLite writes',async()=>{
 const d=database();try{const items=[row(800000001)],p=publication('B','2026-11-09',items,1,stamp);await d.execute(p.statements);const next=publication('B','2026-11-09',items,1,'2026-11-10T18:17:00Z',{current:await stored(d,p.key)});assert.equal(next.syncPlan.writes,0);assert.equal(next.statements.filter(s=>s.includes('INSERT INTO itf_junior_ranking_history')).length,0);assert.equal((await d.execute(next.statements)).changes,0);}finally{d.close();}
});
test('D1_TEST_REAL_DELTAS_ONLY: partial import resumes just missing IDs; newer version preserves old rows',async()=>{
 const d=database();try{const items=[row(800000001),row(800000002,2)],p=publication('B','2026-11-09',items,2,stamp);await d.execute(p.statements.slice(0,2));const resumed=publication('B','2026-11-09',items,2,stamp,{current:await stored(d,p.key)});assert.equal(resumed.syncPlan.writes,1);assert.equal(resumed.syncPlan.unchanged.length,1);await d.execute(resumed.statements);const next=publication('B','2026-11-16',[row(800000001,9)],1,stamp);await d.execute(next.statements);assert.equal((await stored(d,p.key)).length,2);assert.equal((await stored(d,next.key))[0].ranking,9);}finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: incomplete source, duplicate identity and immutable conflict fail before writes',async()=>{
 assert.throws(()=>publication('B','2026-11-09',[row(800000001)],2,stamp),/incomplete/);
 assert.throws(()=>publication('B','2026-11-09',[row(800000001),row(800000001)],2,stamp),/duplicate/);
 const d=database();try{const p=publication('B','2026-11-09',[row(800000001)],1,stamp);await d.execute(p.statements);const current=await stored(d,p.key);current[0].ranking=99;assert.throws(()=>publication('B','2026-11-09',[row(800000001)],1,stamp,{current}),/immutable/);assert.equal((await stored(d,p.key))[0].ranking,1);}finally{d.close();}
});
