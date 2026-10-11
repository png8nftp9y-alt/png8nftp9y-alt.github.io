import {perCircuitPlayerIdAuditSql} from './per-circuit-player-id-audit.mjs';
import {loadAcceptanceImportDiagnostics,renderAcceptanceImportDiagnostics} from './acceptance-import-diagnostics.mjs';
import {includedPlayerIdSourceSql} from './player-id-audit-scope.mjs';
import {playerNativeIdAuditCtes} from './all-player-id-audit.mjs';
// Shared native evidence includes configured players' stored official profiles.
export const playerIdDiagnosticsSql=`${playerNativeIdAuditCtes}, known AS (
 SELECT canonical_id,circuit FROM eligible_links WHERE circuit IN ('fitp','tennis-europe','itf')
 UNION SELECT canonical_id,circuit FROM native
), people AS (
 SELECT k.circuit,k.canonical_id,MAX(n.canonical_id IS NOT NULL) AS has_id FROM known k
 LEFT JOIN native n ON n.canonical_id=k.canonical_id AND n.circuit=k.circuit GROUP BY k.circuit,k.canonical_id
), circuits(circuit) AS (VALUES ('fitp'),('tennis-europe'),('itf'))
SELECT c.circuit,
 (SELECT COUNT(DISTINCT official_id) FROM native n WHERE n.circuit=c.circuit) AS ids,
 (SELECT COUNT(*) FROM people p WHERE p.circuit=c.circuit) AS players,
 (SELECT COUNT(*) FROM people p WHERE p.circuit=c.circuit AND p.has_id=0) AS missing,
 (SELECT COUNT(*) FROM player_identity_pending_sources) AS pending,
 (SELECT COUNT(*) FROM player_circuit_identities WHERE NOT (${includedPlayerIdSourceSql()})) AS excluded
FROM circuits c`;

export async function loadPlayerIdDiagnostics(db) {
 try {
  const result=await db.prepare(playerIdDiagnosticsSql).all();
  if(result.success===false||result.results?.length!==3)return null;
  const rows=result.results;
  try{const coverage=await db.prepare(perCircuitPlayerIdAuditSql).all();rows.coverage=coverage.success===false?null:coverage.results;}catch{rows.coverage=null;}
  rows.importDiagnostics=await loadAcceptanceImportDiagnostics(db);
  return rows;
 } catch { return null; }
}

export function renderPlayerIdDiagnostics(rows) {
 const labels={'fitp':'FITP','tennis-europe':'Tennis Europe','itf':'ITF'};
 const number=value=>Math.max(0,Number(value)||0).toLocaleString('it-IT');
 if(!rows)return '<section class="card" id="id-circuiti"><h2>ID giocatori per circuito</h2><p class="pill warn">Conteggi ID non disponibili: ricarica la pagina per riprovare.</p></section>';
 const excluded=Math.max(...rows.map(row=>Number(row.excluded)||0));
 const pending=Math.max(...rows.map(row=>Number(row.pending)||0));
 return `<section class="card" id="id-circuiti"><h2>ID giocatori per circuito</h2><p class="muted">Identità canoniche D1 dei giocatori osservati e presenti in app. ID ufficiali distinti; i duplicati delle fonti sono contati una sola volta. Un giocatore è mancante solo nei circuiti in cui è stato rilevato e non ha alcun ID nativo valido.</p>${pending?`<p class="pill warn">Mappatura in aggiornamento: ${number(pending)} fonti in attesa. I conteggi possono essere incompleti.</p>`:''}<table><thead><tr><th>Circuito</th><th>ID ufficiali</th><th>Giocatori rilevati</th><th>Giocatori senza ID</th></tr></thead><tbody>${['fitp','tennis-europe','itf'].map(circuit=>{const row=rows.find(row=>row.circuit===circuit);return `<tr><td><b>${labels[circuit]}</b></td><td>${number(row.ids)}</td><td>${number(row.players)}</td><td><span class="pill ${row.missing?'bad':'ok'}">${number(row.missing)}</span></td></tr>`}).join('')}</tbody></table><p class="muted">La stessa persona può avere ID in più circuiti. Conteggi letti all’apertura o alla ricarica della pagina, senza polling.</p>${excluded?`<p class="muted">Caso Moez: esclusione amministrativa risolta, ID Tennis Europe non confermato. Record esclusi dalla verifica su indicazione amministrativa: ${number(excluded)}. Conservati per tracciabilità; esclusi dai conteggi dei giocatori e degli ID mancanti.</p>`:''}<h3>ID nei record del proprio circuito</h3>${rows.coverage?.length===3?'<table><thead><tr><th>Circuito</th><th>Record verificati</th><th>Record senza ID del circuito</th></tr></thead><tbody>'+rows.coverage.map(r=>'<tr><td>'+labels[r.circuit]+'</td><td>'+number(r.source_records)+'</td><td><span class="pill '+(r.records_missing_circuit_id?'bad':'ok')+'">'+number(r.records_missing_circuit_id)+'</span></td></tr>').join('')+'</tbody></table>':'<p class="pill warn">Verifica per circuito non disponibile.</p>'}${renderAcceptanceImportDiagnostics(rows.importDiagnostics===undefined?[]:rows.importDiagnostics)}<a href="/admin/diagnostica#id-circuiti">Aggiorna conteggi</a></section>`;
}
