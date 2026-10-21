// D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES
// D1_TEST_REAL_DELTAS_ONLY / D1_TEST_INCOMPLETE_SOURCE_GUARD
import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './search-sqlite-fixture.mjs';
import {syncPlayerIdentities} from '../scripts/sync-player-identities.mjs';
import {repairPersonalAuditReference,personalRepairRule,personalId,sourceKey,approved,repairKey} from '../lib/audit-personal-reference-repair.mjs';
import {allPlayerIdAuditSql,allPlayerIdAuditResult} from '../lib/all-player-id-audit.mjs';
const confirmed={nameKey:'PIETRO SALA',identities:approved};
const profile='https://www.fitp.it/Pagina-Giocatore/?cardNumber='+btoa('4537099241');
const payload={name:'Pietro Sala',birthYear:2009,nationality:'ITA',membershipCard:'4537099241',circuitProfiles:[{circuit:'fitp',url:profile}]};
function add(d,key,circuit,id,p){d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',[key,circuit,id,'PIETRO SALA','Pietro Sala',JSON.stringify(p)]);}
async function setup(){
 const d=database({identityMapping:true});
 add(d,'fitp','fitp','4537099241',{name:'Pietro Sala',birthYear:2009,nationality:'ITA'});
 add(d,sourceKey,'itf','800638581',{name:'Pietro Sala',birthYear:2009,nationality:'SUI'});
 add(d,'homonym','fitp','0264379435',{name:'Pietro Sala',birthYear:1964,nationality:'ITA'});
 d.execute('INSERT INTO app_state VALUES(?,?,?)',['confirmedPlayerCircuitLink:pietro-sala-decimomannu',JSON.stringify(confirmed),'today']);await syncPlayerIdentities(d.query);
 d.execute("INSERT INTO user_app_player_additions VALUES('private-owner',?,?,?,'today')",[personalId,sourceKey,JSON.stringify(payload)]);
 d.execute('INSERT INTO player_identity_people VALUES(?,?,?)',[personalId,'PIETRO SALA',JSON.stringify({...payload,canonicalId:personalId})]);
 d.execute('INSERT INTO player_circuit_identities VALUES(?,?,?,?,?,?,?,?,?,?)',['courtwatch|'+personalId,personalId,'PIETRO SALA','courtwatch',personalId,'','PIETRO SALA','Pietro Sala',2009,'ITA']);
 d.execute('INSERT INTO player_identity_aliases VALUES(?,?)',[personalId,personalId]);d.execute('DELETE FROM player_identity_pending_sources');return d;
}
test('exact approved native personal link repairs ambiguity, preserves homonym and raw payload, replay writes zero',async()=>{
 const d=await setup();try{
  assert.equal(allPlayerIdAuditResult((await d.query(allPlayerIdAuditSql))[0]).unmapped_or_ambiguous_sources,1);
  const raw=d.execute('SELECT * FROM user_app_player_additions'),matches=d.execute('SELECT * FROM matches');
  const homonym=d.execute("SELECT canonical_id FROM player_circuit_identities WHERE source_key='homonym'")[0].canonical_id;
  const result=await repairPersonalAuditReference(d.query);assert.equal(result.status,'verified_personal_reference');
  assert.equal(allPlayerIdAuditResult((await d.query(allPlayerIdAuditSql))[0]).passed,true);
  assert.deepEqual(d.execute('SELECT * FROM user_app_player_additions'),raw);assert.deepEqual(d.execute('SELECT * FROM matches'),matches);
  assert.equal(d.execute("SELECT canonical_id FROM player_circuit_identities WHERE source_key='homonym'")[0].canonical_id,homonym);assert.notEqual(result.canonicalId,homonym);
  d.execute('UPDATE search_acquired_players SET payload=? WHERE source_key=?',[JSON.stringify({name:'Pietro Sala',nationality:'SUI',birthYear:2009,club:'New club'}),sourceKey]);
  await syncPlayerIdentities(d.query);assert.equal(allPlayerIdAuditResult((await d.query(allPlayerIdAuditSql))[0]).passed,true);
  const writes=d.writes();assert.equal((await repairPersonalAuditReference(d.query)).status,'already_verified');assert.equal(d.writes(),writes);
 }finally{d.close()}
});
test('changed personal native ID or birth year, target, origin and approval abort before any writes',async()=>{
 for(const change of [p=>({...p,membershipCard:'0264379435',circuitProfiles:[]}),p=>({...p,birthYear:1964}),p=>({...p,birthYear:undefined,birthDate:'1964-01-01'}),p=>({...p,membershipCard:'0264379435',worldTennisId:'800638581'})]){
  const d=await setup();try{d.execute('UPDATE user_app_player_additions SET payload=?',[JSON.stringify(change(payload))]);const writes=d.writes();await assert.rejects(repairPersonalAuditReference(d.query),/payload_evidence_conflicts/);assert.equal(d.writes(),writes);assert.equal(d.execute('SELECT * FROM app_state WHERE key=?',[repairKey]).length,0);}finally{d.close()}
 }
 const base={confirmed:{value:JSON.stringify(confirmed)},additions:[{observed_source_key:sourceKey,payload:JSON.stringify(payload)}],oldLinks:[{circuit:'courtwatch',canonical_id:personalId,source_key:'courtwatch|'+personalId}],oldNative:[{circuit:'fitp',official_id:'4537099241'}],targetNative:approved};
 assert.deepEqual(personalRepairRule(base).courtwatchIds,[personalId]);
 for(const snapshot of [{...base,confirmed:null},{...base,additions:[{observed_source_key:'wrong'}]},{...base,oldLinks:[{circuit:'fitp'}]},{...base,oldNative:[{circuit:'fitp',official_id:'0264379435'}]},{...base,targetNative:[approved[0]]}])assert.throws(()=>personalRepairRule(snapshot));
});
test('legacy excluded source personal shadow and membership stay excluded; independent missing player still fails',async()=>{
 const d=database({identityMapping:true});try{
  const id='cw-739e50885f90c53fb353663d721fc95c',key='tennis-europe|name:MOEZ BEN AMOR';
  d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',[key,'tennis-europe','','MOEZ BEN AMOR','Moez Ben-Amor',JSON.stringify({name:'Moez Ben-Amor'})]);
  d.execute("INSERT INTO user_app_player_additions VALUES('owner',?,?,?,'today')",[id,key,JSON.stringify({name:'Moez Ben-Amor'})]);d.execute("INSERT INTO user_app_players VALUES('owner',?,'today')",[id]);
  add(d,'good','fitp','123456',{name:'Pietro Sala'});await syncPlayerIdentities(d.query);
  const writes=d.writes();let result=allPlayerIdAuditResult((await d.query(allPlayerIdAuditSql))[0]);assert.equal(result.passed,true);assert.equal(result.players_without_id,0);assert.equal(d.writes(),writes);
  d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',['unknown','itf','name:Other','OTHER','Other',JSON.stringify({name:'Other'})]);await syncPlayerIdentities(d.query);
  result=allPlayerIdAuditResult((await d.query(allPlayerIdAuditSql))[0]);assert.equal(result.passed,false);assert.equal(result.players_without_id,1);assert.equal(d.execute('SELECT COUNT(*) AS n FROM user_app_player_additions')[0].n,1);
 }finally{d.close()}
});


test('an excluded source never hides independently configured or newly native personal evidence',async()=>{
 const d=database({identityMapping:true});try{
  const id='personal-moez',key='tennis-europe|name:MOEZ BEN AMOR';
  d.execute("INSERT INTO user_app_player_additions VALUES('owner',?,?,?,'today')",[id,key,JSON.stringify({name:'Moez Ben-Amor'})]);
  d.execute('INSERT INTO app_players(id,payload,seq) VALUES(?,?,1)',[id,JSON.stringify({name:'Moez Ben-Amor'})]);await syncPlayerIdentities(d.query);
  assert.equal(allPlayerIdAuditResult((await d.query(allPlayerIdAuditSql))[0]).passed,false);
  d.execute('DELETE FROM app_players WHERE id=?',[id]);
  d.execute('UPDATE user_app_player_additions SET payload=? WHERE courtwatch_id=?',[JSON.stringify({name:'Moez Ben-Amor',membershipCard:'123456',circuitProfiles:[{circuit:'fitp',url:'https://www.fitp.it/Pagina-Giocatore/?cardNumber='+btoa('123456')}]}),id]);await syncPlayerIdentities(d.query);
  const result=allPlayerIdAuditResult((await d.query(allPlayerIdAuditSql))[0]);assert.equal(result.players,1);assert.equal(result.players_with_id,1);
 }finally{d.close()}
});

test('targeted repair leaves unrelated queued source revisions untouched',async()=>{
 const d=await setup();try{
  d.execute('INSERT INTO search_acquired_players VALUES(?,?,?,?,?,?)',['unrelated','itf','800999999','UNRELATED','Unrelated',JSON.stringify({name:'Unrelated'})]);
  const pending=d.execute("SELECT * FROM player_identity_pending_sources WHERE source_key='unrelated'");assert.equal(pending.length,1);
  await repairPersonalAuditReference(d.query);
  assert.deepEqual(d.execute("SELECT * FROM player_identity_pending_sources WHERE source_key='unrelated'"),pending);
  assert.equal(d.execute("SELECT * FROM player_circuit_identities WHERE source_key='unrelated'").length,0);
 }finally{d.close()}
});
