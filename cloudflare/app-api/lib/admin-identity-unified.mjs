import {loadPlayerIdDiagnostics,renderPlayerIdDiagnostics} from './admin-player-id-diagnostics.mjs';
import {loadIdentityReviewCases,renderIdentityReviewCases} from './admin-identity-review.mjs';
import {loadObservedBirthAdmin,renderObservedBirthAdmin} from './admin-observed-birth.mjs';
export async function unifiedIdentityReport(env,url,loaders={}){
 const read=async(stage,load,valid)=>{
  try{const result=await load();if(valid(result))return result;}
  catch(error){console.error('admin_identity_reader_failed',stage,error);}
  throw Error('identity_refresh_incomplete:'+stage);
 };
 // Avoid running the large circuit count alongside the other D1 reads.
 const ids=await read('ids',()=> (loaders.ids||loadPlayerIdDiagnostics)(env.DB),Boolean);
 const review=await read('review',()=> (loaders.review||loadIdentityReviewCases)(env.DB,url),r=>r?.available);
 const birth=await read('birth',()=> (loaders.birth||loadObservedBirthAdmin)(env.DB),r=>r?.available&&!r.pendingSchema);
 return '<div data-identity-snapshot="1">'+renderPlayerIdDiagnostics(ids)+'<section id="admin-review">'+renderIdentityReviewCases(review)+'</section><section class="card" id="admin-birth">'+renderObservedBirthAdmin(birth)+'</section></div>';
}
export const IDENTITY_REFRESH_CLIENT=`const identityButton=document.getElementById('admin-identity-refresh'),identityStatus=document.getElementById('admin-identity-refresh-status');let identityRunning=false;if(identityButton)identityButton.addEventListener('click',async()=>{if(identityRunning)return;identityRunning=true;identityButton.disabled=true;try{const response=await fetch('/admin/id?refreshIdentity=1',{credentials:'same-origin',cache:'no-store',signal:globalThis.AbortSignal?.timeout?.(120000)});const result=await response.json();if(!response.ok||result.updated!==true)throw Error(result.reason||'identity_refresh_failed');identityStatus.textContent='ID, identità sospette e anni di nascita aggiornati.';if(identityButton.dataset.view==='id')location.reload();}catch(error){const labels={ids:'Conteggi ID',review:'Identità sospette',birth:'Anni di nascita',save:'Salvataggio del report',TimeoutError:'Tempo di attesa scaduto'};const detail=labels[error.name]||labels[error.message];identityStatus.textContent='Aggiornamento non riuscito.'+(typeof detail==='string'?' '+detail+'.':'')+' Rimane la precedente lettura dei tre controlli.';}finally{identityRunning=false;identityButton.disabled=false;}});`;
export function attachIdentityRefresh(html,view){
 if(view!=='id')return html;
 html=html.replace(/<form\b[^>]*action="\/admin\/id(?:#id-circuiti)?"[^>]*>[\s\S]*?<\/form>/g,'');
 html=html.replace(/<a href="\/admin\/id#identita-sospette">Aggiorna segnalazioni<\/a>\s*·?\s*/g,'');
 html=html.replaceAll('Aggiorna conteggi','l’icona ↻');
 const control='<div class="card"><button type="button" id="admin-identity-refresh" data-view="'+view+'" title="Aggiorna ID, identità sospette e anni di nascita" aria-label="Aggiorna ID, identità sospette e anni di nascita">↻</button><span> ID, identità sospette e anni di nascita</span><p id="admin-identity-refresh-status" role="status"></p></div>';
 return html.replace('</nav>','</nav>'+control);
}
