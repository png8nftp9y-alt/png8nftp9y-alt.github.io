import {perCircuitPlayerIdAuditCtes} from './per-circuit-player-id-audit.mjs';
import {loadAcceptanceImportDiagnostics,renderAcceptanceImportDiagnostics} from './acceptance-import-diagnostics.mjs';
import {includedPlayerIdSourceSql} from './player-id-audit-scope.mjs';
// Shared native evidence includes configured players' stored official profiles.
export const playerIdDiagnosticsSql=`${perCircuitPlayerIdAuditCtes}, known AS (
 SELECT canonical_id,circuit FROM eligible_links WHERE circuit IN ('fitp','tennis-europe','itf')
 UNION SELECT canonical_id,circuit FROM native_people
), people AS (
 SELECT k.circuit,k.canonical_id,n.canonical_id IS NOT NULL AS has_id FROM known k
 LEFT JOIN native_people n ON n.canonical_id=k.canonical_id AND n.circuit=k.circuit
), native_counts AS (
 SELECT circuit,COUNT(DISTINCT official_id) AS ids FROM native GROUP BY circuit
), people_counts AS (
 SELECT circuit,COUNT(*) AS players,SUM(has_id=0) AS missing FROM people GROUP BY circuit
), coverage_counts AS (
 SELECT circuit,COUNT(*) AS source_records,SUM(has_id=1) AS records_with_circuit_id,
 SUM(has_id=0) AS records_missing_circuit_id,SUM(own_id<>'') AS records_with_direct_id
 FROM coverage GROUP BY circuit
), source_id_counts AS (
 SELECT circuit,COUNT(DISTINCT official_id) AS distinct_official_ids FROM all_native GROUP BY circuit
), global_counts AS (
 SELECT (SELECT COUNT(*) FROM player_identity_pending_sources) AS pending,
 (SELECT COUNT(*) FROM player_circuit_identities WHERE NOT (${includedPlayerIdSourceSql()})) AS excluded
), circuits(circuit) AS (VALUES ('fitp'),('tennis-europe'),('itf'))
SELECT c.circuit,COALESCE(n.ids,0) AS ids,COALESCE(p.players,0) AS players,COALESCE(p.missing,0) AS missing,
 g.pending,g.excluded,COALESCE(s.source_records,0) AS source_records,
 COALESCE(s.records_with_circuit_id,0) AS records_with_circuit_id,
 COALESCE(s.records_missing_circuit_id,0) AS records_missing_circuit_id,
 COALESCE(s.records_with_direct_id,0) AS records_with_direct_id,
 COALESCE(i.distinct_official_ids,0) AS distinct_official_ids,g.pending AS pending_mapping,g.excluded AS excluded_records
FROM circuits c CROSS JOIN global_counts g LEFT JOIN native_counts n ON n.circuit=c.circuit
LEFT JOIN people_counts p ON p.circuit=c.circuit LEFT JOIN coverage_counts s ON s.circuit=c.circuit
LEFT JOIN source_id_counts i ON i.circuit=c.circuit`;


export async function loadPlayerIdDiagnostics(db) {
 try {
  const [result,importDiagnostics]=await Promise.all([db.prepare(playerIdDiagnosticsSql).all(),loadAcceptanceImportDiagnostics(db)]);
  if(result.success===false||result.results?.length!==3)return null;
  const rows=result.results;
  const coverageFields=['circuit','source_records','records_with_circuit_id','records_missing_circuit_id','records_with_direct_id','distinct_official_ids','pending_mapping','excluded_records'];
  rows.coverage=rows.map(row=>Object.fromEntries(coverageFields.map(field=>[field,row[field]])));
  rows.importDiagnostics=importDiagnostics;
  rows.checkedAt=new Date().toISOString();
  return rows;
 } catch { return null; }
}

export function renderPlayerIdDiagnostics(rows) {
 const labels={'fitp':'FITP','tennis-europe':'Tennis Europe','itf':'ITF'};
 const number=value=>Math.max(0,Number(value)||0).toLocaleString('it-IT');
 if(!rows)return '<section class="card" id="id-circuiti"><h2>ID giocatori per circuito</h2><p class="pill warn">Conteggi ID non disponibili: ricarica la pagina per riprovare.</p></section>';
 const excluded=Math.max(...rows.map(row=>Number(row.excluded)||0));
 const pending=Math.max(...rows.map(row=>Number(row.pending)||0));
 const checkedAt=rows.checkedAt;
 const refresh='<form method="get" action="/admin/id#id-circuiti"><button type="submit" name="refreshIds" value="1">Aggiorna conteggi</button></form>';
 return `<section class="card" id="id-circuiti"><h2>ID giocatori per circuito</h2><p class="muted">Identità canoniche D1 dei giocatori osservati e presenti in app. ID ufficiali distinti; i duplicati delle fonti sono contati una sola volta. Un giocatore è mancante solo nei circuiti in cui è stato rilevato e non ha alcun ID nativo valido.</p>${pending?`<p class="pill warn">Mappatura in aggiornamento: ${number(pending)} fonti in attesa. I conteggi possono essere incompleti.</p>`:''}<table><thead><tr><th>Circuito</th><th>ID ufficiali</th><th>Giocatori rilevati</th><th>Giocatori senza ID</th></tr></thead><tbody>${['fitp','tennis-europe','itf'].map(circuit=>{const row=rows.find(row=>row.circuit===circuit);return `<tr><td><b>${labels[circuit]}</b></td><td>${number(row.ids)}</td><td>${number(row.players)}</td><td><span class="pill ${row.missing?'bad':'ok'}">${number(row.missing)}</span></td></tr>`}).join('')}</tbody></table><p class="muted">La stessa persona può avere ID in più circuiti. Conteggi letti da D1 all’apertura o con Aggiorna conteggi, senza polling.</p>${checkedAt&&Number.isFinite(Date.parse(checkedAt))?`<p class="muted">Lettura D1: <time datetime="${new Date(checkedAt).toISOString()}">${new Date(checkedAt).toISOString()}</time></p>`:''}${excluded?`<p class="muted">Caso Moez: esclusione amministrativa risolta, ID Tennis Europe non confermato. Record esclusi dalla verifica su indicazione amministrativa: ${number(excluded)}. Conservati per tracciabilità; esclusi dai conteggi dei giocatori e degli ID mancanti.</p>`:''}<h3>ID nei record del proprio circuito</h3><p class="muted">Conteggio delle fonti, distinto dal numero di persone: più record possono appartenere allo stesso giocatore.</p>${rows.coverage?.length===3?'<table><thead><tr><th>Circuito</th><th>Record verificati</th><th>Record senza ID del circuito</th></tr></thead><tbody>'+rows.coverage.map(r=>'<tr><td>'+labels[r.circuit]+'</td><td>'+number(r.source_records)+'</td><td><span class="pill '+(r.records_missing_circuit_id?'bad':'ok')+'">'+number(r.records_missing_circuit_id)+'</span></td></tr>').join('')+'</tbody></table>':'<p class="pill warn">Verifica per circuito non disponibile.</p>'}${renderAcceptanceImportDiagnostics(rows.importDiagnostics===undefined?[]:rows.importDiagnostics)}${refresh}</section>`;
}
