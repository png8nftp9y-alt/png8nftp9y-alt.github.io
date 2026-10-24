import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
import {buildIdentityMapping} from '../lib/player-identity-mapping.mjs';
import {syncPlayerIdentities,addD1Metrics} from './sync-player-identities.mjs';
import {buildIncrementalSyncPlan} from '../lib/d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental. User-approved exact IDs only; no ranking rule
// is introduced for other names or future players. Original sources unchanged.
export const approval=JSON.parse(await fs.readFile(new URL('../data/user-approved-four-identity-links-20261024.json',import.meta.url),'utf8'));
const marker='approvedFourIdentityAssociations:20261024:v1',keyOf=r=>r.circuit+'|'+String(r.official_id||r.officialId||'').toLowerCase();
export function approvedRules(entries=approval.associations){return entries.flatMap(entry=>entry.identities.slice(1).map((id,i)=>({key:'confirmedPlayerCircuitLink:approved-four-20261024:'+entry.nameKey.toLowerCase().replaceAll(' ','-')+':'+i,value:JSON.stringify({nameKey:entry.nameKey,identities:[entry.identities[0],id],reason:'Explicit user confirmation 24 October 2026; exact approved native IDs',...(entry.currentNationality?{currentNationality:entry.currentNationality}:{})})})));}
async function readSources(query,names){const rows=[];for(let i=0;i<names.length;i+=20)rows.push(...await query(`SELECT l.*,COALESCE(a.canonical_id,l.canonical_id) AS person_id,
 CASE WHEN o.source_key IS NOT NULL THEN 'observed_players' WHEN s.source_key IS NOT NULL THEN 'search_acquired_players' ELSE '' END AS source_table,
 COALESCE(o.payload,s.payload) AS payload
 FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id
 LEFT JOIN observed_players o ON o.source_key=l.source_key LEFT JOIN search_acquired_players s ON s.source_key=l.source_key
 WHERE l.name_key IN (${names.slice(i,i+20).map(sqlString).join(',')}) ORDER BY l.name_key,l.source_key`));return rows;}
