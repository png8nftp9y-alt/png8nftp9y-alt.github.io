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
  const db={prepare(query){sql.push(query);return{bind(...values){this.values=values;return this},async first(){if(query.startsWith('SELECT (SELECT COUNT(*)'))return Object.fromEntries([...query.matchAll(/AS ([a-z_]+)/g)].map(m=>[m[1],0]));if(query.includes("key='runtimeDocumentRelease'"))return{value:release.value};return query.includes('generations')?{status:'green',counts_json:'{}'}:{n:0}},async all(){if(query.includes('AS table_name'))return{results:[...query.matchAll(/SELECT '([^']+)' AS table_name/g)].map(m=>({table_name:m[1],n:0}))};if(query.startsWith('WITH current AS'))return{results:[{kind:'release',data:release.value},...documents.filter(d=>this.values.includes(d.path)).flatMap(d=>d.chunks.map((data,seq)=>({kind:'chunk',path:d.path,seq,data})))]};if(query.includes('runtime_document_chunks'))return{results:documents.find(d=>d.path===this.values[0]).chunks.map((data,seq)=>({seq,data}))};return{success:true,results:query===playerIdDiagnosticsSql?['fitp','tennis-europe','itf'].map(circuit=>({circuit,ids:0,players:0,missing:0})):[]}}}}};
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
  assert.equal(r.sql.length,1);assert.deepEqual(r.objects,[]);assert.deepEqual(r.urls,[]);
  assert.equal(r.sql.filter(q=>q.includes('runtime_document_chunks')).length,1);
  assert.match(r.html,/Completezza tabelloni ITF/);assert.match(r.html,/metadati/i);
});
test('Users keeps device and override controls but performs no remote or R2 reads',async()=>{
  const r=await open('utenti',{remoteFailure:true});
  assert.equal(r.sql.length,3);assert.deepEqual(r.urls,[]);assert.deepEqual(r.objects,[]);
  assert.ok(r.sql.every(query=>/app_users|user_player_profiles|app_user_devices|manual_overrides/.test(query)));
  assert.match(r.html,/action="\/admin\/override"/);assert.match(r.html,/Dispositivi connessi/);
});
test('ID is independent of remote diagnostics and backup availability',async()=>{
  const r=await open('id',{remoteFailure:true});
  assert.deepEqual(r.sql,[]);assert.deepEqual(r.urls,[]);assert.deepEqual(r.objects,['monitoring/admin-pages/id/current.json']);
  assert.ok(!r.sql.some(query=>/SELECT \* FROM generations|FROM app_user_devices|FROM manual_overrides|FROM app_players ORDER BY seq/.test(query)));
  assert.match(r.html,/refreshIds/);
});
test('Diagnostics without a saved reading offers manual counts and current panels without database scans',async()=>{
  const r=await open('diagnostica');
  assert.equal(r.sql.length,0);assert.equal(r.objects.length,1);
  assert.equal(r.urls.length,0);assert.ok(!r.urls.some(url=>/itf_.*(?:queue_status|metadata_diagnostics)/.test(url)));
  for(const heading of ['Workflow e watchdog','Diagnostica applicativa'])assert.ok(r.html.includes('<h2>'+heading+'</h2>'));
});

test('cold Diagnostics executes consolidated counts on SQLite; optional missing tables retain safe fallback',async()=>{
 const {database}=await import('./search-sqlite-fixture.mjs');const d=database();
 try{
  const queries=[];const db={prepare(sql){queries.push(sql);return d.db.prepare(sql)}};
  const req=()=>new Request('https://cold.test/admin/diagnostica',{headers:{Authorization:'Basic '+btoa('admin:test-only')}});
  const before=d.writes();const response=await worker.fetch(req(),{ADMIN_TOKEN:'test-only',DB:db});
  assert.equal(response.status,200);const html=await response.text();assert.match(html,/Conteggi D1/);
  assert.equal(queries.length,4);assert.equal(d.writes(),before);
  const countSql=queries.find(sql=>sql.startsWith('SELECT (SELECT COUNT(*)'));
  const counts=d.execute(countSql)[0];
  for(const [table,count] of Object.entries(counts))assert.equal(count,d.execute('SELECT COUNT(*) AS n FROM '+table)[0].n);
  const {spawnSync}=await import('node:child_process');
  const strict=spawnSync('python3',['-c',`import json,sqlite3,sys
p=json.load(sys.stdin);c=sqlite3.connect(':memory:');c.setlimit(sqlite3.SQLITE_LIMIT_COMPOUND_SELECT,3)
for name in p['tables']:c.execute('CREATE TABLE '+name+' (id INTEGER)')
try:
 c.execute(' UNION ALL '.join('SELECT COUNT(*) FROM '+name for name in p['tables']))
 raise Exception('Old query unexpectedly accepted')
except sqlite3.OperationalError as e:
 assert 'too many terms' in str(e)
assert len(c.execute(p['sql']).fetchone())==len(p['tables'])
`],{encoding:'utf8',input:JSON.stringify({sql:countSql,tables:Object.keys(counts)})});
  assert.equal(strict.status,0,strict.stderr);
  const snapshots=new Map();let saves=0;
  const env={ADMIN_TOKEN:'test-only',DB:db,ARCHIVE:{
   async get(key){return snapshots.has(key)?{json:async()=>JSON.parse(snapshots.get(key))}:null},
   async put(key,value){snapshots.set(key,value);saves++}
  }};
  const refreshed=await worker.fetch(new Request('https://cold.test/admin/diagnostica?refreshDiagnostics=1',{headers:{Authorization:'Basic '+btoa('admin:test-only')}}),env);
  assert.equal(refreshed.status,200);assert.match(await refreshed.text(),/Conteggi D1/);
  assert.equal(saves,1);assert.equal(d.writes(),before);
  assert.match(JSON.parse(snapshots.get('monitoring/admin-pages/diagnostica/current.json')).html,/Conteggi D1/);
  const reads=queries.length;
  assert.equal((await worker.fetch(req(),env)).status,200);
  assert.equal(queries.length,reads);assert.equal(saves,1);
  d.execute('DROP TABLE admin_audit');
  const fallback=await worker.fetch(req(),{ADMIN_TOKEN:'test-only',DB:db});assert.equal(fallback.status,200);assert.match(await fallback.text(),/Conteggi D1/);
 }finally{d.close();}
});
