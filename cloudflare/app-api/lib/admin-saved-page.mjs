// D1_WRITE_POLICY: incremental; no D1 mutations. R2 writes on first build or manual refresh only.
// Store only the authenticated ID/operational diagnostic pages, never account/device pages.
const flights=new Map(),versions=new Map();
const spec={id:{flag:'refreshIds',label:'Aggiorna conteggi'},diagnostica:{flag:'refreshDiagnostics',label:'Aggiorna diagnostica'}};
const key=view=>'monitoring/admin-pages/'+view+'/current.json';

async function read(env,view){
 if(!env.ARCHIVE)return null;
 try{
  const object=await env.ARCHIVE.get(key(view));if(!object)return null;
  const value=await object.json();
  if(value?.version!==1||value.view!==view||!Number.isFinite(Date.parse(value.checkedAt))||typeof value.html!=='string'||!value.html.includes('class="admin-page page-'+view+'"'))return null;
  return value;
 }catch{return null;}
}

export async function savedAdminPage(request,env,view,render){
 const cfg=spec[view];if(!cfg)return render();
 const force=new URL(request.url).searchParams.get(cfg.flag)==='1';
 if(!force){const saved=await read(env,view);if(saved)return saved.html;}
 const flightKey=new URL(request.url).origin+'|'+view;
 if(!force&&flights.has(flightKey))return flights.get(flightKey);
 const version=(versions.get(flightKey)||0)+1;versions.set(flightKey,version);
 const build=(async()=>{
  const raw=await render(),checkedAt=new Date().toISOString();
  // Never replace a valid saved ID page with unavailable counts.
  const unavailable=view==='id'&&raw.includes('Conteggi ID non disponibili');
  const control=`<div class="card"><form method="get" action="/admin/${view}"><button type="submit" name="${cfg.flag}" value="1">${cfg.label}</button></form><p class="muted">Lettura del ${new Date(checkedAt).toLocaleString('it-IT',{timeZone:'Europe/Rome'})}. Rimane questa versione fino al prossimo aggiornamento manuale. Stati e freschezza si riferiscono a questa lettura.</p></div>`;
  const html=raw.replace('</nav>','</nav>'+control);
  if(env.ARCHIVE&&!unavailable&&versions.get(flightKey)===version){
   try{await env.ARCHIVE.put(key(view),JSON.stringify({version:1,view,checkedAt,html}),{httpMetadata:{contentType:'application/json'}});return html;}
   catch(error){console.error('admin_snapshot_save_failed',error);}
  }
  return html.replace('Rimane questa versione fino al prossimo aggiornamento manuale.','Questa lettura non è stata salvata; la precedente copia resta disponibile.');
 })();
 flights.set(flightKey,build);build.finally(()=>{if(flights.get(flightKey)===build)flights.delete(flightKey);}).catch(()=>{});
 return build;
}

export async function prepareSavedIdPage(request,env,render){
 if(!env.ARCHIVE)return;
 await savedAdminPage(new Request(new URL('/admin/id',request.url)),env,'id',render);
}
