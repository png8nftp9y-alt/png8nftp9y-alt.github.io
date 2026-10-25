import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental. User-approved exact IDs only; no ranking rule
// is introduced for other names or future players. Original sources unchanged.
export const approval=JSON.parse(await fs.readFile(new URL('../data/user-approved-eighteen-fitp-itf-links-20261025.json',import.meta.url),'utf8'));
const marker='approvedEighteenFitpItfAssociations:20261025:v1',keyOf=r=>r.circuit+'|'+String(r.official_id||r.officialId||'').toLowerCase();
export function approvedRules(entries=approval.associations){return entries.flatMap(entry=>entry.identities.slice(1).map((id,i)=>({key:'confirmedPlayerCircuitLink:approved-eighteen-fitp-itf-20261025:'+entry.nameKey.toLowerCase().replaceAll(' ','-')+':'+i,value:JSON.stringify({nameKey:entry.nameKey,identities:[entry.identities[0],id],reason:'Explicit numbered user confirmation 25 October 2026; exact approved native IDs',...(entry.currentNationality?{currentNationality:entry.currentNationality}:{})})})));}
async function readSources(query,names){
 const labels=new Map();
 for(const entry of [...approval.associations,approval.emma])for(const id of [...entry.identities,...(entry.excludedIdentities||[])])labels.set(keyOf(id),entry.nameKey);
 const rows=[];
 for(let i=0;i<names.length;i+=20){
  const chunk=names.slice(i,i+20),ids=[...approval.associations,approval.emma].filter(e=>chunk.includes(e.nameKey)).flatMap(e=>[...e.identities,...(e.excludedIdentities||[])]);
  const exact=ids.map(id=>'(l.circuit='+sqlString(id.circuit)+' AND l.official_id IN ('+[...new Set([id.officialId,id.officialId.toLowerCase(),id.officialId.toUpperCase()])].map(sqlString).join(',')+'))');
  rows.push(...await query(`SELECT l.*,COALESCE(a.canonical_id,l.canonical_id) AS person_id,
 CASE WHEN o.source_key IS NOT NULL THEN 'observed_players' WHEN s.source_key IS NOT NULL THEN 'search_acquired_players' ELSE '' END AS source_table,
 COALESCE(o.payload,s.payload) AS payload
 FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id
 LEFT JOIN observed_players o ON o.source_key=l.source_key LEFT JOIN search_acquired_players s ON s.source_key=l.source_key
 WHERE (l.name_key IN (${chunk.map(sqlString).join(',')})${exact.length?' OR '+exact.join(' OR '):''}) ORDER BY l.name_key,l.source_key`));
 }
 // Local review label follows the approved ID; original names and payloads stay unchanged.
 return [...new Map(rows.map(r=>[r.source_key,{...r,name_key:labels.get(keyOf(r))||r.name_key}])).values()];
}
function verifyAssociation(entry,rows){const wanted=new Set(entry.identities.map(keyOf)),native=rows.filter(r=>wanted.has(keyOf(r))),seen=new Set(native.map(keyOf));
 if(seen.size!==wanted.size)throw Error('approved_identity_native_missing:'+entry.nameKey);
 if(new Set(native.map(r=>r.person_id||r.canonical_id)).size!==1)throw Error('approved_identity_not_unified:'+entry.nameKey);
 const person=native[0].person_id||native[0].canonical_id;
 if(rows.some(r=>entry.excludedFitpCards.includes(r.official_id)&&(r.person_id||r.canonical_id)===person))throw Error('approved_identity_excluded_card_merged:'+entry.nameKey);
 const excluded=new Set((entry.excludedIdentities||[]).map(keyOf));
 if(rows.some(r=>excluded.has(keyOf(r))&&(r.person_id||r.canonical_id)===person))throw Error('approved_identity_excluded_native_merged:'+entry.nameKey);
 return person;
}
function samePartition(before,after){if(before.length!==after.length)return false;const by=new Map(after.map(r=>[r.source_key,r.person_id]));if(before.some(r=>!by.has(r.source_key)))return false;return before.every(a=>before.every(b=>(a.person_id===b.person_id)===(by.get(a.source_key)===by.get(b.source_key))));}
export function remainingProblemGroups(rows,{closedEmptyCards=new Set(['2932830','2963170','4064532','5498291','5654928','5837322','5909083','6349806','6371799','8170710','9738435','9967731'])}={}){
 const handled=new Set([...approval.associations.map(r=>r.nameKey),approval.keepSeparateName,approval.emma.nameKey]),groups=new Map(),items=[];
 for(const r of rows){if(handled.has(r.name_key))continue;const g=groups.get(r.name_key)||[];g.push(r);groups.set(r.name_key,g);}
 for(const [name,g]of groups){const native=g.filter(r=>r.circuit!=='courtwatch'&&!(r.circuit==='fitp'&&closedEmptyCards.has(r.official_id))),people=new Set(native.map(r=>r.person_id)),circuits=[...new Set(native.map(r=>r.circuit))].sort();
  let type;
  if(circuits.length<2)type='no_cross_circuit_association_to_resolve';
  else if(people.size===1)type='association_already_unified';
  else if(['FILIPPO VITALI','PIETRO SALA'].includes(name))type='existing_confirmed_association_other_profiles_separate';
  else if(name==='AARAV GUPTA')type='separate_age_incompatible_verified';
  else if(new Set(native.map(r=>r.birth_year).filter(Boolean)).size>1)type='birth_year_conflict';
  else if(new Set(native.map(r=>r.nationality).filter(Boolean)).size>1)type='nationality_discrepancy';
  else{const perCircuit=new Map(circuits.map(c=>[c,new Set(native.filter(r=>r.circuit===c).map(keyOf)).size]));type=perCircuit.get('fitp')>1?'multiple_fitp_cards_'+circuits.filter(c=>c!=='fitp').join('_'):circuits.some(c=>perCircuit.get(c)>1)?'multiple_native_profiles_europe_or_itf':'cross_circuit_evidence_missing';}
  items.push({name,type,circuits,people:people.size,closedEmptyFitpCards:[...new Set(g.filter(r=>r.circuit==='fitp'&&closedEmptyCards.has(r.official_id)).map(r=>r.official_id))],identities:[...new Map(native.map(r=>[keyOf(r),{circuit:r.circuit,officialId:r.official_id,personId:r.person_id,birthYear:r.birth_year,nationality:r.nationality}])).values()]});
 }
 const counts={};for(const g of items)counts[g.type]=(counts[g.type]||0)+1;return{scope:'18 explicitly approved FITP–ITF identity groups; Emma Cao and Daria controls kept unchanged. Closed empty FITP sheet IDs are not reopened.',counts,groups:items};
}
export async function applyApprovedIdentityLinks(query,{reviewNames=approval.reviewNames}={}){
 const checkpoint=await query('SELECT key,value FROM app_state WHERE key='+sqlString(marker));if(checkpoint.length){const saved=JSON.parse(checkpoint[0].value);if(saved.status!=='complete')throw Error('approved_identity_checkpoint_invalid');return{status:'already_completed',summary:saved.summary};}
 const targets=approval.associations.map(r=>r.nameKey),names=[...targets,approval.keepSeparateName,approval.emma.nameKey],before=await readSources(query,names),existing=(await query("SELECT key,value FROM app_state WHERE key LIKE 'confirmedPlayerCircuitLink:%' ORDER BY key")),rules=approvedRules();
 if(new Set(targets).size!==18||rules.length!==18)throw Error('approved_identity_manifest_invalid');
 const daria=before.filter(r=>r.name_key===approval.keepSeparateName);if(!daria.length||new Set(daria.map(r=>r.person_id)).size<2)throw Error('approved_identity_daria_not_separate');
 const emma=before.filter(r=>r.name_key===approval.emma.nameKey);
 if(!emma.length||new Set(emma.map(r=>r.person_id)).size!==2)throw Error('approved_identity_emma_not_separate');
 for(const id of approval.emma.identities){const native=emma.filter(r=>keyOf(r)===keyOf(id));if(!native.length||native.some(r=>r.nationality!==id.nationality))throw Error('approved_identity_emma_nationality_conflict');}
 // Validate every approved group before any mutation. The ordinary mapper
 // simulates all explicit links and must still exclude every other FITP card.
 for(const entry of approval.associations){const rows=before.filter(r=>r.name_key===entry.nameKey),wanted=new Set(entry.identities.map(keyOf));if(!rows.length||rows.some(r=>r.circuit!=='courtwatch'&&(!r.payload||!r.source_table)))throw Error('approved_identity_original_missing:'+entry.nameKey);
  const plan=buildIdentityMapping(rows,{currentLinks:rows,currentPeople:[],currentAliases:[],confirmedLinks:[...existing.map(r=>JSON.parse(r.value)),...rules.map(r=>JSON.parse(r.value))]});
  verifyAssociation(entry,plan.links.map(r=>({...r,person_id:r.canonical_id})));
  if(!rows.some(r=>wanted.has(keyOf(r))&&r.source_table))throw Error('approved_identity_source_not_queueable');
 }
 const priorBy=new Map(existing.map(r=>[r.key,r.value]));for(const r of rules)if(priorBy.has(r.key)&&priorBy.get(r.key)!==r.value)throw Error('approved_identity_rule_changed');
 const rulePlan=buildIncrementalSyncPlan({current:existing.filter(r=>rules.some(w=>w.key===r.key)),incoming:rules,keyOf:r=>r.key,sourceComplete:true});
 for(const r of rulePlan.inserts)await query(`INSERT INTO app_state(key,value,updated_at) VALUES(${sqlString(r.key)},${sqlString(r.value)},${sqlString(new Date().toISOString())}) ON CONFLICT(key) DO NOTHING;`);
 const persisted=await query(`SELECT key,value FROM app_state WHERE key IN (${rules.map(r=>sqlString(r.key)).join(',')}) ORDER BY key`);if(rules.some(r=>!persisted.some(p=>p.key===r.key&&p.value===r.value)))throw Error('approved_identity_rules_not_verified');
 const wantedKeys=new Set(approval.associations.flatMap(e=>e.identities.map(keyOf))),scope=before.filter(r=>wantedKeys.has(keyOf(r))&&r.source_table).map(r=>({source_table:r.source_table,source_key:r.source_key}));
 for(const r of scope)await query(`INSERT INTO player_identity_pending_sources(source_table,source_key,revision) VALUES(${sqlString(r.source_table)},${sqlString(r.source_key)},1) ON CONFLICT(source_table,source_key) DO NOTHING;`);
 // The ordinary mapper follows the exact user-confirmed native IDs across retained name variants.
 await syncPlayerIdentities(query,{pendingSources:scope});
 const after=await readSources(query,names),verified=[];
 for(const entry of approval.associations){const saved=after.filter(r=>r.name_key===entry.nameKey),original=before.filter(r=>r.name_key===entry.nameKey);if(saved.length!==original.length||original.some(r=>!saved.some(s=>s.source_key===r.source_key)))throw Error('approved_identity_sources_lost');
  const person=verifyAssociation(entry,saved),payload=JSON.parse((await query('SELECT payload FROM player_identity_people WHERE canonical_id='+sqlString(person)))[0]?.payload||'{}');
  if(entry.currentNationality&&payload.nationality!==entry.currentNationality)throw Error('approved_identity_nationality_not_verified');
  verified.push({number:entry.number,name:entry.nameKey,canonicalId:person,identities:entry.identities,excludedFitpCards:entry.excludedFitpCards,excludedIdentities:entry.excludedIdentities||[],...(entry.currentNationality?{nationality:payload.nationality}:{})});
 }
 const emmaAfter=after.filter(r=>r.name_key===approval.emma.nameKey);
 if(!samePartition(emma,emmaAfter)||emma.some(r=>!emmaAfter.some(s=>s.source_key===r.source_key&&s.nationality===r.nationality&&s.payload===r.payload)))throw Error('approved_identity_emma_changed');
 if(!samePartition(daria,after.filter(r=>r.name_key===approval.keepSeparateName)))throw Error('approved_identity_daria_partition_changed');
 const rest=after;
 const missing=reviewNames.filter(name=>!rest.some(r=>r.name_key===name));if(missing.length)throw Error('approved_identity_remainder_scope_missing:'+missing.join(','));
 const remaining=remainingProblemGroups(rest),summary={approvedAssociationsVerified:verified.length,nationalitiesVerified:verified.filter(r=>r.nationality).length,daria:'separate_partition_unchanged',emma:'separate_AUS_CAN_unchanged',remainingGroupsReviewed:remaining.groups.length,remainingByType:remaining.counts};
 const record={key:marker,value:JSON.stringify({status:'complete',summary})},plan=buildIncrementalSyncPlan({current:checkpoint,incoming:[record],keyOf:r=>r.key,sourceComplete:true});
 if(plan.writes)await query(`INSERT INTO app_state(key,value,updated_at) VALUES(${sqlString(marker)},${sqlString(record.value)},${sqlString(new Date().toISOString())}) ON CONFLICT(key) DO NOTHING;`);
 if((await query('SELECT value FROM app_state WHERE key='+sqlString(marker)))[0]?.value!==record.value)throw Error('approved_identity_checkpoint_readback_failed');
 return{status:'approved_links_verified_and_remainder_classified',summary,verified,daria:{status:'kept_separate',sources:after.filter(r=>r.name_key===approval.keepSeparateName).map(r=>({sourceKey:r.source_key,circuit:r.circuit,officialId:r.official_id,canonicalId:r.person_id}))},remaining};
}
async function main(){const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),id=config.d1_databases.find(r=>r.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0},report={checkedAt:new Date().toISOString(),metrics};
 async function query(sql){const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${id}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await response.json();if(!response.ok||!j.success||!j.result?.every(r=>r.success))throw Error('approved_identity_d1_failed_http_'+response.status+': '+JSON.stringify({errors:j.errors||[],resultErrors:Array.isArray(j.result)?j.result.flatMap(r=>r.errors||[r.error].filter(Boolean)):[]}));addD1Metrics(metrics,j);return j.result[0].results||[];}
 await fs.mkdir('tmp',{recursive:true});try{Object.assign(report,await applyApprovedIdentityLinks(query));}catch(error){report.status='failed';report.error=error.message;throw error;}finally{await fs.writeFile('tmp/approved-eighteen-fitp-itf-links.json',JSON.stringify(report,null,2)+'\n');console.log('APPROVED_EIGHTEEN_FITP_ITF_LINKS='+JSON.stringify(report));}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
