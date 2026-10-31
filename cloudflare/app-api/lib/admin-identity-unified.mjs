import {loadPlayerIdDiagnostics,renderPlayerIdDiagnostics} from './admin-player-id-diagnostics.mjs';
import {loadIdentityReviewCases,renderIdentityReviewCases} from './admin-identity-review.mjs';
import {loadObservedBirthAdmin,renderObservedBirthAdmin} from './admin-observed-birth.mjs';
export async function unifiedIdentityReport(env,url,loaders={}){
 const [ids,review,birth]=await Promise.all([
  (loaders.ids||loadPlayerIdDiagnostics)(env.DB),
  (loaders.review||loadIdentityReviewCases)(env.DB,url),
  (loaders.birth||loadObservedBirthAdmin)(env.DB)
 ]);
 if(!ids||!review.available||!birth.available||birth.pendingSchema)throw Error('identity_refresh_incomplete');
 return '<div data-identity-snapshot="1">'+renderPlayerIdDiagnostics(ids)+'<section id="admin-review">'+renderIdentityReviewCases(review)+'</section><section class="card" id="admin-birth">'+renderObservedBirthAdmin(birth)+'</section></div>';
}
export const IDENTITY_REFRESH_CLIENT=`const identityButton=document.getElementById('admin-identity-refresh'),identityStatus=document.getElementById('admin-identity-refresh-status');let identityRunning=false;if(identityButton)identityButton.addEventListener('click',async()=>{if(identityRunning)return;identityRunning=true;identityButton.disabled=true;try{const response=await fetch('/admin/id?refreshIdentity=1',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('identity_refresh_failed');const result=await response.json();if(result.updated!==true)throw Error('identity_refresh_incomplete');identityStatus.textContent='ID, identità sospette e anni di nascita aggiornati.';if(identityButton.dataset.view==='id')location.reload();}catch{identityStatus.textContent='Aggiornamento non riuscito. Rimane la precedente lettura dei tre controlli.';}finally{identityRunning=false;identityButton.disabled=false;}});`;
export function attachIdentityRefresh(html,view){
 if(!['id','diagnostica'].includes(view))return html;
 html=html.replace(/<form\b[^>]*action="\/admin\/id(?:#id-circuiti)?"[^>]*>[\s\S]*?<\/form>/g,'');
 html=html.replace(/<a href="\/admin\/id#identita-sospette">Aggiorna segnalazioni<\/a>\s*·?\s*/g,'');
 html=html.replaceAll('Aggiorna conteggi','l’icona ↻');
 const control='<div class="card"><button type="button" id="admin-identity-refresh" data-view="'+view+'" title="Aggiorna ID, identità sospette e anni di nascita" aria-label="Aggiorna ID, identità sospette e anni di nascita">↻</button><span> ID, identità sospette e anni di nascita</span><p id="admin-identity-refresh-status" role="status"></p></div>';
 return html.replace('</nav>','</nav>'+control);
}
