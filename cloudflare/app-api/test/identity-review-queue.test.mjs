import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {buildIdentityReviewCase,syncIdentityReview,identityReviewKey,identityReviewDecisionKey} from '../lib/identity-review-queue.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
const guid='12345678-1234-1234-1234-123456789abc',name='DARKO SARTORI';
const row=(id,circuit,person,extra={})=>({source_key:circuit+'|'+id,name_key:name,display_name:'Darko Sartori',circuit,official_id:id,canonical_id:person,profile_url:circuit==='fitp'?'https://www.fitp.it/Pagina-Giocatore/?cardNumber=MTIzNDU2':circuit==='itf'?'https://www.itftennis.com/en/players/darko-sartori/'+id+'/ita/jt/s/overview/':'https://te.tournamentsoftware.com/player-profile/'+id,nationality:'ITA',birth_year:2010,...extra});
const split=[row('123456','fitp','a'),row(guid,'tennis-europe','b')];
test('suspicious native cross-circuit split records reasons and stable exact profile IDs; an ordinary unified identity has no case',()=>{
 const c=buildIdentityReviewCase(name,split);assert.ok(c.id.startsWith('ID-'));assert.ok(c.reasons.includes('Profili omonimi separati tra circuiti'));assert.equal(c.identities.length,2);
 assert.equal(buildIdentityReviewCase(name,split.map(r=>({...r,canonical_id:'one'}))),null);
 assert.equal(buildIdentityReviewCase(name,[row('123456','fitp','a'),row('654321','fitp','b')]),null);
 assert.equal(buildIdentityReviewCase(name,[row('name:Darko','fitp','a'),row(guid,'tennis-europe','b')]),null);
});
test('reviewed exact IDs are not reopened; a new ID reopens; confirmed-link regressions and shared native IDs are never suppressed',()=>{
 const ids=['fitp|123456','tennis-europe|'+guid];
 assert.equal(buildIdentityReviewCase(name,split,{reviewedIds:ids}),null);
 assert.ok(buildIdentityReviewCase(name,[...split,row('800123456','itf','c')],{reviewedIds:ids}));
 assert.ok(buildIdentityReviewCase(name,split,{reviewedIds:ids,confirmedLinks:[{identities:[{circuit:'fitp',officialId:'123456'},{circuit:'tennis-europe',officialId:guid}]}]}).reasons.includes('Associazione già confermata non più unificata'));
 assert.ok(buildIdentityReviewCase(name,[...split,row('123456','fitp','other')],{reviewedIds:ids}).reasons.includes('Stesso ID ufficiale collegato a persone diverse'));
});
test('D1_TEST_INITIAL_IMPORT D1_TEST_REAL_DELTAS_ONLY D1_TEST_IDENTICAL_ZERO_WRITES: only affected cases change; unchanged evidence writes zero; resolved scoped case removed without touching another',async()=>{
 const d=database({identityMapping:true});try{
  const q=[];const query=sql=>{q.push(sql);return d.query(sql)};
  await syncIdentityReview(query,split);const first=d.execute('SELECT * FROM app_state WHERE key=?',[identityReviewKey(name)])[0];assert.ok(first);
  const writes=d.writes();await syncIdentityReview(query,split);assert.equal(d.writes(),writes);
  await syncIdentityReview(query,split.map(r=>({...r,name_key:'OTHER NAME'})));assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'identityReviewCase:%'").length,2);
  await syncIdentityReview(query,split.map(r=>({...r,canonical_id:'one'})));assert.equal(d.execute('SELECT * FROM app_state WHERE key=?',[identityReviewKey(name)]).length,0);assert.equal(d.execute("SELECT * FROM app_state WHERE key LIKE 'identityReviewCase:%'").length,1);
  assert.ok(q.filter(s=>s.startsWith('SELECT')).every(s=>s.includes('WHERE key IN (')));
 }finally{d.close()}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: partial groups cannot erase cases',async()=>{
 const d=database({identityMapping:true});try{await syncIdentityReview(d.query,split);const writes=d.writes();await assert.rejects(syncIdentityReview(d.query,[],{names:[name],sourceComplete:false}),/incomplete/);assert.equal(d.writes(),writes);assert.equal(d.execute('SELECT * FROM app_state WHERE key=?',[identityReviewKey(name)]).length,1);}finally{d.close()}
});
test('ordinary identity index saves new suspicious cases; user resolution with exact reviewed-ID acknowledgment closes them; no external discovery',async()=>{
 const d=database({identityMapping:true});try{
  const add=(key,circuit,id,p)=>d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',[key,circuit,id,name,'Darko Sartori',JSON.stringify(p)]);
  add('f1','fitp','123456',{nationality:'ITA',birthYear:2010,ranking:'3.3',club:'Club A'});
  add('f2','fitp','654321',{nationality:'ITA',birthYear:2011});
  add('e','tennis-europe',guid,{nationality:'ITA'});
  const audit=await syncPlayerIdentities(d.query);assert.equal(audit.identityReview.open,1);
  const saved=JSON.parse(d.execute('SELECT value FROM app_state WHERE key=?',[identityReviewKey(name)])[0].value);assert.equal(saved.identities.find(p=>p.officialId==='123456').ranking,'3.3');assert.equal(saved.identities.find(p=>p.officialId==='123456').club,'Club A');
  const replay=d.writes();await syncPlayerIdentities(d.query);assert.equal(d.writes(),replay);
  const rule={nameKey:name,identities:[{circuit:'fitp',officialId:'123456'},{circuit:'tennis-europe',officialId:guid}]};
  d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',['confirmedPlayerCircuitLink:test',JSON.stringify(rule),'now']);
  d.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?)',[identityReviewDecisionKey(name),JSON.stringify({reviewedNativeIds:['fitp|123456','fitp|654321','tennis-europe|'+guid]}),'now']);
  d.execute("UPDATE search_acquired_players SET payload=json_set(payload,'$.club','Updated') WHERE source_key='f1'");
  await syncPlayerIdentities(d.query);assert.equal(d.execute('SELECT * FROM app_state WHERE key=?',[identityReviewKey(name)]).length,0);
 }finally{d.close()}
});
test('existing user-reviewed homonyms stay closed; adding an unknown ID of that name reopens',()=>{
 const reviewed=JSON.parse(fs.readFileSync(new URL('../data/identity-review-decisions-20261025.json',import.meta.url))).groups;
 const n='GUIDI MATTEO',links=[row('2371240120','fitp','f',{name_key:n}),row('ea1ab82b-8b5b-4af4-bd46-8b24cde115c8','tennis-europe','e',{name_key:n,nationality:'BEL'})];
 assert.equal(buildIdentityReviewCase(n,links,{reviewedIds:reviewed[n]}),null);
 assert.ok(buildIdentityReviewCase(n,[...links,row('800999999','itf','new',{name_key:n})],{reviewedIds:reviewed[n]}));
});
