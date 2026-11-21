import {ADMIN_OPERATIONAL_WORKFLOWS} from './admin-operational-workflows.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function control(item){
 if(!item)return '<span class="muted">Stato non verificabile</span>';
 const active=item.state==='active',paused=['disabled_manually','disabled_inactivity'].includes(item.state);
 if(!Number.isSafeInteger(item.id)||item.id<=0||!String(item.path||'').startsWith('.github/workflows/')||(!active&&!paused))return '<span class="muted">Non disponibile</span>';
 return `<form method="post" action="/admin/automation"><input type="hidden" name="workflowId" value="${item.id}"><input type="hidden" name="expectedState" value="${esc(item.state)}"><input type="hidden" name="action" value="${active?'pause':'resume'}"><button type="submit" aria-label="${active?'Metti in pausa':'Riattiva'} ${esc(item.name)}">${active?'ON · Metti in pausa':'OFF · Riattiva'}</button></form>`;
}
export async function automationControlPage(html,view,env) {
 if(view!=='diagnostica'||!html.includes('<h2>Workflow e watchdog</h2>'))return html;
 let workflows=[];
 try {if(!env.AUTOMATION_CONTROL?.list)throw Error('workflow_control_unconfigured');workflows=await env.AUTOMATION_CONTROL.list();if(!Array.isArray(workflows))throw Error('workflow_controls_invalid');}catch {workflows=[];}
 const byFile=new Map(workflows.map(item=>[String(item.path||'').split('/').pop(),item]));
 const labels=new Map(ADMIN_OPERATIONAL_WORKFLOWS.map(([file,label])=>[esc(label),file]));
 const help='<p class="muted" data-workflow-controls="1">ON/OFF riguarda i nuovi avvii del singolo workflow. I run già partiti terminano; OFF blocca anche gli avvii manuali. Riattiva ripristina gli avvii previsti senza lanciare un run.</p>';
 return html.replace(/<h2>Workflow e watchdog<\/h2>([\s\S]*?)(?=<\/section>|$)/,block=>{
  if(!block.includes('<table>'))return block+help+'<p>Tabella workflow non disponibile. Usa Aggiorna diagnostica.</p>';
  block=block.replace('<th>Riferimento</th>','<th>Riferimento</th><th>ON/OFF</th>');
  block=block.replace(/<tbody>([\s\S]*?)<\/tbody>/,(all,rows)=>'<tbody>'+rows.replace(/<tr>([\s\S]*?)<\/tr>/g,(row,body)=>{
   const label=/<td><b>([\s\S]*?)<\/b><\/td>/.exec(body)?.[1];
   return '<tr>'+body+'<td>'+control(byFile.get(labels.get(label)))+'</td></tr>';
  })+'</tbody>');
  return block+help;
 });
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
