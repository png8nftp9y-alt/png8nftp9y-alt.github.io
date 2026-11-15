const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function renderItfRankingDiagnostics(db){
 const title='<h2>Classifiche ITF Junior</h2>';
 try{
  const read=async(sql)=>((await db.prepare(sql).bind().all()).results||[]);
  const tables=new Set((await read("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('itf_junior_ranking_publications','itf_junior_ranking_partial_publications','itf_junior_ranking_recovery','itf_junior_ranking_attempts')")).map(r=>r.name));
  if(!tables.has('itf_junior_ranking_publications')||!tables.has('itf_junior_ranking_recovery')||!tables.has('itf_junior_ranking_attempts'))return title+'<p class="pill warn">Archivio ranking non inizializzato.</p>';
  const versions=await read('SELECT category,ranking_date,content_hash,captured_at,expected_count,expected_count AS acquired_count,0 AS partial FROM itf_junior_ranking_publications WHERE complete=1');
  if(tables.has('itf_junior_ranking_partial_publications'))versions.push(...await read('SELECT category,ranking_date,content_hash,captured_at,expected_count,acquired_count,1 AS partial FROM itf_junior_ranking_partial_publications WHERE ready=1'));
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

export async function renderItfRankingCoverage(db){
 const title='<section class="card" id="itf-ranking-coverage"><h2>Copertura classifiche ITF Junior</h2>';
 const unavailable=message=>title+'<p class="pill warn">'+esc(message)+'</p></section>';
 try{
  const all=async(sql,...params)=>(await db.prepare(sql).bind(...params).all()).results||[];
  const tables=new Set((await all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('itf_junior_ranking_publications','itf_junior_ranking_partial_publications','itf_junior_ranking_history','itf_junior_ranking_recovery')")).map(r=>r.name));
  if(!tables.has('itf_junior_ranking_publications'))return unavailable('Nessuna classifica acquisita.');
  const versions=await all('SELECT category,ranking_date,content_hash,captured_at,expected_count,complete FROM itf_junior_ranking_publications');
  const states=tables.has('itf_junior_ranking_recovery')?await all('SELECT category,ranking_date,expected_count FROM itf_junior_ranking_recovery'):[];
  const date=[...versions,...states].map(r=>r.ranking_date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')).sort().at(-1);
  if(!date)return unavailable('Nessuna data di classifica ancora rilevata.');
  const totals=new Map(),addTotal=r=>{if(r.ranking_date===date&&Number(r.expected_count)>0){const values=totals.get(r.category)||new Set();values.add(Number(r.expected_count));totals.set(r.category,values);}};
  [...versions,...states].forEach(addTotal);
  const counts=tables.has('itf_junior_ranking_partial_publications')&&tables.has('itf_junior_ranking_history')?await all('SELECT h.category,COUNT(DISTINCT h.player_id) AS acquired FROM itf_junior_ranking_history h JOIN itf_junior_ranking_partial_publications p USING(category,ranking_date,content_hash) WHERE p.ready=1 AND p.ranking_date=? GROUP BY h.category',date):[];
  const rows=['B','G'].map(category=>{
   const complete=versions.filter(v=>v.category===category&&v.ranking_date===date&&Number(v.complete)===1).sort((a,b)=>String(b.captured_at).localeCompare(String(a.captured_at))||String(b.content_hash).localeCompare(String(a.content_hash)))[0];
   const options=totals.get(category)||new Set(),expected=complete?Number(complete.expected_count):options.size===1?[...options][0]:null;
   const acquired=complete?expected:Number(counts.find(c=>c.category===category)?.acquired||0);
   const conflict=!complete&&(options.size>1||expected!==null&&acquired>expected),missing=expected!==null&&!conflict?expected-acquired:null;
   const status=complete?'Completa':conflict?'Da verificare':expected===null?'In attesa di acquisizione':missing===0?'Da certificare':'Incompleta';
   return `<tr><td>${category==='B'?'Boys':'Girls'}</td><td>${esc(acquired)} / ${esc(expected??'—')} acquisite</td><td>${esc(missing??'—')}</td><td><span class="pill ${complete?'ok':'warn'}">${status}</span></td></tr>`;
  }).join('');
  return title+`<p>Data ranking: <b>${esc(date.split('-').reverse().join('/'))}</b> · ultima pubblicazione rilevata dalla fonte.</p><table><thead><tr><th>Categoria</th><th>Acquisite / attese</th><th>Mancanti</th><th>Stato</th></tr></thead><tbody>${rows}</tbody></table><p class="muted">Conteggi della sola data indicata. Una nuova data sostituisce questa vista; i dati precedenti restano archiviati. Le acquisizioni parziali verificate sono unite per ID, senza contare due volte la stessa persona.</p></section>`;
 }catch{return unavailable('Copertura ranking non verificabile: lettura non riuscita.');}
}
