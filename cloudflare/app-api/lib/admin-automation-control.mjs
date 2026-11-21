const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function automationControlPage(html,view,env) {
 if(view!=='diagnostica')return html;
 let panel;
 try {
  if(!env.AUTOMATION_CONTROL?.list)throw Error('workflow_control_unconfigured');
  const workflows=await env.AUTOMATION_CONTROL.list();
  if(!Array.isArray(workflows))throw Error('workflow_controls_invalid');
  const rows=workflows.map(item=>{
   const active=item.state==='active',paused=['disabled_manually','disabled_inactivity'].includes(item.state),canChange=(active||paused)&&String(item.path||'').startsWith('.github/workflows/');
   const url=`https://github.com/png8nftp9y-alt/png8nftp9y-alt.github.io/actions/workflows/${Number(item.id)}`;
   if(!Number.isSafeInteger(item.id)||item.id<=0)throw Error('workflow_controls_invalid');
   return `<tr><td><a href="${url}" target="_blank" rel="noopener">${esc(item.name)}</a></td><td><b>${active?'ON':paused?'IN PAUSA':esc(item.state)}</b></td><td>${canChange?`<form method="post" action="/admin/automation"><input type="hidden" name="workflowId" value="${item.id}"><input type="hidden" name="expectedState" value="${esc(item.state)}"><input type="hidden" name="action" value="${active?'pause':'resume'}"><button type="submit">${active?'Metti in pausa':'Riattiva'}</button></form>`:'—'}</td></tr>`;
  }).join('');
  panel='<section class="card" id="automatic-acquisition-control"><h2>Pausa dei singoli workflow</h2><p>Ogni pulsante modifica solo il workflow della propria riga. In pausa non partono nuovi run, automatici o manuali; quelli già avviati terminano. Riattiva ripristina le attivazioni previste, senza lanciare subito un run. L’app e i dati già salvati rimangono disponibili.</p><details><summary>Mostra i pulsanti dei workflow ('+workflows.length+')</summary><table><thead><tr><th>Workflow</th><th>Stato corrente</th><th>Comando</th></tr></thead><tbody>'+rows+'</tbody></table></details></section>';
 }catch {panel='<section class="card" id="automatic-acquisition-control"><h2>Pausa dei singoli workflow</h2><p role="alert">Stati non verificabili. Nessun workflow è stato modificato. Riapri Diagnostica per riprovare.</p></section>';}
 return html.replace('</nav>','</nav>'+panel);
}
export async function changeAutomation(request,env,headers) {
 const url=new URL(request.url);
 if(request.method!=='POST')return new Response('Metodo non consentito',{status:405,headers});
 if(request.headers.get('Origin')!==url.origin)return new Response('Origine non valida',{status:403,headers});
 const form=await request.formData(),action=form.get('action'),raw=form.get('workflowId'),expectedState=form.get('expectedState');
 if(!['pause','resume'].includes(action)||!/^\d+$/.test(raw||'')||!Number.isSafeInteger(Number(raw))||Number(raw)<=0||!['active','disabled_manually','disabled_inactivity'].includes(expectedState))return new Response('Comando non valido',{status:400,headers});
 try {
  if(!env.AUTOMATION_CONTROL?.set)throw Error('workflow_control_unconfigured');
  const result=await env.AUTOMATION_CONTROL.set({id:Number(raw),enabled:action==='resume',expectedState});
  if(result?.id!==Number(raw)||result.state!==(action==='resume'?'active':'disabled_manually'))throw Error('workflow_control_unverified');
  return new Response(null,{status:303,headers:{...headers,Location:'/admin/diagnostica'}});
 }catch(error){const conflict=String(error).includes('workflow_control_conflict');return new Response(conflict?'Stato cambiato. Riapri Diagnostica e riprova.':'Comando non confermato. Riapri Diagnostica per verificare lo stato corrente.',{status:conflict?409:503,headers});}
}