function verifyAssociation(entry,rows){const wanted=new Set(entry.identities.map(keyOf)),native=rows.filter(r=>wanted.has(keyOf(r))),seen=new Set(native.map(keyOf));
 if(seen.size!==wanted.size)throw Error('approved_identity_native_missing:'+entry.nameKey);
 if(new Set(native.map(r=>r.person_id||r.canonical_id)).size!==1)throw Error('approved_identity_not_unified:'+entry.nameKey);
 const person=native[0].person_id||native[0].canonical_id;
 if(rows.some(r=>entry.excludedFitpCards.includes(r.official_id)&&(r.person_id||r.canonical_id)===person))throw Error('approved_identity_excluded_card_merged:'+entry.nameKey);
 return person;
}
function samePartition(before,after){if(before.length!==after.length)return false;const by=new Map(after.map(r=>[r.source_key,r.person_id]));if(before.some(r=>!by.has(r.source_key)))return false;return before.every(a=>before.every(b=>(a.person_id===b.person_id)===(by.get(a.source_key)===by.get(b.source_key))));}
export function remainingProblemGroups(rows,{closedEmptyCards=new Set(['2932830','2963170','4064532','5498291','5654928','5837322','5909083','6349806','6371799','8170710','9738435','9967731'])}={}){
 const handled=new Set([...approval.associations.map(r=>r.nameKey),approval.keepSeparateName]),groups=new Map(),items=[];
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
 const counts={};for(const g of items)counts[g.type]=(counts[g.type]||0)+1;return{scope:'Four explicitly approved FITP-Europe pairs; Daria control kept unchanged. Closed empty FITP sheet IDs are not reopened.',counts,groups:items};
}
export async function applyApprovedIdentityLinks(query,{reviewNames=approval.reviewNames}={}){
 const checkpoint=await query('SELECT key,value FROM app_state WHERE key='+sqlString(marker));if(checkpoint.length){const saved=JSON.parse(checkpoint[0].value);if(saved.status!=='complete')throw Error('approved_identity_checkpoint_invalid');return{status:'already_completed',summary:saved.summary};}
 const targets=approval.associations.map(r=>r.nameKey),names=[...targets,approval.keepSeparateName],before=await readSources(query,names),existing=(await query("SELECT key,value FROM app_state WHERE key LIKE 'confirmedPlayerCircuitLink:%' ORDER BY key")),rules=approvedRules();
 if(new Set(targets).size!==4||rules.length!==4)throw Error('approved_identity_manifest_invalid');
 const daria=before.filter(r=>r.name_key===approval.keepSeparateName);if(!daria.length||new Set(daria.map(r=>r.person_id)).size<2)throw Error('approved_identity_daria_not_separate');
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
 await syncPlayerIdentities(query,{pendingSources:scope});
 const after=await readSources(query,names),verified=[];
 for(const entry of approval.associations){const saved=after.filter(r=>r.name_key===entry.nameKey),original=before.filter(r=>r.name_key===entry.nameKey);if(saved.length!==original.length||original.some(r=>!saved.some(s=>s.source_key===r.source_key)))throw Error('approved_identity_sources_lost');
  const person=verifyAssociation(entry,saved),payload=JSON.parse((await query('SELECT payload FROM player_identity_people WHERE canonical_id='+sqlString(person)))[0]?.payload||'{}');
  if(entry.currentNationality&&payload.nationality!==entry.currentNationality)throw Error('approved_identity_nationality_not_verified');
  verified.push({name:entry.nameKey,canonicalId:person,identities:entry.identities,excludedFitpCards:entry.excludedFitpCards,...(entry.currentNationality?{nationality:payload.nationality}:{})});
 }
 if(!samePartition(daria,after.filter(r=>r.name_key===approval.keepSeparateName)))throw Error('approved_identity_daria_partition_changed');
 const rest=[];for(let i=0;i<reviewNames.length;i+=30)rest.push(...await query(`SELECT l.*,COALESCE(a.canonical_id,l.canonical_id) AS person_id FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id WHERE l.name_key IN (${reviewNames.slice(i,i+30).map(sqlString).join(',')}) ORDER BY l.name_key,l.source_key`));
 const missing=reviewNames.filter(name=>!rest.some(r=>r.name_key===name));if(missing.length)throw Error('approved_identity_remainder_scope_missing:'+missing.join(','));
 const remaining=remainingProblemGroups(rest),summary={approvedAssociationsVerified:verified.length,fitpEuropeVerified:verified.filter(r=>r.identities.length===2).length,daria:'separate_partition_unchanged',remainingGroupsReviewed:remaining.groups.length,remainingByType:remaining.counts};
 const record={key:marker,value:JSON.stringify({status:'complete',summary})},plan=buildIncrementalSyncPlan({current:checkpoint,incoming:[record],keyOf:r=>r.key,sourceComplete:true});
 if(plan.writes)await query(`INSERT INTO app_state(key,value,updated_at) VALUES(${sqlString(marker)},${sqlString(record.value)},${sqlString(new Date().toISOString())}) ON CONFLICT(key) DO NOTHING;`);
 if((await query('SELECT value FROM app_state WHERE key='+sqlString(marker)))[0]?.value!==record.value)throw Error('approved_identity_checkpoint_readback_failed');
 return{status:'approved_links_verified_and_remainder_classified',summary,verified,daria:{status:'kept_separate',sources:after.filter(r=>r.name_key===approval.keepSeparateName).map(r=>({sourceKey:r.source_key,circuit:r.circuit,officialId:r.official_id,canonicalId:r.person_id}))},remaining};
}
async function main(){const config=JSON.parse(await fs.readFile('wrangler.generated.jsonc','utf8')),id=config.d1_databases.find(r=>r.binding==='DB').database_id,metrics={rowsRead:0,rowsWritten:0},report={checkedAt:new Date().toISOString(),metrics};
 async function query(sql){const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${id}/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(60000)}),j=await response.json();if(!response.ok||!j.success||!j.result?.every(r=>r.success))throw Error('approved_identity_d1_failed_http_'+response.status+': '+JSON.stringify({errors:j.errors||[],resultErrors:Array.isArray(j.result)?j.result.flatMap(r=>r.errors||[r.error].filter(Boolean)):[]}));addD1Metrics(metrics,j);return j.result[0].results||[];}
 await fs.mkdir('tmp',{recursive:true});try{Object.assign(report,await applyApprovedIdentityLinks(query));}catch(error){report.status='failed';report.error=error.message;throw error;}finally{await fs.writeFile('tmp/approved-four-identity-links.json',JSON.stringify(report,null,2)+'\n');console.log('APPROVED_FOUR_IDENTITY_LINKS='+JSON.stringify(report));}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
