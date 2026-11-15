const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function renderItfRankingDiagnostics(db){
 const title='<h2>Classifiche ITF Junior</h2>';
 try{
  const read=async(sql)=>((await db.prepare(sql).bind().all()).results||[]);
  const versions=await read('SELECT category,ranking_date,content_hash,captured_at,expected_count,expected_count AS acquired_count,0 AS partial FROM itf_junior_ranking_publications WHERE complete=1');
  try{versions.push(...await read('SELECT category,ranking_date,content_hash,captured_at,expected_count,acquired_count,1 AS partial FROM itf_junior_ranking_partial_publications WHERE ready=1'));}catch(e){if(!/no such table: itf_junior_ranking_partial_publications/.test(String(e)))throw e;}
  const states=await read('SELECT category,phase,next_retry_at,last_error FROM itf_junior_ranking_recovery');
  const attempt=(await read('SELECT run_url,checked_at,status FROM itf_junior_ranking_attempts ORDER BY checked_at DESC LIMIT 1'))[0];
  const rows=['B','G'].map(category=>{
   const available=versions.filter(v=>v.category===category),date=available.map(v=>v.ranking_date).sort().at(-1);
   const candidates=available.filter(v=>v.ranking_date===date).sort((a,b)=>a.partial-b.partial||String(b.captured_at).localeCompare(String(a.captured_at)));
   const version=candidates[0],state=states.find(s=>s.category===category),status=!version?'Nessuna classifica disponibile':version.partial?'Parziale — righe già visibili in app':'Completa';
   return `<tr><td>${category==='B'?'Boys':'Girls'}</td><td><span class="pill ${!version?'bad':version.partial||state?.phase!=='complete'?'warn':'ok'}">${status}</span></td><td>${esc(date||'—')}</td><td>${esc(version?.acquired_count??0)} / ${esc(version?.expected_count??'—')}${version?.partial?'<br><small>Nella versione parziale più recente</small>':''}</td><td>${esc(state?.next_retry_at||'—')}<br><small>${esc(state?.last_error||'')}</small></td></tr>`;
  }).join('');
  let link='';try{const u=new URL(attempt?.run_url);if(u.protocol==='https:'&&u.hostname==='github.com')link=` · <a href="${esc(u.href)}">Apri run</a>`;}catch{}
  return title+`<p>Le posizioni già validate sono mostrate anche durante un’acquisizione parziale. Le pagine mancanti non dimostrano che un giocatore non sia classificato.</p><table><thead><tr><th>Categoria</th><th>Disponibilità</th><th>Data ranking</th><th>Righe</th><th>Prossimo recupero (UTC) / errore</th></tr></thead><tbody>${rows}</tbody></table><p>Ultimo tentativo: ${esc(attempt?.checked_at||'non disponibile')} · ${esc(attempt?.status||'—')}${link}</p>`;
 }catch{return title+'<p class="pill warn">Lettura ranking non disponibile o archivio non inizializzato.</p>';}
}
