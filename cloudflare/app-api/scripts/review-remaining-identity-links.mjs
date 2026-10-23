import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {splitIdentityReasons} from './audit-split-player-identities.mjs';
import {createReadOnlyD1Client} from '../lib/read-only-d1-client.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental. Only exact native bindings present in retained
// personal records authorize repair. Other evidence is exported read-only.
const baseline=JSON.parse(await fs.readFile(new URL('../data/identity-review-remaining-143.json',import.meta.url),'utf8'));
const marker='personalNativeIdentityLinks:v1';
const parse=p=>JSON.parse(p||'{}');
export async function reviewRemainingIdentityLinks(query,{names=baseline.names}={}){
 const prior=await query('SELECT key,value FROM app_state WHERE key='+sqlString(marker));
 if(prior.length){const saved=parse(prior[0].value);if(saved.status!=='complete')throw Error('native_review_checkpoint_invalid');return{status:'already_completed',summary:saved.summary};}
 if(!Array.isArray(names)||!names.length||names.length>200||new Set(names).size!==names.length||names.some(n=>typeof n!=='string'||!n||n.length>200))throw Error('native_review_scope_invalid');
 const read=createReadOnlyD1Client(query).query,reviews=[];
 for(let offset=0;offset<names.length;offset+=20){const batch=names.slice(offset,offset+20),rows=await read(`SELECT l.*,COALESCE(a.canonical_id,l.canonical_id) AS person_id,
 CASE WHEN o.source_key IS NOT NULL THEN 'observed_players' WHEN s.source_key IS NOT NULL THEN 'search_acquired_players' WHEN c.id IS NOT NULL THEN 'app_players' WHEN u.courtwatch_id IS NOT NULL THEN 'user_app_player_additions' ELSE '' END AS source_table,
 COALESCE(o.payload,s.payload,c.payload,u.payload) AS payload
 FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id
 LEFT JOIN observed_players o ON o.source_key=l.source_key LEFT JOIN search_acquired_players s ON s.source_key=l.source_key
 LEFT JOIN app_players c ON l.circuit='courtwatch' AND c.id=l.official_id
 LEFT JOIN (SELECT courtwatch_id,MIN(payload) AS payload,COUNT(DISTINCT payload) AS versions FROM user_app_player_additions GROUP BY courtwatch_id) u ON l.circuit='courtwatch' AND u.courtwatch_id=l.official_id AND u.versions=1
 WHERE l.name_key IN (${batch.map(sqlString).join(',')}) ORDER BY l.name_key,l.source_key`);
  const nativeRows=[...new Map(rows.filter(r=>r.circuit!=='courtwatch'&&r.official_id).map(r=>[r.circuit+'|'+r.official_id.toLowerCase(),r])).values()],retained=[];
  for(let i=0;i<nativeRows.length;i+=40){const chunk=nativeRows.slice(i,i+40);retained.push(...await read(`SELECT circuit,source_player_id,display_name,payload,updated_at FROM opponent_entry_profiles WHERE ${chunk.map(r=>`(circuit=${sqlString(r.circuit)} AND source_player_id=${sqlString(r.official_id)} COLLATE NOCASE)`).join(' OR ')}`));}
  const cards=nativeRows.filter(r=>r.circuit==='fitp').map(r=>r.official_id),metadata=[];
  for(let i=0;i<cards.length;i+=80)metadata.push(...await read(`SELECT membership_card,club,ranking,updated_at FROM fitp_player_metadata WHERE membership_card IN (${cards.slice(i,i+80).map(sqlString).join(',')})`));
  for(const name of batch){const members=rows.filter(r=>r.name_key===name);if(!members.length)throw Error('native_review_group_missing:'+name);
   const review={name,beforePeople:new Set(members.map(r=>r.person_id)).size,status:'needs_identity_evidence',sources:members.map(r=>({...r,payload:parse(r.payload)}))};reviews.push(review);
   if(members.some(r=>!r.source_table||!r.payload)){review.reasons=['original_source_missing_or_personal_versions_conflict'];continue;}
   const proposed=buildIdentityMapping(members),groups=new Map();for(const l of proposed.links){const group=groups.get(l.canonical_id)||[];group.push(l.source_key);groups.set(l.canonical_id,group);}
   const changed=[...groups.values()].filter(keys=>keys.some(key=>members.find(r=>r.source_key===key).circuit==='courtwatch')&&new Set(keys.map(key=>members.find(r=>r.source_key===key).person_id)).size>1);
   if(changed.length){const scope=members.filter(r=>r.circuit==='courtwatch').map(r=>({source_table:r.source_table,source_key:r.official_id}));
    for(const r of scope)await query(`INSERT INTO player_identity_pending_sources(source_table,source_key,revision) VALUES(${sqlString(r.source_table)},${sqlString(r.source_key)},1) ON CONFLICT(source_table,source_key) DO NOTHING;`);
    await syncPlayerIdentities(query,{pendingSources:scope});
    const saved=await read(`SELECT l.source_key,COALESCE(a.canonical_id,l.canonical_id) AS person_id FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id WHERE l.source_key IN (${members.map(r=>sqlString(r.source_key)).join(',')})`);
    if(saved.length!==members.length)throw Error('native_review_readback_missing:'+name);
    // Verify the full proposed partition: linked IDs join and excluded homonyms
    // remain separate, including all original source keys.
    for(const group of groups.values())if(new Set(saved.filter(r=>group.includes(r.source_key)).map(r=>r.person_id)).size!==1)throw Error('native_review_link_readback_failed:'+name);
    if(new Set(saved.map(r=>r.person_id)).size!==groups.size)throw Error('native_review_homonym_readback_failed:'+name);
    review.status='exact_bindings_repaired';review.afterPeople=new Set(saved.map(r=>r.person_id)).size;review.saved=saved;
   }else review.afterPeople=review.beforePeople;
   review.reasons=splitIdentityReasons(members.map(r=>({...r,original_missing:0})));
   // These tables may contain fuller birth/club/native-reference evidence than
   // search sources. Read exact native IDs through their indexes, once per group.
   const identities=new Set(members.map(r=>r.circuit+'|'+r.official_id.toLowerCase())),fitpCards=new Set(members.filter(r=>r.circuit==='fitp').map(r=>r.official_id));
   review.retainedProfiles=retained.filter(r=>identities.has(r.circuit+'|'+r.source_player_id.toLowerCase())).map(r=>({...r,payload:parse(r.payload)}));
   review.fitpMetadata=metadata.filter(r=>fitpCards.has(r.membership_card));
  }
 }
 const summary={reviewed:reviews.length,groupsWithExactBindingsRepaired:reviews.filter(r=>r.status==='exact_bindings_repaired').length,groupsStillSplit:reviews.filter(r=>(r.afterPeople??r.beforePeople)>1).length,needsAdditionalEvidence:reviews.filter(r=>r.status==='needs_identity_evidence').length};
 const checkpoint={key:marker,value:JSON.stringify({status:'complete',summary})},plan=buildIncrementalSyncPlan({current:prior,incoming:[checkpoint],keyOf:r=>r.key,sourceComplete:true});
 if(plan.writes)await query(`INSERT INTO app_state(key,value,updated_at) VALUES(${sqlString(marker)},${sqlString(checkpoint.value)},${sqlString(new Date().toISOString())}) ON CONFLICT(key) DO NOTHING;`);
 if((await read('SELECT value FROM app_state WHERE key='+sqlString(marker)))[0]?.value!==checkpoint.value)throw Error('native_review_checkpoint_readback_failed');
 return{status:'exact_native_bindings_and_retained_review_complete',baselineRun:baseline.baselineRun,summary,reviews};
}
async function main(){const config=parse(await fs.readFile('wrangler.generated.jsonc','utf8')),id=config.d1_databases.find(r=>r.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0},report={checkedAt:new Date().toISOString(),metrics};
 async function query(sql){const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${id}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await response.json();if(!response.ok||!j.success||!j.result?.every(r=>r.success))throw Error('native_review_d1_failed_http_'+response.status);addD1Metrics(metrics,j);return j.result[0].results||[];}
 await fs.mkdir('tmp',{recursive:true});try{Object.assign(report,await reviewRemainingIdentityLinks(query));}catch(e){report.status='failed';report.error=e.message;throw e;}finally{await fs.writeFile('tmp/remaining-identity-review.json',JSON.stringify(report,null,2)+'\n');console.log('REMAINING_IDENTITY_REVIEW='+JSON.stringify(report));}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
