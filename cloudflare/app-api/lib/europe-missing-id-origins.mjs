import {playerNativeIdAuditCtes} from './all-player-id-audit.mjs';
// Read-only, same native-ID scope as the admin counter; no exported player names.
export const europeMissingIdOriginsSql=`${playerNativeIdAuditCtes}, missing AS (
 SELECT DISTINCT l.canonical_id FROM eligible_links l WHERE l.circuit='tennis-europe'
 AND NOT EXISTS(SELECT 1 FROM native n WHERE n.canonical_id=l.canonical_id AND n.circuit='tennis-europe')
), origins AS (
 SELECT l.canonical_id,l.source_key,
 CASE WHEN l.source_key LIKE 'acceptance|%' THEN 'acceptance_list'
 WHEN l.source_key LIKE 'acquired|%' THEN 'acquired_draw_or_history'
 WHEN l.source_key LIKE 'tennis-europe|name:%' THEN 'legacy_observed_name'
 ELSE 'other_retained_source' END AS origin,
 CASE WHEN EXISTS(SELECT 1 FROM observed_players o WHERE o.source_key=l.source_key) THEN 'observed_players'
 WHEN EXISTS(SELECT 1 FROM search_acquired_players a WHERE a.source_key=l.source_key) THEN 'search_acquired_players'
 ELSE 'retained_identity_mapping' END AS storage,
 CASE WHEN trim(COALESCE(l.official_id,''))='' THEN 'absent' ELSE 'invalid_format' END AS id_state
 FROM eligible_links l JOIN missing m ON m.canonical_id=l.canonical_id WHERE l.circuit='tennis-europe'
)
SELECT (SELECT COUNT(*) FROM missing) AS missing_people,
 (SELECT COUNT(*) FROM player_identity_pending_sources) AS pending_mapping,
 (SELECT json_group_array(json_object('origin',origin,'storage',storage,'idState',id_state,'people',people,'records',records))
 FROM (SELECT origin,storage,id_state,COUNT(DISTINCT canonical_id) AS people,COUNT(*) AS records FROM origins GROUP BY origin,storage,id_state)) AS origins,
 (SELECT value FROM app_state WHERE key='acceptanceDiagnostics:tennis-europe') AS acceptance_diagnostic`;
export function europeMissingIdOriginsResult(row){
 if(!row||![row.missing_people,row.pending_mapping].every(v=>v!=null&&Number.isSafeInteger(Number(v))&&Number(v)>=0))throw Error('Europe_origin_counts_unavailable');
 const diagnostic=row.acceptance_diagnostic?JSON.parse(row.acceptance_diagnostic):null;
 const unsaved=diagnostic?.unsaved;
 const reasons={};if(Array.isArray(unsaved))for(const r of unsaved)reasons[r.reason]=(reasons[r.reason]||0)+1;
 return {missingPeople:Number(row.missing_people),pendingMapping:Number(row.pending_mapping),origins:JSON.parse(row.origins||'[]'),
 acceptance:diagnostic?{status:diagnostic.status,reason:diagnostic.reason,participants:diagnostic.participants,unsavedRecords:Array.isArray(unsaved)?unsaved.length:null,reasons}:null};
}
