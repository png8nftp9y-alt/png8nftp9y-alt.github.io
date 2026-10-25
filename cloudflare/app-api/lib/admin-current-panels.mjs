import {adminRuntimeDocuments} from './admin-runtime-documents.mjs';
import {loadIdentityReviewCases,renderIdentityReviewCases} from './admin-identity-review.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tone=s=>['success','green'].includes(s)?'ok':['failure','red','timed_out','action_required'].includes(s)?'bad':'warn';
const stamp=v=>Number.isFinite(Date.parse(v||''))?new Date(v).toLocaleString('it-IT',{timeZone:'Europe/Rome'}):'—';
const link=run=>{try{const u=new URL(run?.html_url);return u.protocol==='https:'&&u.hostname==='github.com'?`<a href="${esc(u.href)}" rel="noreferrer">run ${esc(run.id)}</a>`:'—'}catch{return'—'}};
export function renderCurrentWorkflows(doc){
 if(!doc||!Array.isArray(doc.items))return '<p class="pill warn">Stati workflow non disponibili. Non equivale a tutti verdi.</p>';
 const states=doc.workflowStates||doc.items;
 const rows=states.map(item=>{const run=item.latestRun,status=run?(run.status==='completed'?run.conclusion:run.status):'non disponibile';return `<tr><td><b>${esc(item.label||item.workflow)}</b></td><td><span class="pill ${tone(status)}">${esc(status)}</span>${item.error?'<br><small>Ultima acquisizione non disponibile</small>':''}</td><td>${esc(stamp(run?.updated_at||run?.created_at))}<br><small>Verificato: ${esc(stamp(item.checkedAt))}</small></td><td>${link(run)}</td></tr>`}).join('');
 return `<h2>Workflow e watchdog</h2><p class="muted">Stati salvati dai normali motori, letti da D1 all’apertura. Evidenza del ${esc(stamp(doc.generatedAt))}. I conteggi conservano il loro aggiornamento manuale.</p><table><thead><tr><th>Flusso</th><th>Stato</th><th>Ultimo aggiornamento</th><th>Riferimento</th></tr></thead><tbody>${rows}</tbody></table>`;
}
export function renderCurrentApplication(doc,diagnostics){
 const workflowLabels=new Set((doc?.items||[]).map(x=>x.label));
 const items=[...(diagnostics?.items||[]).filter(x=>!x.workflow&&!workflowLabels.has(x.label)),...(doc?.items||[])];
 return '<h2>Diagnostica applicativa</h2><table><thead><tr><th>Controllo</th><th>Stato</th><th>Generazione</th><th>Dettaglio</th></tr></thead><tbody>'+items.map(x=>`<tr><td><b>${esc(x.label)}</b></td><td><span class="pill ${tone(x.status)}">${esc(x.status||'non disponibile')}</span></td><td>${esc(stamp(x.generatedAt))}</td><td>${esc(x.detail||'—')}</td></tr>`).join('')+'</tbody></table>'+(!doc?'<p class="pill warn">Stati workflow non disponibili.</p>':'');
}
export async function adminPanelResponse(view,env,url,headers){
 try{
  let panels;
  if(view==='id')panels={review:renderIdentityReviewCases(await loadIdentityReviewCases(env.DB,url))};
  else{const reader=adminRuntimeDocuments(env.DB);await reader.preload(['dist/v3/operational_status.json','dist/v3/diagnostics.json']);const [doc,diagnostics]=await Promise.all([reader.get('dist/v3/operational_status.json'),reader.get('dist/v3/diagnostics.json')]);panels={workflows:renderCurrentWorkflows(doc),application:renderCurrentApplication(doc,diagnostics)};}
  return new Response(JSON.stringify(panels),{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
 }catch{return new Response(JSON.stringify({error:'Lettura corrente non disponibile. Usa Aggiorna stati per riprovare.'}),{status:503,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}})}
}
export function attachAdminPanels(html,view,url){
 if(!['id','diagnostica'].includes(view))return html;
 const placeholder=(id,title)=>`<section class="card" id="admin-${id}"><h2>${title}</h2><p class="muted">Caricamento della lettura corrente…</p></section>`;
 if(view==='id')html=html.replace('</nav>','</nav>'+placeholder('review','Identità sospette da verificare'));
 else for(const [id,title] of [['workflows','Workflow e watchdog'],['application','Diagnostica applicativa']])html=html.replace(new RegExp('<section class="card"><h2>'+title+'</h2>[\\s\\S]*?</section>'),placeholder(id,title));
 const endpoint=new URL('/admin/'+view,url);endpoint.searchParams.set('currentPanels','1');const cursor=new URL(url).searchParams.get('reviewAfter');if(view==='id'&&cursor)endpoint.searchParams.set('reviewAfter',cursor);
 const loader=`<div class="card" id="admin-panel-loader" data-url="${esc(endpoint.pathname+endpoint.search)}"><button type="button" id="admin-panel-refresh">Aggiorna ${view==='id'?'segnalazioni':'stati'}</button><p id="admin-panel-error" role="status"></p><noscript><a href="${esc(endpoint.pathname+endpoint.search)}">Apri la lettura corrente</a></noscript></div><script src="/admin/panels.js" defer></script>`;
 return html.replace('</nav>','</nav>'+loader);
}
// One request on opening or explicit click. No timers, polling, retries or discovery.
export const ADMIN_PANEL_SCRIPT=`(()=>{const host=document.getElementById('admin-panel-loader'),button=document.getElementById('admin-panel-refresh'),error=document.getElementById('admin-panel-error');if(!host)return;let running=false;async function load(){if(running)return;running=true;button.disabled=true;try{const response=await fetch(host.dataset.url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Lettura corrente non disponibile');const panels=await response.json();for(const [key,html]of Object.entries(panels)){if(!['review','workflows','application'].includes(key)||typeof html!=='string')continue;const target=document.getElementById('admin-'+key);if(target)target.innerHTML=html;}error.textContent='';}catch(e){error.textContent='Segnalazioni o stati non disponibili. Premi il pulsante per riprovare.';}finally{running=false;button.disabled=false;}}button.addEventListener('click',load);load();})();`;
