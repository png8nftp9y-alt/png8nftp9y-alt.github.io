import {publication,quote as q,digest,snapshotChunks} from './itf-junior-ranking-batch.mjs';
import {failedCategory,rankingCycle} from './itf-junior-recovery.mjs';
export async function publishRecovery(plan,{execute,query,readResult,runId='local',runUrl='',now=()=>new Date().toISOString()}){
let failed=false;
const state=(task,phase,extra={})=>`INSERT INTO itf_junior_ranking_recovery(category,cycle_key,phase,next_retry_at,content_hash,ranking_date,expected_count,snapshot_hash,chunk_count,last_error,updated_at) VALUES (${[task.category,task.cycle,phase,phase==='complete'?null:task.nextRetryAt,extra.contentHash,extra.rankingDate,extra.total,extra.snapshotHash,extra.chunkCount,extra.error||'',now()].map(q).join(',')}) ON CONFLICT(category) DO UPDATE SET cycle_key=excluded.cycle_key,phase=excluded.phase,next_retry_at=excluded.next_retry_at,content_hash=excluded.content_hash,ranking_date=excluded.ranking_date,expected_count=excluded.expected_count,snapshot_hash=excluded.snapshot_hash,chunk_count=excluded.chunk_count,last_error=excluded.last_error,updated_at=excluded.updated_at;`;
for(const task of plan.tasks){
 const retry=failedCategory(task,plan.retryBaseAt||plan.startedAt,'');
 let result;
 try{result=await readResult(task.category);}
 catch{
  if(task.action==='import'){
   try{const snapshot=plan.snapshots[task.category];if(digest(snapshot.json)!==snapshot.hash)throw Error('Snapshot hash mismatch');result={...task,...JSON.parse(snapshot.json),status:'acquired'};}
   catch{result=failedCategory(task,plan.startedAt,'Saved snapshot unavailable or corrupt');}
  }else result=failedCategory(task,plan.startedAt,'Acquisition interrupted or result artifact unavailable');
 }
 if(result.status!=='acquired'){
  failed=true;await execute([state(retry,'failed',{error:result.error||'Acquisition failed'})]);continue;
 }
 let checked,checkpointSaved=task.action==='import';
 try{
  checked=publication(task.category,result.rankingDate,result.items,result.total,result.capturedAt);
  if(task.action!=='import'){
   const text=JSON.stringify({rankingDate:result.rankingDate,total:result.total,items:checked.items,capturedAt:result.capturedAt});
   const hash=digest(text),chunks=snapshotChunks(text);
   const statements=chunks.map((chunk,index)=>`INSERT INTO itf_junior_ranking_recovery_chunks VALUES (${[task.category,task.cycle,hash,index,chunk].map(q).join(',')}) ON CONFLICT DO NOTHING;`);
   statements.push(state(retry,'acquired',{...checked,snapshotHash:hash,chunkCount:chunks.length}));
   await execute(statements);checkpointSaved=true;
   await execute([`DELETE FROM itf_junior_ranking_recovery_chunks WHERE category=${q(task.category)} AND NOT(cycle_key=${q(task.cycle)} AND snapshot_hash=${q(hash)});`]);
  }
  await execute(checked.statements);
  const rows=await query(`SELECT complete,expected_count,(SELECT COUNT(*) FROM itf_junior_ranking_history WHERE ${checked.key}) AS acquired FROM itf_junior_ranking_publications WHERE ${checked.key}`);
  if(rows.length!==1||Number(rows[0].complete)!==1||Number(rows[0].expected_count)!==checked.total||Number(rows[0].acquired)!==checked.total)throw Error('D1 ranking verification failed');
  await execute([state(retry,'complete',checked)]);
  try{await execute([`DELETE FROM itf_junior_ranking_recovery_chunks WHERE category=${q(task.category)};`]);}catch(error){console.warn('Verified ranking retained; checkpoint cleanup deferred: '+error.message);}
 }catch(error){
  failed=true;console.error(task.category+': '+error.message);
  if(checkpointSaved&&checked){
   await execute([`UPDATE itf_junior_ranking_recovery SET last_error=${q(String(error.message).slice(0,1000))},next_retry_at=${q(retry.nextRetryAt)},updated_at=${q(now())} WHERE category=${q(task.category)};`]);
  }else await execute([state(retry,'failed',{error:error.message})]);
 }
}
const states=await query('SELECT category,cycle_key,phase,next_retry_at,last_error,ranking_date,expected_count FROM itf_junior_ranking_recovery');
const success=states.length===2&&states.every(s=>s.phase==='complete'&&s.cycle_key===rankingCycle(plan.startedAt));
const run=runId,url=runUrl;
await execute([`INSERT INTO itf_junior_ranking_attempts VALUES (${[run,now(),success?'success':'failure',JSON.stringify(states),url].map(q).join(',')}) ON CONFLICT(run_id) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,detail=excluded.detail;`]);
return {success:success&&!failed,states};
}
