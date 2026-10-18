import {recoveryReadQuery} from '../lib/recovery-read-query.mjs';
import {cachedReadCheck,readCheckVersion} from '../lib/d1-read-check-cache.mjs';
import fs from 'node:fs/promises';
import {recoverCircuitNativeSources,circuitOfficialJson,circuitMissingNativeSourcesSql} from '../lib/circuit-native-source-recovery.mjs';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
// D1_WRITE_POLICY: incremental; buildIncrementalSyncPlan, conditional source
// writes and readback are enforced by recoverCircuitNativeSources.
const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id;
const metrics={rowsRead:0,rowsWritten:0,queries:0},started=Date.now();
async function query(sql){
 metrics.queries++;
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();
 if(!r.ok||j.success!==true||!j.result?.every(x=>x.success))throw Error('native_profile_D1_failed_HTTP_'+r.status);
 addD1Metrics(metrics,j);return j.result[0].results||[];
}
const report={status:'started',checkedAt:new Date().toISOString(),metrics,requests:0};
await fs.mkdir('tmp',{recursive:true});
try{
 const checked=await cachedReadCheck(query,'native-profiles',await readCheckVersion(import.meta.url),async()=>{
 report.recovery=await recoverCircuitNativeSources(query,{officialJson:circuitOfficialJson({onRequest:()=>report.requests++}),onProgress:p=>console.log('CIRCUIT_NATIVE_PROFILE_PROGRESS='+JSON.stringify(p))});
 const mapping=await syncPlayerIdentities(query);report.mapping={status:mapping.status,pending:mapping.pending,writes:mapping.writes};
 const after=await recoveryReadQuery(query,circuitMissingNativeSourcesSql,'identity_invalid_native');report.after={missingSources:after.length,byCircuit:{fitp:after.filter(r=>r.circuit==='fitp').length,itf:after.filter(r=>r.circuit==='itf').length}};
 report.status=after.length||mapping.pending||report.recovery.unresolved?'unresolved_official_evidence':'complete_zero_verified';
 if(report.status!=='complete_zero_verified')throw Error('circuit_native_profiles_unresolved:'+after.length);
 const {metrics,...value}=report;return value;
 });
 if(checked.reused){checked.value.recovery={...checked.value.recovery,examined:0,repaired:0,requests:0,verifiedUnchanged:true};checked.value.mapping={status:'unchanged',writes:0,pending:0};checked.value.requests=0;}
 Object.assign(report,checked.value,{checkedAt:new Date().toISOString(),metrics,cache:{reused:checked.reused,verifiedAt:checked.verifiedAt,saved:checked.cacheSaved}});
}catch(e){report.error=e.message;if(report.status==='started')report.status='failed';throw e}
finally{report.elapsedMs=Date.now()-started;await fs.writeFile('tmp/circuit-native-profile-recovery.json',JSON.stringify(report)+'\n');console.log(JSON.stringify(report))}
