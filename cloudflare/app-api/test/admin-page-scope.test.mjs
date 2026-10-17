import {RUNTIME_DOCUMENT_FILES,encodeDocument,releasePlan} from '../lib/runtime-document-plan.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/index.js';
import {playerIdDiagnosticsSql} from '../lib/admin-player-id-diagnostics.mjs';

const docs=Object.fromEntries(['itf_t1_queue_status.json','itf_metadata_queue_status.json'].map(file=>[file,JSON.parse(readFileSync(new URL('../../../dist/v3/'+file,import.meta.url)))]));
async function open(view,{remoteFailure=false}={}) {
  const sql=[],objects=[],urls=[];
  const documents=RUNTIME_DOCUMENT_FILES.map(path=>encodeDocument(path,docs[path.split('/').at(-1)]||{status:'fixture_complete',players:[{}],tournaments:[{}]})),release=releasePlan(documents,'fixture');
  const db={prepare(query){sql.push(query);return{bind(...values){this.values=values;return this},async first(){if(query.includes("key='runtimeDocumentRelease'"))return{value:release.value};return query.includes('generations')?{status:'green',counts_json:'{}'}:{n:0}},async all(){if(query.includes('runtime_document_chunks'))return{results:documents.find(d=>d.path===this.values[0]).chunks.map((data,seq)=>({seq,data}))};return{success:true,results:query===playerIdDiagnosticsSql?['fitp','tennis-europe','itf'].map(circuit=>({circuit,ids:0,players:0,missing:0})):[]}}}}};
  const archive={async get(key){objects.push(key);return{async json(){return{}}}}};
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async url=>{urls.push(String(url));return remoteFailure?new Response('',{status:503}):Response.json(docs[String(url).split('/').at(-1)]||{});};
  try{
    const response=await worker.fetch(new Request('https://example.test/admin/'+view,{headers:{Authorization:'Basic '+btoa('admin:test-only')}}),{ADMIN_TOKEN:'test-only',DB:db,ARCHIVE:archive});
    assert.equal(response.status,200);
    return{sql,objects,urls,html:await response.text()};
  }finally{globalThis.fetch=previousFetch;}
}
test('Cloudflare reads only its R2 usage snapshot, including during a remote outage',async()=>{
  const r=await open('cloudflare',{remoteFailure:true});
  assert.deepEqual(r.sql,[]);assert.deepEqual(r.urls,[]);
  assert.deepEqual(r.objects,['monitoring/cloudflare-usage/current.json']);
  assert.match(r.html,/<h2>Consumi Cloudflare<\/h2>/);
  assert.doesNotMatch(r.html,/<div class="admin-page page-(?:diagnostica|id|itf|utenti)">/);
});
test('ITF reads exactly two verified D1 reports, without HTTP or R2',async()=>{
  const r=await open('itf');
  assert.equal(r.sql.length,3);assert.deepEqual(r.objects,[]);assert.deepEqual(r.urls,[]);
  assert.equal(r.sql.filter(q=>q.includes('runtime_document_chunks')).length,2);
  assert.match(r.html,/Completezza tabelloni ITF/);assert.match(r.html,/metadati/i);
});
test('Users keeps device and override controls but performs no remote or R2 reads',async()=>{
  const r=await open('utenti',{remoteFailure:true});
  assert.equal(r.sql.length,4);assert.deepEqual(r.urls,[]);assert.deepEqual(r.objects,[]);
  assert.ok(r.sql.every(query=>/app_users|user_player_profiles|app_user_devices|manual_overrides/.test(query)));
  assert.match(r.html,/action="\/admin\/override"/);assert.match(r.html,/Dispositivi connessi/);
});
test('ID is independent of remote diagnostics and backup availability',async()=>{
  const r=await open('id',{remoteFailure:true});
  assert.ok(r.sql.includes(playerIdDiagnosticsSql));assert.deepEqual(r.urls,[]);assert.deepEqual(r.objects,['monitoring/admin-pages/id/current.json']);
  assert.ok(!r.sql.some(query=>/SELECT \* FROM generations|FROM app_user_devices|FROM manual_overrides|FROM app_players ORDER BY seq/.test(query)));
  assert.match(r.html,/action="\/admin\/id#id-circuiti"/);
});
test('Diagnostics retains all requested controls, reads only three current R2 pointers and excludes ITF queues',async()=>{
  const r=await open('diagnostica');
  assert.equal(r.sql.length,21);assert.equal(r.objects.length,4);assert.ok(r.objects.slice(1).every(key=>key.endsWith('/pointers/current.json')));
  assert.equal(r.urls.length,0);assert.ok(!r.urls.some(url=>/itf_.*(?:queue_status|metadata_diagnostics)/.test(url)));
  for(const heading of ['D1 operativo','Copertura','Motori','Workflow e watchdog','Diagnostica applicativa','Conteggi D1','R2 backup'])assert.ok(r.html.includes('<h2>'+heading+'</h2>'));
});
