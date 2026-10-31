import {attachIdentityRefresh,IDENTITY_REFRESH_CLIENT} from './admin-identity-unified.mjs';
import {loadObservedBirthAdmin,renderObservedBirthAdmin} from './admin-observed-birth.mjs';
import {operationalWorkflowRows} from './admin-operational-workflows.mjs';
import {adminRuntimeDocuments} from './admin-runtime-documents.mjs';
import {loadIdentityReviewCases,renderIdentityReviewCases} from './admin-identity-review.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tone=s=>['success','green'].includes(s)?'ok':['failure','red','timed_out','action_required'].includes(s)?'bad':'warn';
const stamp=v=>Number.isFinite(Date.parse(v||''))?new Date(v).toLocaleString('it-IT',{timeZone:'Europe/Rome'}):'—';
const link=run=>{try{const u=new URL(run?.html_url);return u.protocol==='https:'&&u.hostname==='github.com'?`<a href="${esc(u.href)}" rel="noreferrer">run ${esc(run.id)}</a>`:'—'}catch{return'—'}};
export function renderCurrentWorkflows(doc){
 if(!doc||!Array.isArray(doc.items))return '<p class="pill warn">Stati workflow non disponibili. Non equivale a tutti verdi.</p>';
 const states=operationalWorkflowRows(doc);
 const checks=new Map(doc.items.map(item=>[item.workflow,item]));
 const rows=states.map(item=>{
  const check=checks.get(item.workflow),latest=item.latestRun,failed=check?.status==='red';
  const failedRun=check?.completedRun||item.completedRun||(check?.runId?{id:check.runId,html_url:check.url,updated_at:check.generatedAt,status:'completed',conclusion:'failure'}:null);
  const run=failed?(failedRun||latest):latest,status=failed?'failure':run?(run.status==='completed'?run.conclusion:run.status):'non disponibile';
  const active=latest&&latest.status!=='completed'?latest:null;
  return `<tr><td><b>${esc(item.label||item.workflow)}</b></td><td><span class="pill ${tone(status)}">${esc(status)}</span>${failed?'<br><small>Questo fallimento determina il rosso complessivo.</small>':''}${item.error?'<br><small>Ultima acquisizione non disponibile</small>':''}</td><td>${esc(stamp(run?.updated_at||run?.created_at))}<br><small>Verificato: ${esc(stamp(item.checkedAt))}</small></td><td>${link(run)}${failed&&active?'<br><small>Nuova esecuzione '+esc(active.status)+' · '+link(active)+'</small>':''}</td></tr>`;
 }).join('');
 return `<h2>Workflow e watchdog</h2><p class="muted">Solo acquisizioni, pubblicazioni e controlli operativi dell’app. Stati acquisiti nella stessa lettura di Copertura e dei controlli applicativi. Evidenza del ${esc(stamp(doc.generatedAt))}. La pagina conserva questa lettura fino a Aggiorna diagnostica.</p><table><thead><tr><th>Flusso</th><th>Stato</th><th>Ultimo aggiornamento</th><th>Riferimento</th></tr></thead><tbody>${rows}</tbody></table>`;
}
export function renderCoverageCauses(diagnostics){
 const issues=(diagnostics?.items||[]).filter(item=>item.critical&&['red','yellow'].includes(item.status));
 if(!issues.length)return diagnostics?.overall==='green'?'':'<p class="pill warn">Il riepilogo non certifica uno stato verde, ma il dettaglio dei problemi non è disponibile nella lettura salvata.</p>';
 return '<div class="coverage-causes"><p><b>Problemi che determinano lo stato complessivo:</b></p><ul>'+issues.map(item=>{
  const run=item.completedRun||(item.runId?{id:item.runId,html_url:item.url}:null),reference=link(run);
  return `<li><b>${esc(item.label)}</b> · <span class="pill ${tone(item.status)}">${esc(item.status)}</span><br>${esc(item.detail||'Dettaglio non registrato')}<br><small>Rilevato: ${esc(stamp(item.generatedAt))}</small><br>${reference==='—'?'<span class="muted">Run non registrato per questo controllo sui dati.</span>':reference}</li>`;
 }).join('')+'</ul></div>';
}
export function renderCurrentApplication(doc,diagnostics){
 const workflowLabels=new Set((doc?.items||[]).map(x=>x.label));
 const items=[...(diagnostics?.items||[]).filter(x=>!x.workflow&&!workflowLabels.has(x.label)),...(doc?.items||[])];
 return '<h2>Diagnostica applicativa</h2><table><thead><tr><th>Controllo</th><th>Stato</th><th>Generazione</th><th>Dettaglio</th></tr></thead><tbody>'+items.map(x=>`<tr><td><b>${esc(x.label)}</b></td><td><span class="pill ${tone(x.status)}">${esc(x.status||'non disponibile')}</span></td><td>${esc(stamp(x.generatedAt))}</td><td>${esc(x.detail||'—')}</td></tr>`).join('')+'</tbody></table>'+(!doc?'<p class="pill warn">Stati workflow non disponibili.</p>':'');
}
export async function adminPanelResponse(view,env,url,headers){
 try{
  let panels;
  if(view==='id'){const [review,birth]=await Promise.all([loadIdentityReviewCases(env.DB,url),loadObservedBirthAdmin(env.DB)]);panels={review:renderIdentityReviewCases(review),birth:renderObservedBirthAdmin(birth)};}
  else{const reader=adminRuntimeDocuments(env.DB);await reader.preload(['dist/v3/operational_status.json','dist/v3/diagnostics.json']);const [doc,diagnostics]=await Promise.all([reader.get('dist/v3/operational_status.json'),reader.get('dist/v3/diagnostics.json')]);panels={workflows:renderCurrentWorkflows(doc),application:renderCurrentApplication(doc,diagnostics)};}
  return new Response(JSON.stringify(panels),{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
 }catch{return new Response(JSON.stringify({error:'Lettura corrente non disponibile. Riapri la pagina o usa il pulsante di aggiornamento della sezione.'}),{status:503,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}})}
}
export function attachAdminPanels(html,view,url){
 if(!['id','diagnostica'].includes(view))return html;
 html=attachIdentityRefresh(html,view);
 if(view==='id'&&new URL(url).searchParams.has('reviewAfter')){
  const endpoint=new URL('/admin/id',url);endpoint.searchParams.set('currentPanels','1');endpoint.searchParams.set('reviewAfter',new URL(url).searchParams.get('reviewAfter'));
  html=html.replace('</nav>','</nav><div id="admin-panel-loader" data-view="id" data-url="'+esc(endpoint.pathname+endpoint.search)+'"><p id="admin-panel-error" role="status"></p></div>');
 }
 const script='<script src="/admin/panels.js" defer></script>';return html.includes('</body>')?html.replace('</body>',script+'</body>'):html+script;
}
// One request on opening or explicit click. No timers, polling, retries or discovery.
export const ADMIN_PANEL_SCRIPT=`(()=>{\n${IDENTITY_REFRESH_CLIENT}\nconst host=document.getElementById('admin-panel-loader'),button=document.getElementById('admin-panel-refresh'),error=document.getElementById('admin-panel-error');if(!host)return;let running=false;async function load(){if(running)return;running=true;if(button)button.disabled=true;try{const response=await fetch(host.dataset.url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Lettura corrente non disponibile');const panels=await response.json();for(const [key,html]of Object.entries(panels)){if(!['review','birth','workflows','application'].includes(key)||typeof html!=='string')continue;const target=document.getElementById('admin-'+key);if(target)target.innerHTML=html;}error.textContent='';}catch(e){error.textContent=host.dataset.view==='diagnostica'?'Stati non disponibili. Usa Aggiorna diagnostica per riprovare.':'Segnalazioni non disponibili. Usa l’icona ↻ per riprovare.';}finally{running=false;if(button)button.disabled=false;}}if(button)button.addEventListener('click',load);load();})();`;
