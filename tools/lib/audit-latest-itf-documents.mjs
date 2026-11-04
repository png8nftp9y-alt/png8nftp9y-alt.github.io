// Scope-only equivalent of the document selector: latest version per draw key,
// still ordered so the real reader selects the latest version per event.
export const legacyItfVersionsSql='SELECT draw_key,content_sha256,competition_id,event,chunk_count,content_bytes FROM itf_draw_documents WHERE competition_id=? ORDER BY event,observed_at DESC,content_sha256 DESC';
export const latestItfVersionsSql=`WITH draw_keys AS MATERIALIZED (
 SELECT DISTINCT draw_key FROM itf_draw_documents WHERE competition_id=?
) SELECT d.draw_key,d.content_sha256,d.competition_id,d.event,d.chunk_count,d.content_bytes
FROM draw_keys k JOIN itf_draw_documents d ON d.rowid=(
 SELECT v.rowid FROM itf_draw_documents v WHERE v.draw_key=k.draw_key AND v.competition_id=?
 ORDER BY v.observed_at DESC,v.content_sha256 DESC LIMIT 1
) ORDER BY d.event,d.observed_at DESC,d.content_sha256 DESC`;
export function auditLatestItfDocuments(execute){
 const metrics={rewrittenQueries:0};
 return {metrics,query:async(sql,params=[])=>{
  if(sql!==legacyItfVersionsSql)return execute(sql,params);
  if(params.length!==1||typeof params[0]!=='string')throw Error('audit_invalid_document_selector');
  metrics.rewrittenQueries++;
  return execute(latestItfVersionsSql,[params[0],params[0]]);
 }};
}
