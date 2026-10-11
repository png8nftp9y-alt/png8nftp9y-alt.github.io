// D1_WRITE_POLICY: incremental; read-only aggregate SELECT, zero mutations.
// buildIncrementalSyncPlan is unnecessary because this audit does not write.
import {playerNativeIdAuditCtes} from './all-player-id-audit.mjs';
import {includedPlayerIdSourceSql} from './player-id-audit-scope.mjs';
const validId=`(circuit='fitp' AND length(trim(official_id)) BETWEEN 6 AND 12 AND trim(official_id) NOT GLOB '*[^0-9]*')
 OR (circuit='itf' AND length(trim(official_id))=9 AND trim(official_id) GLOB '800*' AND trim(official_id) NOT GLOB '*[^0-9]*')
 OR (circuit='tennis-europe' AND length(trim(official_id))=36 AND substr(trim(official_id),9,1)='-' AND substr(trim(official_id),14,1)='-' AND substr(trim(official_id),19,1)='-' AND substr(trim(official_id),24,1)='-' AND length(replace(trim(official_id),'-',''))=32 AND lower(replace(trim(official_id),'-','')) NOT GLOB '*[^0-9a-f]*')`;
// A source record cannot be covered by an ID from a different circuit.
// Matching source keys and already mapped, validated same-circuit evidence
// are accepted; names never join records and unification is not required.
export const perCircuitPlayerIdAuditSql=`${playerNativeIdAuditCtes}, raw_refs AS (
 SELECT source_key,circuit,official_id FROM observed_players
 UNION ALL SELECT source_key,circuit,official_id FROM search_acquired_players
 UNION ALL SELECT source_key,circuit,official_id FROM eligible_links
), refs AS (
 SELECT source_key,circuit,MAX(CASE WHEN ${validId} THEN lower(trim(official_id)) ELSE '' END) AS own_id
 FROM raw_refs s WHERE circuit IN ('fitp','tennis-europe','itf') AND ${includedPlayerIdSourceSql('s')}
 GROUP BY circuit,source_key
), coverage AS (
 SELECT r.source_key,r.circuit,r.own_id,
 MAX(CASE WHEN r.own_id<>'' OR n.official_id IS NOT NULL THEN 1 ELSE 0 END) AS has_id
 FROM refs r LEFT JOIN player_circuit_identities l ON l.source_key=r.source_key AND l.circuit=r.circuit
 LEFT JOIN native n ON n.canonical_id=l.canonical_id AND n.circuit=r.circuit
 GROUP BY r.source_key,r.circuit,r.own_id
), all_native AS (
 SELECT circuit,official_id FROM native
 UNION SELECT circuit,own_id FROM refs WHERE own_id<>''
), circuits(circuit) AS (VALUES ('fitp'),('tennis-europe'),('itf'))
SELECT c.circuit,
 (SELECT COUNT(*) FROM coverage s WHERE s.circuit=c.circuit) AS source_records,
 (SELECT COUNT(*) FROM coverage s WHERE s.circuit=c.circuit AND s.has_id=1) AS records_with_circuit_id,
 (SELECT COUNT(*) FROM coverage s WHERE s.circuit=c.circuit AND s.has_id=0) AS records_missing_circuit_id,
 (SELECT COUNT(*) FROM coverage s WHERE s.circuit=c.circuit AND s.own_id<>'') AS records_with_direct_id,
 (SELECT COUNT(DISTINCT official_id) FROM all_native n WHERE n.circuit=c.circuit) AS distinct_official_ids,
 (SELECT COUNT(*) FROM player_identity_pending_sources) AS pending_mapping,
 (SELECT COUNT(*) FROM player_circuit_identities WHERE NOT (${includedPlayerIdSourceSql()})) AS excluded_records
FROM circuits c`;
export function perCircuitPlayerIdAuditResult(rows){
 const expected=['fitp','tennis-europe','itf'];
 if(!Array.isArray(rows)||rows.length!==3||expected.some(c=>rows.filter(r=>r.circuit===c).length!==1))return{status:'unavailable',passed:false};
 const circuits=expected.map(circuit=>rows.find(r=>r.circuit===circuit));
 const passed=circuits.every(r=>r.source_records>0&&r.records_missing_circuit_id===0&&r.records_with_circuit_id===r.source_records);
 return{status:passed?'all_circuit_records_have_own_circuit_id':'per_circuit_id_coverage_incomplete',passed,circuits};
}
