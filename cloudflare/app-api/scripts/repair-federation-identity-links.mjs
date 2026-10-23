import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
import {mergeSearchIdentities} from '../lib/paginated-player-search.mjs';
import {splitIdentityReasons} from './audit-split-player-identities.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental. Only verified comparison aliases can queue a
// merge; conflicting IDs, years or countries retain separate identities.
const marker='identityFederationComparison:RTF-BTF-LIB:v1';
const baseline=JSON.parse(await fs.readFile(new URL('../data/cross-circuit-identity-review-40035378729.json',import.meta.url),'utf8'));
export function federationRecoveryCandidate(rows){
 const people=new Set(rows.map(r=>r.person_id));
 if(people.size<2)return{status:'already_unified'};
 const alias=rows.some(r=>{const p=JSON.parse(r.payload);return r.circuit==='tennis-europe'&&['RTF','BTF','LIB'].includes(String(p.nationality||p.country||'').toUpperCase());});
 const reasons=splitIdentityReasons(rows);
 return alias&&!rows.some(r=>r.original_missing)&&mergeSearchIdentities(rows.map(r=>({...r})),new Map()).length===1
  ?{status:'safe_federation_alias_recovery'}:{status:'needs_identity_evidence',reasons};
}
export async function reviewAndRepairFederationIdentities(query,{names=baseline.names}={}){
 const prior=await query('SELECT key,value FROM app_state WHERE key='+sqlString(marker));
 if(prior.length){const saved=JSON.parse(prior[0].value);if(saved.status==='complete')return{status:'already_completed',summary:saved.summary};throw Error('federation_recovery_checkpoint_invalid');}
 if(!Array.isArray(names)||names.length>200||!names.every(n=>typeof n==='string'&&n.length>0&&n.length<200))throw Error('federation_recovery_scope_invalid');
 const reviews=[];
 for(let offset=0;offset<names.length;offset+=25){const batch=names.slice(offset,offset+25),list=batch.map(sqlString).join(',');
  const rows=await query(`SELECT l.*,COALESCE(a.canonical_id,l.canonical_id) AS person_id,
  CASE WHEN o.source_key IS NOT NULL THEN 'observed_players' WHEN s.source_key IS NOT NULL THEN 'search_acquired_players' ELSE '' END AS source_table,
  CASE WHEN o.source_key IS NULL AND s.source_key IS NULL AND c.id IS NULL AND u.courtwatch_id IS NULL THEN 1 ELSE 0 END AS original_missing,
  COALESCE(o.payload,s.payload,c.payload,u.payload,json_object('nationality',l.nationality,'birthYear',l.birth_year,'profileUrl',l.profile_url)) AS payload
  FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id
  LEFT JOIN observed_players o ON o.source_key=l.source_key LEFT JOIN search_acquired_players s ON s.source_key=l.source_key
  LEFT JOIN app_players c ON l.circuit='courtwatch' AND c.id=l.official_id
  LEFT JOIN (SELECT courtwatch_id,MIN(payload) AS payload FROM user_app_player_additions GROUP BY courtwatch_id) u ON l.circuit='courtwatch' AND u.courtwatch_id=l.official_id
  WHERE l.name_key IN (${list}) ORDER BY l.name_key,l.source_key`);
  const groups=new Map();for(const r of rows){const g=groups.get(r.name_key)||[];g.push(r);groups.set(r.name_key,g);}
  const recover=[];
  for(const name of batch){const members=groups.get(name);if(!members?.length)throw Error('federation_recovery_group_missing:'+name);const decision=federationRecoveryCandidate(members),review={name,...decision,beforePeople:new Set(members.map(r=>r.person_id)).size,sources:members.map(r=>({...r,payload:JSON.parse(r.payload)}))};reviews.push(review);if(decision.status==='safe_federation_alias_recovery')recover.push({review,members});}
  const scope=[];
  for(const {members} of recover){const row=members.find(r=>r.source_table);if(!row)throw Error('federation_recovery_original_source_missing');scope.push({source_table:row.source_table,source_key:row.source_key});}
  if(scope.length){for(const r of scope)await query(`INSERT INTO player_identity_pending_sources(source_table,source_key,revision) VALUES(${sqlString(r.source_table)},${sqlString(r.source_key)},1) ON CONFLICT(source_table,source_key) DO NOTHING;`);
   await syncPlayerIdentities(query,{pendingSources:scope});
   for(const {review,members} of recover){const wanted=members.map(r=>sqlString(r.source_key)).join(','),saved=await query(`SELECT l.source_key,COALESCE(a.canonical_id,l.canonical_id) AS person_id FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id WHERE l.source_key IN (${wanted})`);
    if(saved.length!==members.length||new Set(saved.map(r=>r.person_id)).size!==1)throw Error('federation_recovery_readback_failed:'+review.name);review.status='reconciled';review.canonicalId=saved[0].person_id;
   }
  }
 }
 const summary={reviewed:reviews.length,reconciled:reviews.filter(r=>r.status==='reconciled').length,alreadyUnified:reviews.filter(r=>r.status==='already_unified').length,remaining:reviews.filter(r=>r.status==='needs_identity_evidence').length};
 const checkpoint={key:marker,value:JSON.stringify({status:'complete',summary})},plan=buildIncrementalSyncPlan({current:prior,incoming:[checkpoint],keyOf:r=>r.key,sourceComplete:true});
 if(plan.writes)await query('INSERT INTO app_state(key,value,updated_at) VALUES('+[marker,checkpoint.value,new Date().toISOString()].map(sqlString).join(',')+') ON CONFLICT(key) DO NOTHING;');
 if((await query('SELECT value FROM app_state WHERE key='+sqlString(marker)))[0]?.value!==checkpoint.value)throw Error('federation_recovery_checkpoint_not_verified');
 return{status:'federation_alias_recovery_and_full_review_complete',baselineRun:baseline.runId,summary,reviews};
}
async function main(){const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),id=config.d1_databases.find(r=>r.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0},report={checkedAt:new Date().toISOString(),metrics};
 async function query(sql){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${id}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||j.success!==true||!j.result?.every(r=>r.success))throw Error('federation_recovery_d1_failed_http_'+r.status);addD1Metrics(metrics,j);return j.result[0].results||[];}
 await fs.mkdir('tmp',{recursive:true});try{Object.assign(report,await reviewAndRepairFederationIdentities(query));}catch(e){report.status='failed';report.error=e.message;throw e;}finally{await fs.writeFile('tmp/federation-identity-review.json',JSON.stringify(report,null,2)+'\n');console.log('FEDERATION_IDENTITY_REVIEW='+JSON.stringify(report));}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
