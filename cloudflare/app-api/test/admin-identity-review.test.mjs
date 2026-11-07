import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {buildIdentityReviewCase,identityReviewKey} from '../lib/identity-review-queue.mjs';
import {loadIdentityReviewCases,renderIdentityReviewCases,appendIdentityReviewCases} from '../lib/admin-identity-review.mjs';
import worker from '../src/index.js';
const name='EXAMPLE PLAYER',guid='12345678-1234-1234-1234-123456789abc';
const links=[{source_key:'f',name_key:name,display_name:'Example Player',circuit:'fitp',official_id:'123456',canonical_id:'fitp-person',profile_url:'https://www.fitp.it/Pagina-Giocatore/?cardNumber=MTIzNDU2',nationality:'ITA'},{source_key:'e',name_key:name,display_name:'Example Player',circuit:'tennis-europe',official_id:guid,canonical_id:'europe-person',profile_url:'https://te.tournamentsoftware.com/player-profile/'+guid,nationality:'BEL'}];
const save=(d,n=name)=>d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',[identityReviewKey(n),JSON.stringify(buildIdentityReviewCase(n,links.map(r=>({...r,name_key:n})))),'2026-10-25T18:00:00Z']);
test('admin reads only persisted cases, adds available indexed FITP metadata, displays profiles/reasons and never mutates',async()=>{
 const d=database({identityMapping:true});try{save(d);d.execute('CREATE TABLE fitp_player_metadata(membership_card TEXT PRIMARY KEY,ranking TEXT,club TEXT)');d.execute("INSERT INTO fitp_player_metadata VALUES('123456','3.3','Club A')");
 const writes=d.writes(),report=await loadIdentityReviewCases(d.db,'https://app/admin/id'),html=renderIdentityReviewCases(report);assert.equal(d.writes(),writes);assert.equal(report.cases.length,1);assert.match(html,/Identità sospette/);assert.match(html,/Club A/);assert.match(html,/3.3/);assert.match(html,/Nazionalità discordanti/);assert.match(html,/te.tournamentsoftware.com/);assert.doesNotMatch(html,/<script|http-equiv/);
 }finally{d.close()}
});
test('pagination reaches all cases and malformed/error responses are not rendered as zero problems',async()=>{
 const d=database({identityMapping:true});try{for(let i=0;i<53;i++)save(d,'PLAYER '+i);const a=await loadIdentityReviewCases(d.db,'https://app/admin/id');assert.equal(a.cases.length,50);assert.ok(a.next);const b=await loadIdentityReviewCases(d.db,'https://app/admin/id?reviewAfter='+a.next);assert.equal(b.cases.length,3);assert.equal(new Set([...a.cases,...b.cases].map(r=>r.id)).size,53);assert.equal((await loadIdentityReviewCases(d.db,'https://app/admin/id?reviewAfter=bad')).available,false);
 assert.match(renderIdentityReviewCases(await loadIdentityReviewCases({prepare(){throw Error('down')}},'https://app/admin/id')),/non disponibili/);
 }finally{d.close()}
});
test('HTML escapes source data and rejects arbitrary profile links',()=>{
 const c=buildIdentityReviewCase(name,links);c.nameKey='<script>alert(1)</script>';c.identities[0].names=['<img src=x onerror=alert(1)>'];c.identities[0].profileUrl='javascript:alert(1)';
 const html=renderIdentityReviewCases({available:true,cases:[c]});assert.ok(html.includes('&lt;script&gt;'));assert.doesNotMatch(html,/<script|<img|href="javascript:/);
});
test('saved ID waits for manual refresh; explicit review reads and authorized export remain read-only and unauthorized requests expose no data',async()=>{
 const d=database({identityMapping:true});try{
 const old='<html><body><main><nav></nav><div class="admin-page page-id"><div data-identity-snapshot="1">CACHED COUNTS<section id="admin-review"></section><section class="card" id="admin-birth"></section></div></div></main></body></html>';
 const archive={async get(){return{async json(){return{version:1,view:'id',checkedAt:'2026-10-25T17:00:00Z',html:old}}}},async put(){throw Error('must not overwrite ID snapshot')}};
 const env={DB:d.db,ARCHIVE:archive,ADMIN_TOKEN:'secret'};
 let reads=0;const guarded={prepare(sql){reads++;return d.db.prepare(sql)}};
 const noauth=await worker.fetch(new Request('https://app/admin/id?reviewExport=1'),{...env,DB:guarded});assert.equal(noauth.status,401);assert.equal(reads,0);
 save(d);const writes=d.writes(),authorization='Basic '+btoa('admin:secret'),headers={Authorization:authorization};
 const page=await worker.fetch(new Request('https://app/admin/id',{headers}),{...env,DB:guarded}),initial=await page.text();assert.match(initial,/CACHED COUNTS/);assert.match(initial,/refreshSection=review/);assert.doesNotMatch(initial,/currentPanels=1|admin-panel-loader/);assert.equal(reads,0);const fragment=await worker.fetch(new Request('https://app/admin/id?currentPanels=1',{headers}),env),html=(await fragment.json()).review+initial;assert.equal(page.status,200);assert.match(html,/CACHED COUNTS/);assert.match(html,/EXAMPLE PLAYER/);assert.ok(html.indexOf('EXAMPLE PLAYER')<html.indexOf('CACHED COUNTS'),'explicit review response must retain the saved counts');assert.equal(d.writes(),writes);
 const exported=await worker.fetch(new Request('https://app/admin/id?reviewExport=1',{headers}),env);assert.equal(exported.status,200);assert.equal((await exported.json()).cases.length,1);assert.equal(d.writes(),writes);
 }finally{d.close()}
});

test('authenticated unified refresh persists all three sections; subsequent ID opening reads only the saved snapshot',async()=>{
 const d=database({identityMapping:true});const snapshots=new Map();let reads=0,saves=0;
 try{
  save(d);const before=d.writes();
  const env={ADMIN_TOKEN:'secret',DB:{prepare(sql){reads++;return d.db.prepare(sql)}},ARCHIVE:{async get(key){return snapshots.has(key)?{json:async()=>JSON.parse(snapshots.get(key))}:null},async put(key,value){saves++;snapshots.set(key,value)}}};
  const headers={Authorization:'Basic '+btoa('admin:secret')};
  const denied=await worker.fetch(new Request('https://unified-real.test/admin/id?refreshIdentity=1'),env);assert.equal(denied.status,401);assert.equal(reads,0);assert.equal(saves,0);
  const refreshed=await worker.fetch(new Request('https://unified-real.test/admin/id?refreshIdentity=1',{headers}),env);
  assert.equal(refreshed.status,200);assert.deepEqual(await refreshed.json(),{updated:true});assert.equal(saves,1);assert.equal(d.writes(),before);
  const stored=JSON.parse(snapshots.get('monitoring/admin-pages/id/current.json')).html;
  for(const text of ['data-identity-snapshot="1"','ID giocatori per circuito','EXAMPLE PLAYER','admin-birth'])assert.ok(stored.includes(text),text);
  const prior=reads;const opened=await worker.fetch(new Request('https://unified-real.test/admin/id',{headers}),env);
  assert.equal(opened.status,200);assert.match(await opened.text(),/EXAMPLE PLAYER/);assert.equal(reads,prior);assert.equal(saves,1);assert.equal(d.writes(),before);
 }finally{d.close()}
});

test('manual section refresh saves only its own result and leaves previous readings on error',async()=>{
 const d=database({identityMapping:true});const saved=new Map(),keys=[];
 const url='https://sections.test/admin/id';
 const headers={Authorization:'Basic '+btoa('admin:secret'),Origin:'https://sections.test'};
 try{
  save(d);
  const env={ADMIN_TOKEN:'secret',DB:d.db,ARCHIVE:{get:async k=>saved.has(k)?{json:async()=>JSON.parse(saved.get(k))}:null,put:async(k,v)=>{keys.push(k);saved.set(k,v)}}};
  const req=(id,h=headers)=>new Request(url+'?refreshSection='+id,{method:'POST',headers:h});
  assert.equal((await worker.fetch(req('review',{...headers,Origin:'https://other.test'}),env)).status,403);
  const ok=await worker.fetch(req('review'),env);
  assert.equal(ok.status,303);assert.equal(ok.headers.get('Location'),'/admin/id');
  assert.deepEqual(keys,['monitoring/admin-pages/id/sections/review.json']);
  const before=saved.get(keys[0]);
  const bad=await worker.fetch(req('review'),{...env,DB:{prepare(){throw Error('down')}}});
  assert.equal(bad.headers.get('Location'),'/admin/id?refreshFailed=review');
  assert.equal(keys.length,1);assert.equal(saved.get(keys[0]),before);
  const page=await worker.fetch(new Request(url+'?refreshFailed=review',{headers}),env),html=await page.text();
  assert.equal((html.match(/Ultimo aggiornamento:/g)||[]).length,3);
  assert.match(html,/EXAMPLE PLAYER/);assert.match(html,/Aggiornamento non riuscito/);
 }finally{d.close()}
});
