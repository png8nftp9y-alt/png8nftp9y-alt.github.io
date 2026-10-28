import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
import {identityReviewDecisionKey,syncIdentityReview} from '../lib/identity-review-queue.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental; five exact user-reviewed groups, no discovery.
export const approval=JSON.parse(await fs.readFile(new URL('../data/user-approved-five-reviews-20261028.json',import.meta.url),'utf8'));
const marker='approvedFiveIdentityReviews:20261028:v1';
const native=r=>r.circuit+'|'+String(r.official_id||r.officialId||'').toLowerCase();
const identity=key=>{const [circuit,officialId]=key.split('|');return{circuit,officialId}};
export function approvedRules(){return approval.groups.flatMap(g=>g.partitions.flatMap((part,index)=>part.slice(1).map((key,i)=>({key:'confirmedPlayerCircuitLink:review-20261028:'+g.caseId+':'+index+':'+i,value:JSON.stringify({nameKey:g.nameKey,identities:[identity(part[0]),identity(key)],reason:'Explicit user identity decision 28 October 2026',...(g.currentNationality?{currentNationality:g.currentNationality}:{})})}))));}
async function readSources(query){return query(`SELECT l.*,COALESCE(a.canonical_id,l.canonical_id) AS person_id,
 CASE WHEN o.source_key IS NOT NULL THEN 'observed_players' WHEN s.source_key IS NOT NULL THEN 'search_acquired_players' WHEN c.id IS NOT NULL THEN 'app_players' WHEN u.courtwatch_id IS NOT NULL THEN 'user_app_player_additions' ELSE '' END AS source_table,
 COALESCE(o.payload,s.payload,c.payload,u.payload) AS payload FROM player_circuit_identities l
 LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id
 LEFT JOIN observed_players o ON o.source_key=l.source_key
 LEFT JOIN search_acquired_players s ON s.source_key=l.source_key
 LEFT JOIN app_players c ON l.circuit='courtwatch' AND c.id=l.official_id
 LEFT JOIN (SELECT courtwatch_id,MIN(payload) AS payload FROM user_app_player_additions GROUP BY courtwatch_id HAVING COUNT(DISTINCT payload)=1) u ON l.circuit='courtwatch' AND u.courtwatch_id=l.official_id
 WHERE l.name_key IN (${approval.groups.map(g=>sqlString(g.nameKey)).join(',')}) ORDER BY l.name_key,l.source_key`);}
