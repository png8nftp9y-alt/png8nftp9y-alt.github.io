import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
// D1_WRITE_POLICY: incremental. Inspect only the failed write's exact keys, then
// apply the missing delta once. No retry loop, delay, run start or source refetch.
export function recoverableFitpWrite(error){if(['authorization','sql_rejected','constraint'].includes(error.d1Failure?.reason))return false;return /fitp_d1_(?:phase_\w+:fitp_d1_http_5\d\d|phase_\w+:fitp_d1_query_failed:codes_7500|timeout:|network:|incomplete_batch_response)/.test(error.message||'');}
const parseRows=(raw)=>{const rows=JSON.parse(raw);if(!Array.isArray(rows))throw Error('fitp_invalid_reconciliation_rows');return rows;};
export async function missingFitpWrites(query,statements,{metadataSql,failureSql,deleteSql,progressSql}){
 const pending=[];
 for(const statement of statements){
  const {sql,params}=statement;
  if(sql===metadataSql){
   const incoming=parseRows(params[1]);
   const current=await query('SELECT membership_card,canonical_id,club,ranking FROM fitp_player_metadata WHERE membership_card IN (SELECT value FROM json_each(?))',[JSON.stringify(incoming.map(r=>r.membership_card))]);
   const plan=buildIncrementalSyncPlan({current,incoming,keyOf:r=>r.membership_card,sourceComplete:true});
   const delta=[...plan.inserts,...plan.updates.map(u=>u.after)];
   for(let i=0;i<delta.length;i+=20)pending.push({sql,params:[params[0],JSON.stringify(delta.slice(i,i+20))],phase:'metadata_delta'});
  }else if(sql===failureSql){
   const incoming=parseRows(params[1]);
   const current=await query('SELECT membership_card,canonical_id,error FROM fitp_metadata_failures WHERE cycle=? AND membership_card IN (SELECT value FROM json_each(?))',[params[0],JSON.stringify(incoming.map(r=>r.membership_card))]);
   const plan=buildIncrementalSyncPlan({current,incoming,keyOf:r=>r.membership_card,sourceComplete:true});
   const delta=[...plan.inserts,...plan.updates.map(u=>u.after)];
   for(let i=0;i<delta.length;i+=20)pending.push({sql,params:[params[0],JSON.stringify(delta.slice(i,i+20))],phase:'failure_delta'});
  }else if(sql===deleteSql){
   const current=await query('SELECT membership_card FROM fitp_metadata_failures WHERE cycle=? AND membership_card IN (SELECT value FROM json_each(?))',params);
   if(current.length)pending.push({sql,params:[params[0],JSON.stringify(current.map(r=>r.membership_card))],phase:'failure_cleanup'});
  }else if(sql===progressSql){
   const row=(await query('SELECT * FROM fitp_metadata_progress WHERE cycle=?',[params[0]]))[0];
   const fields=['cycle','last_card','complete','checked','with_club','with_ranking','unavailable'];
   if(row&&(Number(row.checked)>params[3]||row.last_card>params[1]||Number(row.complete)>params[2]))throw Error('fitp_checkpoint_advanced_elsewhere');
   if(!row||fields.some((field,i)=>row[field]!==params[i]))pending.push({...statement,phase:'checkpoint'});
  }else throw Error('fitp_unknown_reconciliation_statement');
 }
 return pending;
}
export async function reconcileFitpWrites({query,write,statements,kinds,log=()=>{}}){
 const missing=await missingFitpWrites(query,statements,kinds);
 if(!missing.length){log({status:'d1_write_reconciled',correctiveRequests:0,verifiedStatements:statements.length});return;}
 let failure;
 // One corrective pass. Even an unknown acknowledgement is read back, never blindly replayed.
 for(const statement of missing){try{await write(statement.sql,statement.params,statement.phase)}catch(error){failure=error;break}}
 const remaining=await missingFitpWrites(query,statements,kinds);
 if(remaining.length)throw failure||Error('fitp_d1_reconciliation_incomplete_resume_manually');
 log({status:'d1_write_reconciled',correctiveRequests:missing.length,verifiedStatements:statements.length});
}

// Interpret provider error text in memory, but expose only fixed labels and a
// validated request identifier. Raw messages may contain SQL or personal data.
export function fitpD1FailureInfo({phase,httpStatus,codes=[],messages=[],ray,transportReason}={}){
 const text=messages.filter(m=>typeof m==='string').join(' ').slice(0,32000);
 const reason=['network','timeout'].includes(transportReason)?transportReason:
 /not authorized|unauthori[sz]ed|authentication|permission denied|access denied/i.test(text)?'authorization':
 /overloaded|too many requests|rate.?limit|queued for too long/i.test(text)?'overloaded':
 /reset|restart|replica disconnected|starting up.*storage/i.test(text)?'database_reset':
 /CPU|memory|maximum.*size|time limit|exceeded.*limit/i.test(text)?'resource_limit':
 /constraint|NOT NULL|UNIQUE.*failed|FOREIGN KEY/i.test(text)?'constraint':
 /syntax|no such (?:table|column)|bind|parameter.*(?:count|number|type)/i.test(text)?'sql_rejected':'unknown';
 return{phase:/^[a-z_]{1,32}$/.test(phase||'')?phase:'unknown',...(Number.isInteger(httpStatus)?{httpStatus}:{}),codes:codes.filter(Number.isFinite).slice(0,10),reason,...(/^[a-f0-9]{16}-[a-z]{3}$/i.test(ray||'')?{cfRay:ray}:{})};
}
