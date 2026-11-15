import test from 'node:test';import assert from 'node:assert/strict';
import {publishRecovery} from '../lib/itf-junior-ranking-publish.mjs';
import {recoveryPlan,failedCategory} from '../lib/itf-junior-recovery.mjs';
import {database} from './itf-junior-recovery-fixture.mjs';
const stamp='2026-11-10T18:17:00Z',row=id=>({playerId:id,rank:1,points:100,playerGivenName:'Example',playerFamilyName:'Player',playerNationalityCode:'ITA',gender:'M'});
const acquired=task=>({...task,status:'acquired',rankingDate:'2026-11-09',capturedAt:stamp,total:1,items:[row(task.category==='B'?800000001:800000002)]});
const archived=d=>d.query('SELECT * FROM itf_junior_ranking_history ORDER BY category,player_id');
test('D1_TEST_INITIAL_IMPORT: publisher verifies both categories and marks only complete data usable',async()=>{
 const d=database();try{const tasks=recoveryPlan([],stamp),result=await publishRecovery({tasks,startedAt:stamp},{...d,readResult:async c=>acquired(tasks.find(t=>t.category===c))});assert.equal(result.success,true);assert.equal((await archived(d)).length,2);assert.deepEqual(result.states.map(s=>s.phase),['complete','complete']);}finally{d.close();}
});
test('D1_TEST_IDENTICAL_ZERO_WRITES: a forced repeat writes no ranking rows or publication metadata',async()=>{
 const d=database();try{const tasks=recoveryPlan([],stamp),options={...d,readResult:async c=>acquired(tasks.find(t=>t.category===c))};await publishRecovery({tasks,startedAt:stamp},options);const rows=await archived(d),pubs=await d.query('SELECT * FROM itf_junior_ranking_publications ORDER BY category'),statements=[];await publishRecovery({tasks,startedAt:stamp},{...options,execute:async sql=>{statements.push(...sql);return d.execute(sql);}});assert.deepEqual(await archived(d),rows);assert.deepEqual(await d.query('SELECT * FROM itf_junior_ranking_publications ORDER BY category'),pubs);assert.equal(statements.filter(s=>s.startsWith('INSERT INTO itf_junior_ranking_history')).length,0);}finally{d.close();}
});
test('D1_TEST_REAL_DELTAS_ONLY: Girls successful remains untouched during a Boys recovery',async()=>{
 const d=database();try{const tasks=recoveryPlan([],stamp);const first=await publishRecovery({tasks,startedAt:stamp},{...d,readResult:async c=>c==='B'?failedCategory(tasks[0],stamp,'source failure'):acquired(tasks[1])});const before=await archived(d),next=recoveryPlan(first.states,'2026-11-10T19:17:00Z');assert.equal(next.length,1);await publishRecovery({tasks:next,startedAt:'2026-11-10T19:17:00Z'},{...d,readResult:async c=>{assert.equal(c,'B');return acquired(next[0]);}});assert.deepEqual((await archived(d)).filter(r=>r.category==='G'),before);assert.equal((await archived(d)).length,2);}finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: duplicate tasks are rejected before any statement is sent',async()=>{
 let writes=0;const task=recoveryPlan([],stamp)[0];await assert.rejects(publishRecovery({tasks:[task,task],startedAt:stamp},{execute:async()=>{writes++;},query:async()=>[],readResult:async()=>acquired(task)}),/Duplicate/);assert.equal(writes,0);
});