export function verifyPartitions(rows){
 const verified=[];
 for(const g of approval.groups){
  const wanted=new Set(g.partitions.flat()),group=rows.filter(r=>r.name_key===g.nameKey&&r.circuit!=='courtwatch'),seen=new Set(group.map(native));
  if(seen.size!==wanted.size||[...wanted].some(key=>!seen.has(key)))throw Error('review_native_scope_changed:'+g.nameKey);
  const people=g.partitions.map(part=>{
   const ids=new Set(group.filter(r=>part.includes(native(r))).map(r=>r.person_id||r.canonical_id));
   if(ids.size!==1)throw Error('review_partition_not_unified:'+g.nameKey);
   return [...ids][0];
  });
  if(new Set(people).size!==people.length)throw Error('review_separate_profiles_merged:'+g.nameKey);
  verified.push({name:g.nameKey,partitions:g.partitions.map((ids,i)=>({ids,canonicalId:people[i]}))});
 }
 return verified;
}
async function saveExact(query,row){
 const before=await query('SELECT value FROM app_state WHERE key='+sqlString(row.key));
 if(before.length&&before[0].value!==row.value)throw Error('review_rule_changed:'+row.key);
 if(!before.length)await query(`INSERT INTO app_state(key,value,updated_at) VALUES(${sqlString(row.key)},${sqlString(row.value)},${sqlString(new Date().toISOString())}) ON CONFLICT(key) DO NOTHING;`);
 if((await query('SELECT value FROM app_state WHERE key='+sqlString(row.key)))[0]?.value!==row.value)throw Error('review_rule_readback_failed');
}
export async function applyFiveReviews(query){
 const prior=await query('SELECT value FROM app_state WHERE key='+sqlString(marker));
 if(prior.length)return{status:'already_completed',summary:JSON.parse(prior[0].value)};
 const before=await readSources(query),rules=approvedRules();
 if(before.length>200||approval.groups.length!==5||rules.length!==5)throw Error('review_manifest_invalid');
 const originals=before.filter(r=>r.circuit!=='courtwatch');
 if(originals.some(r=>!r.payload||!r.source_table))throw Error('review_original_source_missing');
 const allowed=new Set(approval.groups.flatMap(g=>g.partitions.flat()));
 if(originals.some(r=>!allowed.has(native(r))))throw Error('review_unexpected_native_id');
 const existing=await query("SELECT key,value FROM app_state WHERE key LIKE 'confirmedPlayerCircuitLink:%' ORDER BY key");
 const allRules=[...existing.filter(r=>!rules.some(w=>w.key===r.key)),...rules].map(r=>JSON.parse(r.value));
 // Simulate every merge and separation before the first mutation.
 const plan=buildIdentityMapping(before,{currentLinks:before,currentPeople:[],currentAliases:[],confirmedLinks:allRules});
 verifyPartitions(plan.links);
 for(const r of rules)await saveExact(query,r);
 const scope=[...new Map(originals.map(r=>[r.source_table+'|'+r.source_key,{source_table:r.source_table,source_key:r.source_key}])).values()];
 if(!scope.length||scope.length>200)throw Error('review_source_scope_invalid');
 for(const r of scope)await query(`INSERT INTO player_identity_pending_sources(source_table,source_key,revision) VALUES(${sqlString(r.source_table)},${sqlString(r.source_key)},1) ON CONFLICT(source_table,source_key) DO NOTHING;`);
 await syncPlayerIdentities(query,{pendingSources:scope});
 const after=await readSources(query);
 if(before.length!==after.length||before.some(r=>!after.some(s=>s.source_key===r.source_key)))throw Error('review_sources_lost');
 const verified=verifyPartitions(after);
 for(const g of approval.groups)if(g.currentNationality){
  const person=verified.find(v=>v.name===g.nameKey).partitions[0].canonicalId;
  const p=JSON.parse((await query('SELECT payload FROM player_identity_people WHERE canonical_id='+sqlString(person)))[0]?.payload||'{}');
  if(p.nationality!==g.currentNationality)throw Error('review_nationality_not_saved');
 }
 // Close only the exact known IDs; new native IDs can reopen the group.
 for(const g of approval.groups){
  const key=identityReviewDecisionKey(g.nameKey),prior=await query('SELECT value FROM app_state WHERE key='+sqlString(key));
  const previous=prior.length?JSON.parse(prior[0].value):{},value=JSON.stringify({...previous,reviewedNativeIds:[...new Set([...(previous.reviewedNativeIds||[]),...g.partitions.flat()])].sort(),partitions:g.partitions,decision:'Explicit user review 28 October 2026'});
  if(prior[0]?.value!==value)await query(`INSERT INTO app_state(key,value,updated_at) VALUES(${sqlString(key)},${sqlString(value)},${sqlString(new Date().toISOString())}) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE value IS NOT excluded.value;`);
  if((await query('SELECT value FROM app_state WHERE key='+sqlString(key)))[0]?.value!==value)throw Error('review_decision_not_saved');
 }
 await syncIdentityReview(query,after,{names:approval.groups.map(g=>g.nameKey),sources:after,confirmedLinks:allRules,sourceComplete:true});
 const cases=await query('SELECT key FROM app_state WHERE key IN ('+approval.groups.map(g=>sqlString(identityReviewDecisionKey(g.nameKey).replace('identityReviewDecision:','identityReviewCase:'))).join(',')+')');
 if(cases.length)throw Error('review_case_not_closed');
 const summary={status:'complete',verified,currentNationality:{'Thoma Bogatyrev':'AUS'},closedCases:5};
 await saveExact(query,{key:marker,value:JSON.stringify(summary)});
 return{status:'applied_and_verified',summary};
}
async function main(){
 const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),id=config.d1_databases.find(r=>r.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0},report={checkedAt:new Date().toISOString(),metrics};
 async function query(sql){
  const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${id}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await r.json();
  if(!r.ok||!j.success||!j.result?.every(x=>x.success))throw Error('review_d1_failed:'+JSON.stringify(j.errors||[]));
  addD1Metrics(metrics,j);return j.result[0].results||[];
 }
 await fs.mkdir('tmp',{recursive:true});
 try{report.before=await readSources(query);Object.assign(report,await applyFiveReviews(query));}catch(e){report.error=e.message;throw e;}finally{await fs.writeFile('tmp/five-reviewed-identities.json',JSON.stringify(report,null,2)+'\n');console.log('FIVE_REVIEWED_IDENTITIES='+JSON.stringify(report));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
