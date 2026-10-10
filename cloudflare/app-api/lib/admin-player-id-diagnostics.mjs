import {includedPlayerIdSourceSql} from './player-id-audit-scope.mjs';
// Count native identities, not source aliases or configured circuit eligibility.
export const playerIdDiagnosticsSql = `
WITH native AS (
 SELECT canonical_id,circuit,lower(trim(official_id)) AS official_id,
 CASE
 WHEN circuit='fitp' AND length(trim(official_id)) BETWEEN 6 AND 12
  AND trim(official_id) NOT GLOB '*[^0-9]*' THEN 1
 WHEN circuit='itf' AND length(trim(official_id))=9
  AND trim(official_id) GLOB '800*' AND trim(official_id) NOT GLOB '*[^0-9]*' THEN 1
 WHEN circuit='tennis-europe' AND length(trim(official_id))=36
  AND substr(trim(official_id),9,1)='-' AND substr(trim(official_id),14,1)='-'
  AND substr(trim(official_id),19,1)='-' AND substr(trim(official_id),24,1)='-'
  AND length(replace(trim(official_id),'-',''))=32
  AND lower(replace(trim(official_id),'-','')) NOT GLOB '*[^0-9a-f]*' THEN 1
 ELSE 0 END AS has_id
 FROM player_circuit_identities
 WHERE circuit IN ('fitp','tennis-europe','itf') AND ${includedPlayerIdSourceSql()}
), people AS (
 SELECT circuit,canonical_id,MAX(has_id) AS has_id FROM native GROUP BY circuit,canonical_id
), circuits(circuit) AS (VALUES ('fitp'),('tennis-europe'),('itf'))
SELECT c.circuit,
 (SELECT COUNT(DISTINCT official_id) FROM native n WHERE n.circuit=c.circuit AND n.has_id=1) AS ids,
 (SELECT COUNT(*) FROM people p WHERE p.circuit=c.circuit) AS players,
 (SELECT COUNT(*) FROM people p WHERE p.circuit=c.circuit AND p.has_id=0) AS missing,
 (SELECT COUNT(*) FROM player_identity_pending_sources) AS pending,
 (SELECT COUNT(*) FROM player_circuit_identities WHERE NOT (${includedPlayerIdSourceSql()})) AS excluded
FROM circuits c`;

export async function loadPlayerIdDiagnostics(db) {
 try {
  const result=await db.prepare(playerIdDiagnosticsSql).all();
  if(result.success===false||result.results?.length!==3)return null;
  return result.results;
 } catch { return null; }
}

export function renderPlayerIdDiagnostics(rows) {
 const labels={'fitp':'FITP','tennis-europe':'Tennis Europe','itf':'ITF'};
 const number=value=>Math.max(0,Number(value)||0).toLocaleString('it-IT');
 if(!rows)return '<section class="card" id="id-circuiti"><h2>ID giocatori per circuito</h2><p class="pill warn">Conteggi ID non disponibili: ricarica la pagina per riprovare.</p></section>';
 const excluded=Math.max(...rows.map(row=>Number(row.excluded)||0));
 const pending=Math.max(...rows.map(row=>Number(row.pending)||0));
 return `<section class="card" id="id-circuiti"><h2>ID giocatori per circuito</h2><p class="muted">Identità canoniche D1 dei giocatori osservati e presenti in app. ID ufficiali distinti; i duplicati delle fonti sono contati una sola volta. Un giocatore è mancante solo nei circuiti in cui è stato rilevato e non ha alcun ID nativo valido.</p>${pending?`<p class="pill warn">Mappatura in aggiornamento: ${number(pending)} fonti in attesa. I conteggi possono essere incompleti.</p>`:''}<table><thead><tr><th>Circuito</th><th>ID ufficiali</th><th>Giocatori rilevati</th><th>Giocatori senza ID</th></tr></thead><tbody>${['fitp','tennis-europe','itf'].map(circuit=>{const row=rows.find(row=>row.circuit===circuit);return `<tr><td><b>${labels[circuit]}</b></td><td>${number(row.ids)}</td><td>${number(row.players)}</td><td><span class="pill ${row.missing?'bad':'ok'}">${number(row.missing)}</span></td></tr>`}).join('')}</tbody></table><p class="muted">La stessa persona può avere ID in più circuiti. Conteggi letti all’apertura o alla ricarica della pagina, senza polling.</p>${excluded?`<p class="muted">Record esclusi dalla verifica su indicazione amministrativa: ${number(excluded)}. Conservati per tracciabilità; esclusi dai conteggi dei giocatori e degli ID mancanti.</p>`:''}<a href="/admin/diagnostica#id-circuiti">Aggiorna conteggi</a></section>`;
}
