import {observedBirthScopeSql} from './observed-player-birth-scope.mjs';
import {birthYear,birthDate,applyBirthEvidence} from './player-birth-metadata.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse=v=>{try{return JSON.parse(v||'{}')}catch{return{}}};
export async function loadObservedBirthAdmin(db,userId='user-federico-181099'){
 try{
  const r=await db.prepare(observedBirthScopeSql).bind(userId).all();if(r.success===false)throw Error('birth_membership_unavailable');
  const selected=r.results||[];if(selected.length>500)throw Error('birth_scope_too_large');
  const ids=[...new Set(selected.map(r=>r.canonical_id))],evidence=[];let pendingSchema=false;
  try{for(let i=0;i<ids.length;i+=80)evidence.push(...((await db.prepare('SELECT b.* FROM json_each(?) ids JOIN player_birth_metadata b ON b.canonical_id=ids.value').bind(JSON.stringify(ids.slice(i,i+80))).all()).results||[]));}
  catch(e){if(/no such table: (?:main\.)?player_birth_metadata/i.test(e.message))pendingSchema=true;else throw e;}
  const missing=[];
  for(const row of selected){
   const canonical=parse(row.identity_payload),personal=parse(row.payload);if(!personal.name||personal.id!==row.courtwatch_id)throw Error('birth_membership_incomplete');
   const sourceRows=evidence.filter(e=>e.canonical_id===row.canonical_id),p=applyBirthEvidence({...canonical,...personal},sourceRows);
   const year=birthYear(p.birthYear)||birthYear(birthDate(p.birthDate||p.dateOfBirth).slice(0,4));
   if(year&&p.birthYearStatus!=='conflict')continue;
   const profiles=[...new Map([...(canonical.circuitProfiles||[]),...(personal.circuitProfiles||[])].map(v=>[v.circuit+'|'+v.url,v])).values()];
   missing.push({id:row.courtwatch_id,canonicalId:row.canonical_id,name:personal.name,lists:[...(row.in_main?['TCL']:[]),...(row.in_others?['Altri']:[])],nationality:p.nationality||'',status:p.birthYearStatus||'not_checked',profiles,sources:sourceRows.map(e=>({circuit:e.circuit,status:e.status,error:e.error,url:e.source_url,year:e.birth_year})),webSearchUrl:'https://www.google.com/search?q='+encodeURIComponent('"'+personal.name+'" tennis ("anno di nascita" OR "year of birth" OR "born")')});
  }
  return{available:true,checkedAt:new Date().toISOString(),selected:selected.length,missing,pendingSchema};
 }catch{return{available:false,missing:[]};}
}
function profileUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&['fitp.it','www.fitp.it','te.tournamentsoftware.com','itftennis.com','www.itftennis.com'].includes(u.hostname)?u.href:''}catch{return''}}
export function renderObservedBirthAdmin(report){
 const start='<h2>Osservati senza anno di nascita</h2>';
 if(!report.available)return start+'<p class="pill warn">Elenco non disponibile. Non equivale a nessun anno mancante.</p>';
 const labels={not_checked:'Da acquisire',not_available:'Anno non pubblicato nelle fonti controllate',source_error:'Lettura della fonte non riuscita',conflict:'Anni discordanti: da verificare'};
 const header=start+'<p>Solo osservati TCL e Altri. Nessuna ricerca globale. Gli anni mancanti non generano scritte nella scheda giocatore.</p><p><a href="/admin/id?birthExport=1">Esporta mancanti per ricerca web e conferma anni (JSON)</a></p>';
 if(!report.missing.length)return header+'<p>Tutti i '+esc(report.selected)+' osservati hanno un anno disponibile.</p>';
 return header+(report.pendingSchema?'<p class="pill warn">Acquisizione iniziale non ancora disponibile.</p>':'')+'<p>'+esc(report.missing.length)+' su '+esc(report.selected)+' da verificare. La ricerca web apre un motore esterno: i risultati non vengono salvati come anni confermati.</p><table><thead><tr><th>Giocatore</th><th>Lista</th><th>Motivo</th><th>Fonti / ricerca</th></tr></thead><tbody>'+report.missing.map(p=>{
  const profiles=p.profiles.map(v=>{const u=profileUrl(v.url);return u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(v.circuit)+'</a>':''}).filter(Boolean).join(' · ');
  return '<tr><td><b>'+esc(p.name)+'</b><br><small>'+esc(p.id)+'</small></td><td>'+p.lists.map(esc).join(' / ')+'</td><td>'+esc(labels[p.status]||p.status)+'</td><td>'+profiles+'<br><a href="'+esc(p.webSearchUrl)+'" target="_blank" rel="noopener noreferrer">Cerca sul web</a></td></tr>';
 }).join('')+'</tbody></table><p class="muted">Esporta l elenco e indica anno e fonte per ogni conferma. I casi discordanti richiedono verifica dell identità. Nessuna deduzione dall età.</p>';
}
