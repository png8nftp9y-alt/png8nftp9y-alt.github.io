// D1_WRITE_POLICY: incremental; read-only aggregate query with zero mutations.
// buildIncrementalSyncPlan is unnecessary: this module only defines a SELECT.
import {includedPlayerIdSourceSql} from './player-id-audit-scope.mjs';

// One aggregate SELECT gives a consistent D1 snapshot without exporting players.
export const playerNativeIdAuditCtes=`WITH RECURSIVE eligible_links AS (
 SELECT source_key,canonical_id,circuit,official_id FROM player_circuit_identities WHERE ${includedPlayerIdSourceSql()}
), link_native AS (
 SELECT canonical_id,circuit,lower(trim(official_id)) AS official_id FROM eligible_links
 WHERE (circuit='fitp' AND length(trim(official_id)) BETWEEN 6 AND 12 AND trim(official_id) NOT GLOB '*[^0-9]*')
 OR (circuit='itf' AND length(trim(official_id))=9 AND trim(official_id) GLOB '800*' AND trim(official_id) NOT GLOB '*[^0-9]*')
 OR (circuit='tennis-europe' AND length(trim(official_id))=36
 AND substr(trim(official_id),9,1)='-' AND substr(trim(official_id),14,1)='-'
 AND substr(trim(official_id),19,1)='-' AND substr(trim(official_id),24,1)='-'
 AND length(replace(trim(official_id),'-',''))=32 AND lower(replace(trim(official_id),'-','')) NOT GLOB '*[^0-9a-f]*')
), canonical_profiles AS (
 SELECT p.canonical_id,json_extract(profile.value,'$.circuit') AS circuit,json_extract(profile.value,'$.url') AS url
 FROM player_identity_people p JOIN (SELECT DISTINCT canonical_id FROM eligible_links WHERE circuit='courtwatch') e ON e.canonical_id=p.canonical_id,
 json_each(p.payload,'$.circuitProfiles') profile WHERE json_extract(profile.value,'$.url')<>''
), profile_paths AS (
 SELECT canonical_id,circuit,
 CASE WHEN circuit='tennis-europe' AND lower(substr(url,1,49))='https://te.tournamentsoftware.com/player-profile/' THEN rtrim(substr(url,50),'/') ELSE '' END AS te_id,
 CASE WHEN circuit='itf' AND lower(substr(url,1,37))='https://www.itftennis.com/en/players/' THEN substr(url,38)
 WHEN circuit='itf' AND lower(substr(url,1,33))='https://itftennis.com/en/players/' THEN substr(url,34) ELSE '' END AS itf_path,
 CASE WHEN circuit='fitp' AND lower(substr(url,1,49))='https://www.fitp.it/pagina-giocatore/?cardnumber=' THEN substr(url,50)
 WHEN circuit='fitp' AND lower(substr(url,1,45))='https://fitp.it/pagina-giocatore/?cardnumber=' THEN substr(url,46) ELSE '' END AS fitp_query
 FROM canonical_profiles
), fitp_encoded AS (
 SELECT canonical_id,replace(replace(CASE WHEN instr(fitp_query,'&')>0 THEN substr(fitp_query,1,instr(fitp_query,'&')-1) ELSE fitp_query END,'%3D','='),'%3d','=') AS encoded FROM profile_paths WHERE circuit='fitp'
), fitp_decoded(canonical_id,encoded,pos,official_id) AS (
 SELECT canonical_id,encoded,1,'' FROM fitp_encoded WHERE length(encoded) BETWEEN 8 AND 16 AND length(encoded)%4=0 AND encoded NOT GLOB '*[^A-Za-z0-9+/=]*'
 UNION ALL SELECT canonical_id,encoded,pos+4,official_id||
 CASE WHEN substr(encoded,pos+2,1)='=' THEN char((((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+0,1))-1)<<2)|((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+1,1))-1)>>4)))
 WHEN substr(encoded,pos+3,1)='=' THEN char((((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+0,1))-1)<<2)|((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+1,1))-1)>>4)),((((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+1,1))-1)&15)<<4)|((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+2,1))-1)>>2))) ELSE char((((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+0,1))-1)<<2)|((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+1,1))-1)>>4)),((((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+1,1))-1)&15)<<4)|((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+2,1))-1)>>2)),((((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+2,1))-1)&3)<<6)|(instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+3,1))-1))) END
 FROM fitp_decoded WHERE pos<=length(encoded) AND (((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+0,1))-1)<<2)|((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+1,1))-1)>>4)) BETWEEN 48 AND 57
 AND (substr(encoded,pos+2,2)='==' AND pos+3=length(encoded)
 OR substr(encoded,pos+2,1)<>'=' AND ((((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+1,1))-1)&15)<<4)|((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+2,1))-1)>>2)) BETWEEN 48 AND 57
 AND (substr(encoded,pos+3,1)='=' AND pos+3=length(encoded) OR substr(encoded,pos+3,1)<>'=' AND ((((instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+2,1))-1)&3)<<6)|(instr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',substr(encoded,pos+3,1))-1)) BETWEEN 48 AND 57))
), profile_native AS (
 SELECT canonical_id,'tennis-europe' AS circuit,lower(te_id) AS official_id FROM profile_paths
 WHERE length(te_id)=36 AND substr(te_id,9,1)='-' AND substr(te_id,14,1)='-' AND substr(te_id,19,1)='-' AND substr(te_id,24,1)='-'
 AND length(replace(te_id,'-',''))=32 AND lower(replace(te_id,'-','')) NOT GLOB '*[^0-9a-f]*'
 UNION ALL SELECT canonical_id,'itf',substr(itf_path,instr(itf_path,'/')+1,9) FROM profile_paths WHERE circuit='itf' AND instr(itf_path,'/')>1
 AND substr(itf_path,instr(itf_path,'/')+10,1)='/' AND substr(itf_path,instr(itf_path,'/')+1,9) GLOB '800*'
 AND substr(itf_path,instr(itf_path,'/')+1,9) NOT GLOB '*[^0-9]*' AND length(substr(itf_path,instr(itf_path,'/')+1,9))=9
 UNION ALL SELECT canonical_id,'fitp',official_id FROM fitp_decoded WHERE pos>length(encoded) AND length(official_id) BETWEEN 6 AND 12 AND official_id NOT GLOB '*[^0-9]*'
), native AS (
 SELECT canonical_id,circuit,official_id FROM link_native
 UNION SELECT canonical_id,circuit,official_id FROM profile_native
)`;

