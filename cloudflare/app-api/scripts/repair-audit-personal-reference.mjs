import fs from 'node:fs/promises';
import {repairPersonalAuditReference} from '../lib/audit-personal-reference-repair.mjs';
import {cloudflareAuditError} from '../lib/all-player-id-audit.mjs';
// D1_WRITE_POLICY: incremental; buildIncrementalSyncPlan and exact evidence guards in repairPersonalAuditReference.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('D1_credentials_missing');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
async function api(url,options={}){
 const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(60000)}),j=await r.json();
 if(!r.ok||j.success!==true)throw Error(cloudflareAuditError(r.status,j,[account,token]));return j;
}
const list=await api(base+'?name=courtwatch-app&per_page=100'),db=list.result?.find(d=>d.name==='courtwatch-app');if(!db)throw Error('existing_database_not_found');
const metrics={rowsRead:0,rowsWritten:0};
async function query(sql){const j=await api(base+'/'+(db.uuid||db.id)+'/query',{method:'POST',body:JSON.stringify({sql})});if(!j.result?.every(r=>r.success))throw Error('repair_query_failed');for(const r of j.result){metrics.rowsRead+=r.meta?.rows_read||0;metrics.rowsWritten+=r.meta?.rows_written||0;}return j.result[0].results||[];}
const report={checkedAt:new Date().toISOString(),metrics};
try{report.result=await repairPersonalAuditReference(query,{onEvidence:e=>report.evidence=e});}
catch(e){report.error=e.message;throw e;}
finally{await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/audit-personal-reference.json',JSON.stringify(report)+'\n');console.log(JSON.stringify(report));}
