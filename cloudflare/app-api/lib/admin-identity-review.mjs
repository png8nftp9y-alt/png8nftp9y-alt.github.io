const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={fitp:'FITP','tennis-europe':'Tennis Europe',itf:'ITF'};
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['www.fitp.it','te.tournamentsoftware.com','www.itftennis.com'].includes(u.hostname)?u.href:''}catch{return''}};
export async function loadIdentityReviewCases(db,url){
 try{
  const cursor=new URL(url).searchParams.get('reviewAfter')||'';
  if(cursor&&!/^[a-f0-9]{64}$/.test(cursor))throw Error('cursor_invalid');
  const lower=cursor?'identityReviewCase:'+cursor:'identityReviewCase:';
  const result=await db.prepare('SELECT key,value,updated_at FROM app_state WHERE key>? AND key<? ORDER BY key LIMIT 51').bind(lower,'identityReviewCase;').all();
  if(result.success===false)throw Error('review_read_failed');
  const rows=result.results||[],page=rows.slice(0,50);
  const cases=page.map(r=>{const item=JSON.parse(r.value);if(item.version!==1||!item.id||!item.nameKey||!Array.isArray(item.identities)||!Array.isArray(item.reasons)||item.identities.some(p=>!p||!['names','people','nationalities','birthYears'].every(k=>Array.isArray(p[k]))))throw Error('review_record_invalid');return{...item,updatedAt:r.updated_at}});
  // Optional current FITP metadata, read only for the cards on this page.
  const cards=[...new Set(cases.flatMap(c=>c.identities.filter(p=>p.circuit==='fitp').map(p=>p.officialId)))],metadata=new Map();
  try{for(let i=0;i<cards.length;i+=40){const chunk=cards.slice(i,i+40),r=await db.prepare('SELECT membership_card,ranking,club FROM fitp_player_metadata WHERE membership_card IN ('+chunk.map(()=>'?').join(',')+')').bind(...chunk).all();for(const m of r.results||[])metadata.set(m.membership_card,m);}}catch{}
  for(const c of cases)for(const p of c.identities){const m=p.circuit==='fitp'&&metadata.get(p.officialId);if(m){p.ranking=m.ranking||p.ranking;p.club=m.club||p.club;}}
  return{available:true,cases,cursor,next:rows.length>50?page.at(-1).key.slice('identityReviewCase:'.length):null};
 }catch{return{available:false,cases:[],next:null}}
}
export function renderIdentityReviewCases(report){
 const start='<section class="card" id="identita-sospette"><h2>Identità sospette da verificare</h2>';
 if(!report.available)return start+'<p class="pill warn">Segnalazioni non disponibili. Non equivale a nessun caso aperto.</p></section>';
 const introduction='<p class="muted">Il motore ID segnala i gruppi sospetti quando elabora nuovi dati. Nessuna associazione automatica aggiunta da questa lista. Indicami il codice del caso e i profili da collegare oppure da lasciare separati. I casi già decisi non vengono riproposti con gli stessi ID; nuovi ID possono riaprire la verifica.</p>';
 const controls='<p><a href="?reviewExport=1'+(report.cursor?'&amp;reviewAfter='+esc(report.cursor):'')+'">Esporta questa pagina (JSON)</a></p>';
 const content=report.cases.length?report.cases.map(c=>'<article><h3>'+esc(c.id)+' · '+esc(c.nameKey)+'</h3><p>'+c.reasons.map(esc).join(' · ')+'</p><table><thead><tr><th>Circuito / ID</th><th>Nome</th><th>Nazione / nascita</th><th>Classifica / circolo acquisiti</th><th>Identità app</th></tr></thead><tbody>'+c.identities.map(p=>{const url=safeUrl(p.profileUrl);return '<tr><td>'+esc(labels[p.circuit]||p.circuit)+'<br>'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(p.officialId)+'</a>':esc(p.officialId))+'</td><td>'+p.names.map(esc).join(' / ')+'</td><td>'+p.nationalities.map(esc).join(' / ')+' · '+p.birthYears.map(esc).join(' / ')+'</td><td>'+esc(p.ranking||'—')+' · '+esc(p.club||'—')+'</td><td>'+p.people.map(esc).join(' / ')+'</td></tr>'}).join('')+'</tbody></table><p class="muted">Ultima variazione: '+esc(c.updatedAt)+'</p></article>').join(''):'<p>Nessun caso sospetto segnalato dal motore per i gruppi elaborati. Questa lista non certifica l’intero archivio.</p>';
 const next=report.next?'<p><a href="?reviewAfter='+esc(report.next)+'#identita-sospette">Segnalazioni successive</a></p>':'';
 return start+introduction+controls+content+next+'<p class="muted">ID, identità sospette e anni di nascita conservano la lettura salvata e si aggiornano insieme con l’icona ↻. Nessun polling e nessuna discovery.</p></section>';
}
export async function appendIdentityReviewCases(html,db,url){
 return html.replace('</nav>','</nav>'+renderIdentityReviewCases(await loadIdentityReviewCases(db,url)));
}
