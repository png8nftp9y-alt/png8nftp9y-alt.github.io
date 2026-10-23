import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
import {includedPlayerIdSourceSql} from '../lib/player-id-audit-scope.mjs';
import {mergeSearchIdentities} from '../lib/paginated-player-search.mjs';
import {playerFederationMatchKey} from '../lib/player-nationality.mjs';
// D1_READ_ONLY: guarded. One finite audit; no source discovery or identity writes.
const links=`WITH links AS (SELECT l.*,COALESCE(a.canonical_id,l.canonical_id) AS person_id
 FROM player_circuit_identities l LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id
 WHERE ${includedPlayerIdSourceSql('l')})`;
const splitNames=`,split_names AS (SELECT name_key FROM links WHERE name_key<>'' GROUP BY name_key HAVING COUNT(DISTINCT person_id)>1)`;
const officialSplits=`,official_splits AS (SELECT circuit,lower(trim(official_id)) AS native_id FROM links
 WHERE (circuit='fitp' AND length(trim(official_id)) BETWEEN 6 AND 12 AND trim(official_id) NOT GLOB '*[^0-9]*')
 OR (circuit='itf' AND length(trim(official_id))=9 AND trim(official_id) GLOB '800*' AND trim(official_id) NOT GLOB '*[^0-9]*')
 OR (circuit='tennis-europe' AND length(trim(official_id))=36 AND substr(trim(official_id),9,1)='-' AND substr(trim(official_id),14,1)='-' AND substr(trim(official_id),19,1)='-' AND substr(trim(official_id),24,1)='-' AND lower(substr(trim(official_id),1,8)||substr(trim(official_id),10,4)||substr(trim(official_id),15,4)||substr(trim(official_id),20,4)||substr(trim(official_id),25,12)) NOT GLOB '*[^0-9a-f]*')
 GROUP BY circuit,lower(trim(official_id)) HAVING COUNT(DISTINCT person_id)>1)`;
