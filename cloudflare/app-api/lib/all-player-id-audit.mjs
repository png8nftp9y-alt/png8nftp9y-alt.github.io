// D1_WRITE_POLICY: incremental; read-only aggregate query with zero mutations.
// buildIncrementalSyncPlan is unnecessary: this module only defines a SELECT.
import {includedPlayerIdSourceSql} from './player-id-audit-scope.mjs';

// One aggregate SELECT gives a consistent D1 snapshot without exporting players.
export const allPlayerIdAuditSql=`WITH eligible_links AS (
 SELECT source_key,canonical_id,circuit,official_id FROM player_circuit_identities WHERE ${includedPlayerIdSourceSql()}
), native AS (
 SELECT canonical_id,circuit,lower(trim(official_id)) AS official_id FROM eligible_links
 WHERE (circuit='fitp' AND length(trim(official_id)) BETWEEN 6 AND 12 AND trim(official_id) NOT GLOB '*[^0-9]*')
 OR (circuit='itf' AND length(trim(official_id))=9 AND trim(official_id) GLOB '800*' AND trim(official_id) NOT GLOB '*[^0-9]*')
 OR (circuit='tennis-europe' AND length(trim(official_id))=36
 AND substr(trim(official_id),9,1)='-' AND substr(trim(official_id),14,1)='-'
 AND substr(trim(official_id),19,1)='-' AND substr(trim(official_id),24,1)='-'
 AND length(replace(trim(official_id),'-',''))=32 AND lower(replace(trim(official_id),'-','')) NOT GLOB '*[^0-9a-f]*')
), people AS (
 SELECT p.canonical_id,COUNT(DISTINCT n.circuit) AS circuits FROM player_identity_people p
 JOIN (SELECT DISTINCT canonical_id FROM eligible_links) e ON e.canonical_id=p.canonical_id
 LEFT JOIN native n ON n.canonical_id=p.canonical_id GROUP BY p.canonical_id
), observed_source_refs AS (
 SELECT 'observed' AS source,source_key,source_key AS lookup_key,circuit FROM observed_players
 UNION ALL SELECT 'acquired',source_key,source_key,circuit FROM search_acquired_players
), personal_source_refs AS (
 SELECT 'configured' AS source,'courtwatch|'||id AS source_key,id AS lookup_key,'courtwatch' AS circuit FROM app_players
 UNION ALL SELECT 'personal',observed_source_key,courtwatch_id,
 CASE WHEN observed_source_key='tennis-europe|name:MOEZ BEN AMOR' THEN 'tennis-europe' ELSE 'courtwatch' END FROM user_app_player_additions
), member_source_refs AS (
 SELECT 'membership' AS source,'courtwatch|'||courtwatch_id AS source_key,courtwatch_id AS lookup_key,'courtwatch' AS circuit FROM user_app_players
 UNION ALL SELECT 'override','courtwatch|'||entity_id,entity_id,'courtwatch' FROM manual_overrides WHERE entity_type='player' AND action='upsert' AND active=1
), source_refs AS (
 SELECT * FROM observed_source_refs
 UNION ALL SELECT * FROM personal_source_refs
 UNION ALL SELECT * FROM member_source_refs
), sources AS (
 SELECT DISTINCT source,source_key,lookup_key FROM source_refs s WHERE ${includedPlayerIdSourceSql('s')}
), resolved AS (
 SELECT s.source,s.source_key,s.lookup_key,l.canonical_id FROM sources s JOIN eligible_links l ON l.source_key=s.source_key
 UNION SELECT s.source,s.source_key,s.lookup_key,a.canonical_id FROM sources s JOIN player_identity_aliases a ON a.alias_id=s.lookup_key
 UNION SELECT s.source,s.source_key,s.lookup_key,p.canonical_id FROM sources s JOIN player_identity_people p ON p.canonical_id=s.lookup_key
), source_coverage AS (
 SELECT s.source,s.source_key,s.lookup_key,COUNT(DISTINCT p.canonical_id) AS mapped FROM sources s
 LEFT JOIN resolved r ON r.source=s.source AND r.source_key=s.source_key AND r.lookup_key=s.lookup_key
 LEFT JOIN people p ON p.canonical_id=r.canonical_id GROUP BY s.source,s.source_key,s.lookup_key
)
SELECT (SELECT COUNT(*) FROM people) AS players,
 (SELECT COUNT(*) FROM people WHERE circuits>0) AS players_with_id,
 (SELECT COUNT(*) FROM people WHERE circuits=0) AS players_without_id,
 (SELECT COUNT(*) FROM people WHERE circuits>1) AS players_with_multiple_circuits,
 (SELECT COUNT(*) FROM source_coverage WHERE mapped<>1) AS unmapped_or_ambiguous_sources,
 (SELECT COUNT(*) FROM sources) AS source_records,
 (SELECT COUNT(*) FROM eligible_links l WHERE NOT EXISTS(SELECT 1 FROM player_identity_people p WHERE p.canonical_id=l.canonical_id)) AS orphan_links,
 (SELECT COUNT(*) FROM player_identity_pending_sources) AS pending_mapping,
 COALESCE((SELECT status FROM player_identity_sync WHERE id='current'),'absent') AS mapping_status,
 (SELECT COUNT(*) FROM player_circuit_identities WHERE NOT (${includedPlayerIdSourceSql()})) AS excluded_records,
 (SELECT COUNT(DISTINCT official_id) FROM native WHERE circuit='fitp') AS fitp_ids,
 (SELECT COUNT(DISTINCT official_id) FROM native WHERE circuit='tennis-europe') AS tennis_europe_ids,
 (SELECT COUNT(DISTINCT official_id) FROM native WHERE circuit='itf') AS itf_ids,
 (SELECT json_group_array(json_object('circuit',circuit,'players',n)) FROM
  (SELECT l.circuit,COUNT(DISTINCT l.canonical_id) AS n FROM eligible_links l JOIN people p ON p.canonical_id=l.canonical_id WHERE p.circuits=0 GROUP BY l.circuit)) AS missing_by_link_circuit,
 (SELECT json_group_array(json_object('source',source,'records',n)) FROM
  (SELECT source,COUNT(*) AS n FROM source_coverage WHERE mapped<>1 GROUP BY source)) AS unmapped_by_source_class,
 (SELECT COUNT(*) FROM people p JOIN player_identity_people stored ON stored.canonical_id=p.canonical_id WHERE p.circuits=0 AND EXISTS
  (SELECT 1 FROM json_each(stored.payload,'$.circuitProfiles') profile WHERE json_extract(profile.value,'$.url')<>'')) AS missing_with_stored_profile_urls,
 (SELECT COUNT(*) FROM people p JOIN player_identity_people stored ON stored.canonical_id=p.canonical_id WHERE p.circuits=0
  AND length(COALESCE(json_extract(stored.payload,'$.membershipCard'),'')) BETWEEN 6 AND 12
  AND CAST(json_extract(stored.payload,'$.membershipCard') AS TEXT) NOT GLOB '*[^0-9]*') AS missing_with_native_fitp_field,
 (SELECT COUNT(*) FROM people p JOIN player_identity_people stored ON stored.canonical_id=p.canonical_id WHERE p.circuits=0
  AND length(COALESCE(json_extract(stored.payload,'$.worldTennisId'),''))=9
  AND CAST(json_extract(stored.payload,'$.worldTennisId') AS TEXT) GLOB '800*'
  AND CAST(json_extract(stored.payload,'$.worldTennisId') AS TEXT) NOT GLOB '*[^0-9]*') AS missing_with_native_itf_field`;


export function allPlayerIdAuditResult(row) {
 if(!row)return {status:'unavailable',passed:false};
 const passed=row.players>0&&row.players===row.players_with_id&&row.players_without_id===0
 &&row.unmapped_or_ambiguous_sources===0&&row.orphan_links===0&&row.pending_mapping===0&&row.mapping_status==='ready';
 return {status:passed?'all_eligible_players_have_native_id':'player_id_coverage_incomplete',passed,...row};
}


export function cloudflareAuditError(status,body,redactions=[]) {
 const details=(body?.errors||[]).map(error=>{
  let message=String(error.message||'');
  for(const value of redactions.filter(Boolean))message=message.split(value).join('[redacted]');
  message=message.replace(/'(?:[^']|'')*'/g,"'[redacted]'").replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi,'[redacted]').replace(/\s+/g,' ').slice(0,500);
  return {code:Number(error.code)||0,message};
 });
 return 'D1_audit_request_failed_'+status+': '+JSON.stringify(details);
}
