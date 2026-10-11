// D1_WRITE_POLICY: incremental; read-only audit, zero database mutations.
// buildIncrementalSyncPlan is unnecessary here: only an aggregate SELECT is sent.
import {cloudflareAuditError} from '../lib/all-player-id-audit.mjs';
import {perCircuitPlayerIdAuditSql,perCircuitPlayerIdAuditResult} from '../lib/per-circuit-player-id-audit.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('D1_audit_credentials_missing');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
async function api(url,options={}){
 const response=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(60000)});
 const body=await response.json();if(!response.ok||!body.success)throw Error(cloudflareAuditError(response.status,body,[account,token]));return body;
}
const databases=await api(base+'?name=courtwatch-app&per_page=100'),db=databases.result?.find(d=>d.name==='courtwatch-app');
if(!db)throw Error('D1_audit_existing_database_not_found');
const id=db.uuid||db.id;if(!id)throw Error('D1_audit_database_id_missing');
const result=await api(base+'/'+id+'/query',{method:'POST',body:JSON.stringify({sql:perCircuitPlayerIdAuditSql})});
if(result.result?.length!==1||result.result[0].success===false)throw Error('D1_audit_query_failed');
const metrics=result.result[0].meta||{},audit=perCircuitPlayerIdAuditResult(result.result[0].results);
console.log(JSON.stringify({...audit,checkedAt:new Date().toISOString(),rowsRead:metrics.rows_read||0,rowsWritten:metrics.rows_written||0}));
if(metrics.rows_written)throw Error('D1_read_only_audit_unexpected_writes');
if(!audit.passed)throw Error('own_circuit_player_id_coverage_not_confirmed');
