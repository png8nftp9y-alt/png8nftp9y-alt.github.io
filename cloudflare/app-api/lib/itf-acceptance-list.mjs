const valid=id=>/^J-[A-Z0-9]+-[A-Z]{3}-\d{4}-\d{3}$/.test(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
const page=(body,status=200)=>new Response(`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceptance List · Court Watch</title><style>body{font:15px/1.5 system-ui;background:#f7f8f6;color:#27332d;margin:0}main{max-width:1050px;margin:auto;padding:24px}h1{margin:0}h2{margin-top:28px}h3{margin:0;padding:10px;background:#e8edf2}.card{background:white;border-radius:12px;overflow:auto;margin:12px 0 22px;border:1px solid #dce2e0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #e8e8e5}th{font-size:13px;color:#56635c}.muted{color:#627169}.badge{display:inline-block;border-radius:20px;background:#e7edf2;padding:4px 12px;margin:10px 0}header p{margin:6px 0}@media(max-width:600px){main{padding:14px}th,td{padding:8px;font-size:13px}}</style></head><body><main>${body}</main></body></html>`,{status,headers});
const positive=v=>Number.isInteger(v)&&v>0?v:'—';
export function acceptanceListHtml(doc){
 const sections={MD:'Main Draw',Q:'Qualificazioni',A:'Alternates',W:'Ritirati',WC:'Wild Card',LL:'Lucky Loser',OTHER:'Altri'};
 const grouped=new Map();
 for(const row of doc.entries){const gender=String(row.gender||'').trim(),name=/^(B|M|BOYS|MEN|MALE)$/i.test(gender)?'Boys':/^(G|F|W|GIRLS|WOMEN|FEMALE)$/i.test(gender)?'Girls':gender||'Categoria non indicata';const bySection=grouped.get(name)||new Map(),key=sections[row.section]?row.section:'OTHER',rows=bySection.get(key)||[];rows.push(row);bySection.set(key,rows);grouped.set(name,bySection);}
 const date=doc.acquiredAt&&Number.isFinite(Date.parse(doc.acquiredAt))?new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(doc.acquiredAt)):null;
 let html=`<header><h1>${esc(doc.name||doc.competitionId)}</h1><h2>Acceptance List</h2><span class="badge">Lista archiviata</span><p class="muted">Ultima copia acquisita e conservata da Court Watch.</p><p>${date?'Acquisita il '+esc(date):'Data di acquisizione non disponibile'}</p></header>`;
 for(const [gender,groups] of [...grouped].sort(([a],[b])=>a.localeCompare(b))){html+=`<h2>${esc(gender)}</h2>`;for(const [section,label] of Object.entries(sections)){const rows=groups.get(section);if(!rows?.length)continue;rows.sort((a,b)=>(a.position??Infinity)-(b.position??Infinity)||String(a.name).localeCompare(String(b.name)));html+=`<section class="card"><h3>${label} · ${rows.length}</h3><table><thead><tr><th>Pos.</th><th>Giocatore</th><th>Nazione</th><th>Ranking acquisito</th></tr></thead><tbody>`+rows.map(r=>`<tr><td>${positive(r.position)}</td><td>${esc(r.name)}</td><td>${esc(r.nationality||'—')}</td><td>${positive(r.ranking)}</td></tr>`).join('')+'</tbody></table></section>';}}
 return html;
}
export async function itfAcceptanceListResponse(archive,competition){
 const id=String(competition||'').trim().toUpperCase();if(!valid(id))return page('<h1>Torneo non valido</h1>',400);
 if(!archive)return page('<h1>Acceptance List temporaneamente non disponibile</h1>',503);
 try{
  const object=await archive.get(`itf/acceptance-lists/current/${id}.json`);
  if(!object)return page('<h1>Acceptance List non disponibile</h1><p>Non è disponibile una copia archiviata per questo torneo.</p>',404);
  if(object.size>4*1024*1024)throw Error('acceptance_archive_too_large');
  const doc=await object.json();
  if(doc.version!==1||doc.circuit!=='itf'||doc.competitionId!==id||doc.kind!=='last_nonempty_acquired_acceptance'||!Array.isArray(doc.entries)||!doc.entries.length||doc.entries.length>20000)throw Error('invalid_acceptance_archive_document');
  return page(acceptanceListHtml(doc));
 }catch{return page('<h1>Acceptance List temporaneamente non disponibile</h1><p>Riprova più tardi.</p>',503);}
}
