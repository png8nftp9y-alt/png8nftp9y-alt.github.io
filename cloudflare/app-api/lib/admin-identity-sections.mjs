// Each successful manual refresh replaces only its own R2 snapshot.
import {loadPlayerIdDiagnostics,renderPlayerIdDiagnostics} from './admin-player-id-diagnostics.mjs';
import {loadIdentityReviewCases,renderIdentityReviewCases} from './admin-identity-review.mjs';
import {loadObservedBirthAdmin,renderObservedBirthAdmin} from './admin-observed-birth.mjs';
import {readSavedAdminPage} from './admin-saved-page.mjs';

const sections={
 ids:{label:'Conteggi ID',read:async db=>{const rows=await loadPlayerIdDiagnostics(db);if(!rows)throw Error('counts_unavailable');return renderPlayerIdDiagnostics(rows);}},
 review:{label:'Identità sospette',read:async(db,url)=>{const report=await loadIdentityReviewCases(db,url);if(!report.available)throw Error('review_unavailable');return renderIdentityReviewCases(report);}},
 birth:{label:'Anni di nascita',read:async db=>{const report=await loadObservedBirthAdmin(db);if(!report.available||report.pendingSchema)throw Error('birth_unavailable');return renderObservedBirthAdmin(report);}},
};
const key=id=>'monitoring/admin-pages/id/sections/'+id+'.json';
const valid=value=>value?.version===1&&Number.isFinite(Date.parse(value.checkedAt))&&typeof value.html==='string';

export async function refreshIdentitySection(env,url,id){
 if(!Object.hasOwn(sections,id)||!env.ARCHIVE)return false;
 try{
  const html=await sections[id].read(env.DB,new URL('/admin/id',url));
  await env.ARCHIVE.put(key(id),JSON.stringify({version:1,checkedAt:new Date().toISOString(),html}),{httpMetadata:{contentType:'application/json'}});
  return true;
 }catch(error){console.error('admin_identity_section_refresh_failed',id,error);return false;}
}

function legacySections(saved){
 if(!saved)return {};
 const html=saved.html;
 const match=/<div data-identity-snapshot="1">([\s\S]*?)<section id="admin-review">([\s\S]*?)<\/section><section class="card" id="admin-birth">([\s\S]*?)<\/section><\/div>/.exec(html);
 if(!match)return {};
 return Object.fromEntries(['ids','review','birth'].map((id,i)=>[id,{checkedAt:saved.checkedAt,html:match[i+1]}]));
}

export async function renderIdentitySections(env,url,page){
 const legacy=legacySections(await readSavedAdminPage(env,'id'));
 const failed=url.searchParams.get('refreshFailed');
 const rendered=await Promise.all(Object.entries(sections).map(async([id,{label}])=>{
  let saved;
  try{const object=await env.ARCHIVE?.get(key(id));if(object){const value=await object.json();if(valid(value))saved=value;}}catch{}
  saved??=legacy[id];
  let content=saved?.html||'<p>Nessuna lettura disponibile.</p>';
  if(id==='review'&&url.searchParams.has('reviewAfter')){
   const report=await loadIdentityReviewCases(env.DB,url);
   if(report.available)content='<p>Pagina successiva letta ora. La data sopra si riferisce al report salvato.</p>'+renderIdentityReviewCases(report);
   else content='<p class="pill warn">Pagina delle segnalazioni non disponibile. È mostrata la lettura salvata.</p>'+content;
  }
  const date=saved?new Date(saved.checkedAt).toLocaleString('it-IT',{timeZone:'Europe/Rome'}):'mai aggiornato';
  const timestamp=saved?'<time datetime="'+new Date(saved.checkedAt).toISOString()+'">'+date+'</time>':date;
  const control='<div><form method="post" action="/admin/id?refreshSection='+id+'"><button type="submit"><span aria-hidden="true">↻</span> Aggiorna '+label+'</button></form>'+
   '<p class="muted">Ultimo aggiornamento: '+timestamp+'</p></div>';
  const card='<section class="card"><h2>'+label+'</h2>'+
   (failed===id?'<p role="alert">Aggiornamento non riuscito. Resta disponibile l’ultima lettura di questa sezione, se presente.</p>':'')+content+'</section>';
  return {control,card};
 }));
 const controls='<div class="card summary" role="group" aria-label="Aggiornamenti Admin ID">'+rendered.map(({control})=>control).join('')+'</div>';
 const html=rendered.map(({card})=>card).join('');
 return page.replace(/(<div class="admin-page page-id">)[\s\S]*?(?=<div class="admin-page page-itf">|<\/main>|<\/body>|<\/html>)/,(_match,open)=>open+controls+html+'</div>')
  .replace(/<div class="card"><form\b[^>]*action="\/admin\/id"[^>]*>[\s\S]*?<\/form><p[^>]*>[\s\S]*?<\/p><\/div>/g,'');
}
