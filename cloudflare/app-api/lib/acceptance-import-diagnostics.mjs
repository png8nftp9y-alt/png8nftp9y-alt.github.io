import {validOfficialId} from './player-profile-evidence.mjs';
import {buildIncrementalSyncPlan} from './d1-incremental-sync.mjs';
import {sqlString} from '../../../src/v3/itf-draw-document-d1.mjs';
// D1_WRITE_POLICY: incremental. Diagnostic snapshots only; never create ID-less players.
export const acceptanceDiagnosticsKey=circuit=>'acceptanceDiagnostics:'+circuit;
export async function saveAcceptanceImportDiagnostics(query,circuit,{rows=null,status,reason=''}) {
 if(!['fitp','tennis-europe','itf'].includes(circuit))return;
 const key=acceptanceDiagnosticsKey(circuit),previous=(await query('SELECT value FROM app_state WHERE key='+sqlString(key)))[0];
 if(status==='complete'&&previous){const prior=JSON.parse(previous.value);if(prior.status==='complete'&&prior.participants===rows?.length&&prior.unsaved?.length===0)return prior;}
 let unsaved=null;
 if(rows){
  unsaved=[];
  for(let i=0;i<rows.length;i+=40){
   const batch=rows.slice(i,i+40),found=await query('SELECT source_key,circuit,official_id FROM observed_players WHERE source_key IN ('+batch.map(r=>sqlString(r.source_key)).join(',')+')');
   const saved=new Map(found.map(r=>[r.source_key,r]));
   for(const r of batch){const p=saved.get(r.source_key);if(!p||p.circuit!==r.circuit||!validOfficialId(circuit,p.official_id)||(validOfficialId(circuit,r.official_id)&&p.official_id!==r.official_id))unsaved.push({source_key:r.source_key,name:r.display_name,reason:validOfficialId(circuit,r.official_id)?'import_blocked':reason});}
  }
 }
 const snapshot={status,reason,participants:rows?.length??null,unsaved};
 const incoming={key,value:JSON.stringify(snapshot)},current=previous?[{key,value:previous.value}]:[];
 const plan=buildIncrementalSyncPlan({current,incoming:[incoming],keyOf:r=>r.key,sourceComplete:true});
 if(plan.writes)await query('INSERT INTO app_state(key,value,updated_at) VALUES('+[key,incoming.value,new Date().toISOString()].map(sqlString).join(',')+') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE value IS NOT excluded.value;');
 return snapshot;
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={fitp:'FITP','tennis-europe':'Tennis Europe',itf:'ITF'};
const reasons={id_required:'ID del circuito non recuperato o in conflitto',source_incomplete:'Lista incompleta o nome non verificabile',save_unverified:'Salvataggio non confermato',identity_pending:'Indicizzazione non completata',import_failed:'Import non completato',import_blocked:'Import bloccato prima del salvataggio'};
export async function loadAcceptanceImportDiagnostics(db){
 try{const result=await db.prepare("SELECT key,value,updated_at FROM app_state WHERE key IN ('acceptanceDiagnostics:fitp','acceptanceDiagnostics:tennis-europe','acceptanceDiagnostics:itf')").all();if(result.success===false)return null;
  return result.results.map(r=>({circuit:r.key.split(':')[1],...JSON.parse(r.value),changedAt:r.updated_at}));
 }catch{return null}
}
export function renderAcceptanceImportDiagnostics(rows){
 const intro='<h3>Giocatori letti dalle liste e non salvati</h3><p class="muted">Ultimo tentativo di acquisizione per circuito. Il controllo include anche i nuovi nomi bloccati prima di entrare in D1. Non copre nomi omessi dal lettore della lista: questi richiedono un confronto con la fonte originale.</p>';
 if(!rows)return intro+'<p class="pill warn">Registro import non disponibile.</p>';
 return intro+'<table><thead><tr><th>Circuito</th><th>Ultimo import</th><th>Non salvati</th><th>Ultima variazione</th></tr></thead><tbody>'+Object.keys(labels).map(c=>{
  const r=rows.find(r=>r.circuit===c);return '<tr><td>'+labels[c]+'</td><td>'+(!r?'Non ancora verificato':r.status==='complete'?'Completato':escape(reasons[r.reason]||reasons.import_failed))+'</td><td>'+(!r||r.unsaved===null?'Non disponibile':r.unsaved.length.toLocaleString('it-IT'))+'</td><td>'+escape(r?.changedAt||'—')+'</td></tr>';
 }).join('')+'</tbody></table>'+rows.filter(r=>r.unsaved?.length).map(r=>'<details><summary>'+labels[r.circuit]+': '+r.unsaved.length+' nomi da riprocessare</summary><table><thead><tr><th>Nome letto</th><th>Motivo</th></tr></thead><tbody>'+r.unsaved.map(p=>'<tr><td>'+escape(p.name)+'</td><td>'+escape(reasons[p.reason]||reasons.import_failed)+'</td></tr>').join('')+'</tbody></table></details>').join('')+'<p class="muted">Un import bloccato non è una registrazione completata. I nomi saranno riprocessati al prossimo run del circuito. Un registro assente non equivale a zero problemi. Nessun polling.</p>';
}