export function splitIdentityReasons(rows){
 const years=new Set(),countries=new Set(),native=new Map();let missingOriginal=false;
 for(const r of rows){const p=JSON.parse(r.payload);if(r.original_missing)missingOriginal=true;
  const year=Number(p.birthYear||String(p.birthDate||p.dateOfBirth||'').slice(0,4));if(year)years.add(year);
  const country=playerFederationMatchKey(r.circuit,p.nationality||p.country);if(country)countries.add(country);
  if(r.circuit==='courtwatch')continue;
  const id=String(r.official_id||'').toLowerCase();const valid=r.circuit==='fitp'?/^\d{6,12}$/.test(id):r.circuit==='itf'?/^800\d{6}$/.test(id):/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
  if(valid){const ids=native.get(r.circuit)||new Set();ids.add(id);native.set(r.circuit,ids);}
 }
 const reasons=[];if(missingOriginal)reasons.push('original_source_missing');
 if(years.size>1)reasons.push('birth_year_conflict');if(countries.size>1)reasons.push('nationality_conflict');
 if([...native.values()].some(s=>s.size>1))reasons.push('distinct_official_ids_in_same_circuit');
 if(!reasons.length&&mergeSearchIdentities(rows.map(r=>({...r})),new Map()).length===1)reasons.push('compatible_sources_still_separate');
 if(!reasons.length)reasons.push('additional_identity_evidence_needed');
 return reasons;
}
const view=r=>{const p=JSON.parse(r.payload);return{sourceKey:r.source_key,canonicalId:r.person_id,circuit:r.circuit,officialId:r.official_id,name:r.display_name,nationality:p.nationality||p.country||'',birthYear:p.birthYear||null,birthDate:p.birthDate||p.dateOfBirth||'',originalMissing:Boolean(r.original_missing)};};
export async function auditSplitPlayerIdentities(query,{pageSize=25}={}){
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>50)throw Error('invalid_identity_audit_page_size');
 const summary=(await query(`${links}${splitNames}${officialSplits} SELECT
 (SELECT COUNT(*) FROM links) AS sourceLinks,(SELECT COUNT(DISTINCT person_id) FROM links) AS people,
 (SELECT COUNT(*) FROM split_names) AS splitNameGroups,(SELECT COUNT(*) FROM official_splits) AS splitOfficialIds,
 (SELECT COUNT(*) FROM player_identity_pending_sources) AS pendingMapping,
 (SELECT status FROM player_identity_sync WHERE id='current') AS mappingStatus`))[0];
 if(!summary)throw Error('identity_audit_summary_missing');
 const sameOfficial=await query(`${links}${officialSplits} SELECT l.source_key,l.person_id,l.circuit,l.official_id,l.display_name FROM links l JOIN official_splits s ON s.circuit=l.circuit AND s.native_id=lower(trim(l.official_id)) ORDER BY l.circuit,lower(trim(l.official_id)),l.person_id,l.source_key`);
 const names=await query(`${links}${splitNames} SELECT name_key FROM split_names ORDER BY name_key`),groups=[];
 for(let offset=0;offset<names.length;offset+=pageSize){const batch=names.slice(offset,offset+pageSize).map(r=>r.name_key),rows=await query(`WITH page AS (SELECT value AS name_key FROM json_each(?))
 SELECT l.*,COALESCE(a.canonical_id,l.canonical_id) AS person_id,COALESCE(o.payload,s.payload,c.payload,u.payload,json_object('birthYear',l.birth_year,'nationality',l.nationality,'profileUrl',l.profile_url)) AS payload,
 CASE WHEN o.source_key IS NULL AND s.source_key IS NULL AND c.id IS NULL AND u.courtwatch_id IS NULL THEN 1 ELSE 0 END AS original_missing
 FROM page CROSS JOIN player_circuit_identities l ON l.name_key=page.name_key
 LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id
 LEFT JOIN observed_players o ON o.source_key=l.source_key
 LEFT JOIN search_acquired_players s ON s.source_key=l.source_key
 LEFT JOIN app_players c ON l.circuit='courtwatch' AND c.id=l.official_id
 LEFT JOIN (SELECT courtwatch_id,MIN(payload) AS payload FROM user_app_player_additions GROUP BY courtwatch_id) u ON l.circuit='courtwatch' AND u.courtwatch_id=l.official_id
 WHERE ${includedPlayerIdSourceSql('l')} ORDER BY l.name_key,l.source_key`,[JSON.stringify(batch)]);
  if(!rows.length)throw Error('identity_audit_group_disappeared');const byName=new Map();for(const r of rows){const list=byName.get(r.name_key)||[];list.push(r);byName.set(r.name_key,list);}
  for(const [nameKey,members]of byName)groups.push({nameKey,canonicalIds:[...new Set(members.map(r=>r.person_id))],reasons:splitIdentityReasons(members),sources:members.map(view)});
 }
 const end=(await query(`${links}${splitNames}${officialSplits} SELECT (SELECT COUNT(*) FROM split_names) AS splitNameGroups,(SELECT COUNT(*) FROM official_splits) AS splitOfficialIds,(SELECT COUNT(*) FROM player_identity_pending_sources) AS pendingMapping`))[0];
 const consistent=end&&groups.length===Number(summary.splitNameGroups)&&Number(end.splitNameGroups)===Number(summary.splitNameGroups)&&Number(end.splitOfficialIds)===Number(summary.splitOfficialIds)&&!Number(summary.pendingMapping)&&!Number(end.pendingMapping)&&summary.mappingStatus==='ready';
 const reasons={};for(const g of groups)for(const reason of g.reasons)reasons[reason]=(reasons[reason]||0)+1;
 return{checkedAt:new Date().toISOString(),status:!consistent?'inconclusive_mapping_changed_or_pending':groups.length||sameOfficial.length?'identity_groups_require_review':'no_detectable_identity_splits',consistent,summary,reasons,groups,sameOfficial,end,scope:'All stored name keys shared by multiple canonical people and all exact native IDs linked to multiple people. Different spellings without common IDs cannot be proven equivalent by this audit. Conflicts are evidence to review, not proof of homonymy.'};
}
async function main(){const metrics={queries:0,rowsRead:0,rowsWritten:0},client=await openReadOnlyD1({onMetrics:rows=>{metrics.queries++;for(const r of rows){metrics.rowsRead+=Number(r.meta?.rows_read||0);metrics.rowsWritten+=Number(r.meta?.rows_written||0);}}});const report=await auditSplitPlayerIdentities(client.query);if(metrics.rowsWritten)throw Error('identity_audit_unexpected_write');report.metrics=metrics;await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/split-player-identities.json',JSON.stringify(report,null,2)+'\n');console.log('GLOBAL_IDENTITY_SPLIT_AUDIT='+JSON.stringify(report));if(!report.consistent)process.exitCode=1;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
