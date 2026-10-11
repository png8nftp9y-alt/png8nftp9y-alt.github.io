import fs from 'node:fs/promises';
import {recoverEuropeMatchProfiles} from '../lib/europe-match-profile-recovery.mjs';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
import {europeMissingIdOriginsSql,europeMissingIdOriginsResult} from '../lib/europe-missing-id-origins.mjs';
// D1_WRITE_POLICY: incremental; buildIncrementalSyncPlan, optimistic writes and
// readback are enforced by recoverEuropeMatchProfiles/applyArchiveEvidence.
const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id;
const metrics={rowsRead:0,rowsWritten:0,queries:0},started=Date.now();
async function query(sql){
 metrics.queries++;
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),body=await response.json();
 if(!response.ok||body.success!==true||!body.result?.every(r=>r.success))throw Error('europe_profile_D1_failed_HTTP_'+response.status);
 addD1Metrics(metrics,body);return body.result[0].results||[];
}
const audit={status:'started',checkedAt:new Date().toISOString(),metrics};
await fs.mkdir('tmp',{recursive:true});
try{
 audit.before=europeMissingIdOriginsResult((await query(europeMissingIdOriginsSql))[0]);
 audit.recovery=await recoverEuropeMatchProfiles(query,{onProgress:p=>console.log('EUROPE_NATIVE_PROFILE_PROGRESS='+JSON.stringify(p))});
 const mapping=await syncPlayerIdentities(query);
 audit.mapping={status:mapping.status,pending:mapping.pending,writes:mapping.writes};
 audit.after=europeMissingIdOriginsResult((await query(europeMissingIdOriginsSql))[0]);
 audit.status=audit.after.missingPeople||audit.after.pendingMapping||audit.recovery.unresolved?'unresolved_official_evidence':'complete_zero_verified';
 if(audit.status!=='complete_zero_verified')throw Error('europe_official_profiles_unresolved:'+audit.after.missingPeople);
}catch(error){audit.error=error.message;audit.status=audit.status==='started'?'failed':audit.status;throw error}
finally{audit.elapsedMs=Date.now()-started;await fs.writeFile('tmp/europe-match-profile-recovery.json',JSON.stringify(audit)+'\n');console.log(JSON.stringify(audit))}
