import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {identityReviewKey,identityReviewDecisionKey} from '../lib/identity-review-queue.mjs';
import {createReadOnlyD1Client} from '../lib/read-only-d1-client.mjs';
import {paginatedPlayerSearch} from '../lib/paginated-player-search.mjs';
import {playerNameKey} from '../lib/player-circuit-profiles.mjs';
import {sqlString as q} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental. Exact user-confirmed three IDs; no source rewrites.
export const nameKey='GROSSO IRIS',identities=[{circuit:'fitp',officialId:'8445579419'},{circuit:'itf',officialId:'800748612'},{circuit:'tennis-europe',officialId:'50f58120-1693-4036-b9e1-0b96a894b218'}];
const key=r=>r.circuit+'|'+String(r.official_id||r.officialId||'').toLowerCase(),wanted=new Set(identities.map(key)),marker='approvedIrisGrossoIdentity:20261025:v1';
const rules=identities.slice(1).map((id,i)=>({key:'confirmedPlayerCircuitLink:approved-iris-20261025:'+i,value:JSON.stringify({nameKey,identities:[identities[0],id],currentNationality:'GBR',...(id.circuit==='tennis-europe'?{sourceKeys:['acceptance|acquired|tennis-europe|name:b6b44e0b84d2834f92b49628']}:{}),reason:'Explicit user confirmation 25 October 2026: Iris Grosso same FITP ITF Europe person, current nationality GBR'})}));
async function read(query){return query("SELECT l.*,COALESCE(a.canonical_id,l.canonical_id) AS person_id,CASE WHEN o.source_key IS NOT NULL THEN 'observed_players' WHEN s.source_key IS NOT NULL THEN 'search_acquired_players' ELSE '' END AS source_table,COALESCE(o.payload,s.payload) AS payload FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id LEFT JOIN observed_players o ON o.source_key=l.source_key LEFT JOIN search_acquired_players s ON s.source_key=l.source_key WHERE l.name_key="+q(nameKey)+" ORDER BY l.source_key");}
function verify(rows){const selected=rows.filter(r=>wanted.has(key(r)));if(new Set(selected.map(key)).size!==3)throw Error('iris_native_id_missing');if(new Set(selected.map(r=>r.person_id||r.canonical_id)).size!==1)throw Error('iris_not_unified');return selected[0].person_id||selected[0].canonical_id;}
async function put(query,current,incoming){
 const plan=buildIncrementalSyncPlan({current,incoming,keyOf:r=>r.key,sourceComplete:true});
 for(const r of [...plan.inserts,...plan.updates.map(u=>u.after)])await query('INSERT INTO app_state(key,value,updated_at) VALUES('+[q(r.key),q(r.value),q(new Date().toISOString())].join(',')+') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE value IS NOT excluded.value;');
}
export async function applyIrisIdentity(query,{db=createReadOnlyD1Client(query).db}={}){
 const checkpoint=await query('SELECT key,value FROM app_state WHERE key='+q(marker));
 if(checkpoint.length)return{status:'already_completed',summary:JSON.parse(checkpoint[0].value)};
 const before=await read(query);
 if(new Set(before.filter(r=>wanted.has(key(r))).map(key)).size!==3)throw Error('iris_native_id_missing');
 if(before.some(r=>r.official_id&&!wanted.has(key(r))||!r.payload||!r.source_table))throw Error('iris_sources_changed');
 const previous=await query("SELECT key,value FROM app_state WHERE key LIKE 'confirmedPlayerCircuitLink:%' ORDER BY key");
 for(const r of rules)if(previous.some(p=>p.key===r.key&&p.value!==r.value))throw Error('iris_rule_conflict');
 const projected=buildIdentityMapping(before,{currentLinks:before,currentPeople:[],currentAliases:[],confirmedLinks:[...previous,...rules].map(r=>JSON.parse(r.value))});
 verify(projected.links);
 await put(query,previous.filter(p=>rules.some(r=>r.key===p.key)),rules);
 const persisted=await query('SELECT key,value FROM app_state WHERE key IN ('+rules.map(r=>q(r.key)).join(',')+')');
 if(rules.some(r=>!persisted.some(p=>p.key===r.key&&p.value===r.value)))throw Error('iris_rule_not_saved');
 const scope=before.filter(r=>wanted.has(key(r))).map(r=>({source_table:r.source_table,source_key:r.source_key}));
 for(const r of scope)await query('INSERT INTO player_identity_pending_sources(source_table,source_key,revision) VALUES('+q(r.source_table)+','+q(r.source_key)+',1) ON CONFLICT(source_table,source_key) DO NOTHING;');
 await syncPlayerIdentities(query,{pendingSources:scope});
 const after=await read(query),canonicalId=verify(after);
 if(before.length!==after.length||before.some(r=>!after.some(s=>s.source_key===r.source_key&&s.payload===r.payload)))throw Error('iris_source_retention_failed');
 const payload=JSON.parse((await query('SELECT payload FROM player_identity_people WHERE canonical_id='+q(canonicalId)))[0]?.payload||'{}');
 if(payload.nationality!=='GBR')throw Error('iris_nationality_not_verified');
 const decision={key:identityReviewDecisionKey(nameKey),value:JSON.stringify({nameKey,reviewedNativeIds:[...wanted].sort(),decision:'same_person',nationality:'GBR',identities})};
 await put(query,await query('SELECT key,value FROM app_state WHERE key='+q(decision.key)),[decision]);
 if((await query('SELECT value FROM app_state WHERE key='+q(decision.key)))[0]?.value!==decision.value)throw Error('iris_decision_not_saved');
 if((await query('SELECT key FROM app_state WHERE key='+q(identityReviewKey(nameKey)))).length)throw Error('iris_review_case_not_closed');
 const search=await paginatedPlayerSearch(db,'Iris Grosso',null),exact=search.results.filter(r=>playerNameKey(r.name)===nameKey);
 if(exact.length!==1||exact[0].canonicalId!==canonicalId||exact[0].nationality!=='GBR')throw Error('iris_search_not_verified:'+JSON.stringify({canonicalId,exact}));
 const summary={status:'complete',canonicalId,nationality:'GBR',nativeIdsVerified:3,searchEntries:exact.length,reviewCase:'closed',identities};
 await put(query,checkpoint,[{key:marker,value:JSON.stringify(summary)}]);
 if((await query('SELECT value FROM app_state WHERE key='+q(marker)))[0]?.value!==JSON.stringify(summary))throw Error('iris_checkpoint_not_saved');
 return{status:'iris_identity_verified',summary};
}
async function main(){
 const metrics={rowsRead:0,rowsWritten:0},report={checkedAt:new Date().toISOString(),metrics};
 const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),id=config.d1_databases.find(r=>r.binding==='DB').database_id;
 async function query(sql,params=[]){const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/d1/database/'+id+'/query',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(60000)}),j=await response.json();if(!response.ok||!j.success||!j.result?.every(r=>r.success))throw Error('iris_d1_failed_http_'+response.status+':'+JSON.stringify(j.errors||[]));addD1Metrics(metrics,j);return j.result[0].results||[];}
 await fs.mkdir('tmp',{recursive:true});try{Object.assign(report,await applyIrisIdentity(query));}catch(error){report.status='failed';report.error=error.message;throw error;}finally{await fs.writeFile('tmp/approved-iris-identity.json',JSON.stringify(report,null,2)+'\n');console.log('IRIS_IDENTITY_REPAIRED='+JSON.stringify(report));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
