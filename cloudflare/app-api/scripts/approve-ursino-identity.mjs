import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
import {identityReviewKey} from '../lib/identity-review-queue.mjs';
import {sqlString as q} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental; exact user-confirmed pair only.
export const rule={nameKey:'DOMENICO URSINO',identities:[{circuit:'fitp',officialId:'6475901439'},{circuit:'tennis-europe',officialId:'c243df28-a1b5-4014-ad7f-be25c6c53d26'}],reason:'User confirmation 2026-11-02; case ID-5D00EF71938D: same person'};
const key='confirmedPlayerCircuitLink:ursino-20261102',value=JSON.stringify(rule),native=r=>r.circuit+'|'+String(r.official_id||r.officialId).toLowerCase(),wanted=new Set(rule.identities.map(native));
const select=`SELECT l.*,COALESCE(a.canonical_id,l.canonical_id) AS person_id,CASE WHEN o.source_key IS NOT NULL THEN 'observed_players' WHEN s.source_key IS NOT NULL THEN 'search_acquired_players' ELSE '' END AS source_table,COALESCE(o.payload,s.payload) AS payload FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id LEFT JOIN observed_players o ON o.source_key=l.source_key LEFT JOIN search_acquired_players s ON s.source_key=l.source_key WHERE l.name_key='DOMENICO URSINO' ORDER BY l.source_key`;
export async function approveUrsino(query){
 const before=await query(select),targets=before.filter(r=>wanted.has(native(r)));
 if(new Set(targets.map(native)).size!==2)throw Error('ursino_native_missing');
 if(before.some(r=>r.circuit!=='courtwatch'&&!wanted.has(native(r))))throw Error('ursino_extra_native_requires_review');
 if(targets.length>100)throw Error('ursino_scope_too_large');
 if(targets.some(r=>!r.source_table||!r.payload))throw Error('ursino_original_missing');
 const existing=await query("SELECT key,value FROM app_state WHERE key LIKE 'confirmedPlayerCircuitLink:%' ORDER BY key");
 const saved=existing.find(r=>r.key===key);if(saved&&saved.value!==value)throw Error('ursino_approval_conflict');
 const plan=buildIdentityMapping(before,{currentLinks:before,currentPeople:[],currentAliases:[],confirmedLinks:[...existing.map(r=>JSON.parse(r.value)),rule]});
 if(new Set(plan.links.filter(r=>wanted.has(native(r))).map(r=>r.canonical_id)).size!==1)throw Error('ursino_preflight_failed');
 const reviewKey=identityReviewKey(rule.nameKey),open=await query('SELECT key,value FROM app_state WHERE key='+q(reviewKey));
 if(saved&&new Set(targets.map(r=>r.person_id)).size===1&&!open.length)return{status:'already_verified',canonicalId:targets[0].person_id,identities:rule.identities};
 if(!saved)await query(`INSERT INTO app_state(key,value,updated_at) VALUES(${q(key)},${q(value)},${q(new Date().toISOString())}) ON CONFLICT(key) DO NOTHING;`);
 if((await query('SELECT value FROM app_state WHERE key='+q(key)))[0]?.value!==value)throw Error('ursino_rule_readback_failed');
 const scope=targets.map(r=>({source_table:r.source_table,source_key:r.source_key}));
 for(const s of scope)await query(`INSERT INTO player_identity_pending_sources(source_table,source_key,revision) VALUES(${q(s.source_table)},${q(s.source_key)},1) ON CONFLICT(source_table,source_key) DO NOTHING;`);
 await syncPlayerIdentities(query,{pendingSources:scope});
 const after=await query(select),linked=after.filter(r=>wanted.has(native(r)));
 if(after.length!==before.length||before.some(r=>!after.some(a=>a.source_key===r.source_key&&a.payload===r.payload)))throw Error('ursino_original_changed');
 if(new Set(linked.map(native)).size!==2||new Set(linked.map(r=>r.person_id)).size!==1)throw Error('ursino_link_readback_failed');
 if((await query('SELECT key FROM app_state WHERE key='+q(reviewKey))).length)throw Error('ursino_review_still_open');
 return{status:'verified',canonicalId:linked[0].person_id,identities:rule.identities,sourcePayloadsPreserved:true,caseClosed:true};
}
async function main(){
 const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),db=config.d1_databases.find(d=>d.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0},report={metrics};
 async function query(sql){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||j.success!==true||!j.result?.every(r=>r.success))throw Error('ursino_D1_http_'+r.status);addD1Metrics(metrics,j);return j.result[0].results||[];}
 await fs.mkdir('tmp',{recursive:true});try{Object.assign(report,await approveUrsino(query));}catch(e){report.status='failed';report.error=e.message;throw e;}finally{await fs.writeFile('tmp/ursino-identity.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