export const allPlayerIdAuditSql=`${playerNativeIdAuditCtes}, people AS (
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
 SELECT 'membership' AS source,courtwatch_id AS source_key,courtwatch_id AS lookup_key,'courtwatch' AS circuit FROM user_app_players
 UNION ALL SELECT 'override','courtwatch|'||entity_id,entity_id,'courtwatch' FROM manual_overrides WHERE entity_type='player' AND action='upsert' AND active=1
), source_refs AS (
 SELECT * FROM observed_source_refs
 UNION ALL SELECT * FROM personal_source_refs
 UNION ALL SELECT * FROM member_source_refs
), sources AS (
 SELECT DISTINCT source,source_key,lookup_key FROM source_refs s WHERE ${includedPlayerIdSourceSql('s')}
), resolved_links AS (
 SELECT s.source,s.source_key,s.lookup_key,COALESCE(a.canonical_id,l.canonical_id) AS canonical_id FROM sources s JOIN player_circuit_identities l ON l.source_key=s.source_key LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id WHERE ${includedPlayerIdSourceSql('l')}
 UNION SELECT s.source,s.source_key,s.lookup_key,COALESCE(a.canonical_id,l.canonical_id) FROM sources s JOIN player_circuit_identities l ON l.source_key=s.lookup_key LEFT JOIN player_identity_aliases a ON a.alias_id=l.canonical_id WHERE ${includedPlayerIdSourceSql('l')}
), resolved AS (
 SELECT source,source_key,lookup_key,canonical_id FROM resolved_links
 UNION SELECT s.source,s.source_key,s.lookup_key,a.canonical_id FROM sources s JOIN player_identity_aliases a ON a.alias_id=s.lookup_key
 UNION SELECT s.source,s.source_key,s.lookup_key,p.canonical_id FROM sources s JOIN player_identity_people p ON p.canonical_id=s.lookup_key WHERE NOT EXISTS(SELECT 1 FROM player_identity_aliases a WHERE a.alias_id=s.lookup_key)
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
 (SELECT json_group_array(json_object('source',source,'mapped_players',mapped,'records',n)) FROM
  (SELECT source,mapped,COUNT(*) AS n FROM source_coverage WHERE mapped<>1 GROUP BY source,mapped)) AS unmapped_mapping_breakdown,
 (SELECT COUNT(*) FROM source_coverage s WHERE s.mapped<>1 AND EXISTS
  (SELECT 1 FROM player_circuit_identities excluded WHERE NOT (${includedPlayerIdSourceSql('excluded')} )
   AND (excluded.source_key=s.source_key OR excluded.source_key=s.lookup_key OR excluded.canonical_id=s.lookup_key
    OR EXISTS(SELECT 1 FROM player_identity_aliases a WHERE a.alias_id=s.lookup_key AND a.canonical_id=excluded.canonical_id)))) AS unresolved_refs_to_excluded_identity,

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
