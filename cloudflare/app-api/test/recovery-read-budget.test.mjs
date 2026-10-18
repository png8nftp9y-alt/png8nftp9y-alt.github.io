import {indexedRecoverySql,recoveryReadQuery} from '../lib/recovery-read-query.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {dependencyVersion} from '../lib/d1-read-check-cache.mjs';
import {database} from './search-sqlite-fixture.mjs';
import {syncPlayerIdentities,recoverMissingProfiles} from '../scripts/sync-player-identities.mjs';
import {circuitMissingNativeSourcesSql} from '../lib/circuit-native-source-recovery.mjs';
import {playerNativeIdAuditCtes} from '../lib/all-player-id-audit.mjs';
import {europeMissingIdOriginsSql} from '../lib/europe-missing-id-origins.mjs';

test('consumer versions ignore unrelated edits and invalidate transitive dependency changes',async()=>{
 const dir=await mkdtemp(tmpdir()+'/cw-versions-');
 try{
  const url=name=>pathToFileURL(dir+'/'+name);
  await writeFile(url('entry.mjs'),"import {value} from './dep.mjs'; export const result=value;");
  await writeFile(url('dep.mjs'),'export const value=1;');
  const before=await dependencyVersion(url('entry.mjs'));
  await writeFile(url('unrelated.mjs'),'export const value=2;');
  assert.equal(await dependencyVersion(url('entry.mjs')),before);
  await writeFile(url('dep.mjs'),'export const value=3;');
  assert.notEqual(await dependencyVersion(url('entry.mjs')),before);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('one changed identity verifies its retained group without recounting unrelated tables',async()=>{
 const d=database({identityMapping:true});
 try{
  await d.query(`INSERT INTO search_acquired_players VALUES('a','fitp','123456','TEST PLAYER','Test Player','{}');`);
  await syncPlayerIdentities(d.query);
  await d.query(`UPDATE search_acquired_players SET payload='{"club":"Changed"}' WHERE source_key='a'`);
  const seen=[];
  const result=await syncPlayerIdentities(async sql=>{seen.push(sql);assert.doesNotMatch(sql,/SELECT COUNT\(\*\) FROM (player_identity_people|player_circuit_identities|observed_players|search_acquired_players)/);return d.query(sql)});
  assert.equal(result.status,'ready');assert.equal(result.auditScope,'affected_identity_groups');
  assert.ok(seen.some(sql=>sql.includes('saved_person')));
 }finally{d.close()}
});

test('unacknowledged canonical/link writes fail coverage and retain the pending source',async()=>{
 const d=database({identityMapping:true});try{
  await d.query(`INSERT INTO search_acquired_players VALUES('a','fitp','123456','TEST PLAYER','Test Player','{}')`);
  await assert.rejects(syncPlayerIdentities(async sql=>sql.includes('INSERT INTO player_circuit_identities')?[]:d.query(sql)),/identity_mapping_coverage_failed/);
  assert.equal(d.execute('SELECT COUNT(*) AS n FROM player_identity_pending_sources')[0].n,1);
  assert.equal((await syncPlayerIdentities(d.query)).status,'ready');
 }finally{d.close()}
});

test('cold recovery SQL preserves missing native identities and uses less SQLite work on covered history',async()=>{
 const directory=new URL('../migrations/',import.meta.url);
 const schema=(await Promise.all((await readdir(directory)).filter(n=>n.endsWith('.sql')).sort().map(n=>readFile(new URL(n,directory),'utf8')))).join('\n');
 const oldNative=`${playerNativeIdAuditCtes}
SELECT s.*,l.canonical_id FROM (
 SELECT 'observed_players' AS source_table,source_key,circuit,official_id,normalized_name,display_name,payload FROM observed_players
 UNION ALL SELECT 'search_acquired_players',source_key,circuit,official_id,normalized_name,display_name,payload FROM search_acquired_players
) s JOIN eligible_links l ON l.source_key=s.source_key AND l.circuit=s.circuit
WHERE s.circuit IN ('fitp','itf') AND NOT EXISTS(SELECT 1 FROM native n WHERE n.canonical_id=l.canonical_id AND n.circuit=l.circuit)
ORDER BY s.source_table,s.source_key`;
 const oldEurope=europeMissingIdOriginsSql.replace(/WITH candidate_people AS MATERIALIZED \([\s\S]*?\), eligible_links AS MATERIALIZED \(/,'WITH eligible_links AS MATERIALIZED (').replace('canonical_id IN (SELECT canonical_id FROM candidate_people) AND ','').replace(' INDEXED BY player_circuit_identity_person','').replace("UNION SELECT p.canonical_id FROM (SELECT DISTINCT canonical_id FROM eligible_links WHERE circuit='courtwatch') e\n CROSS JOIN player_identity_people p ON p.canonical_id=e.canonical_id,","UNION SELECT p.canonical_id FROM player_identity_people p\n JOIN (SELECT DISTINCT canonical_id FROM eligible_links WHERE circuit='courtwatch') e ON e.canonical_id=p.canonical_id,");
 const profileSql=[];await recoverMissingProfiles(async sql=>{profileSql.push(sql);return []});
 const oldProfile=profileSql[0].replace('FROM player_circuit_identities l CROSS JOIN observed_players s ON s.source_key=l.source_key','FROM observed_players s JOIN player_circuit_identities l ON l.source_key=s.source_key');
 const script=`import json,sqlite3,sys
p=json.load(sys.stdin);c=sqlite3.connect(':memory:');c.row_factory=sqlite3.Row;c.executescript(p['schema'])
for i in range(9000):
 circuit=['fitp','itf','tennis-europe'][i%3];official=str(100000+i) if circuit=='fitp' else str(800100000+i) if circuit=='itf' else ('%08x-1234-1234-1234-123456789abc'%i)
 key='source:'+str(i);person='person:'+str(i)
 c.execute('INSERT INTO player_identity_people VALUES(?,?,?)',(person,key,'{}'))
 c.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',(key,circuit,official,key,key,'{}'))
 c.execute('INSERT INTO player_circuit_identities VALUES(?,?,?,?,?,?,?,?,?,?)',(key,person,key,circuit,official,'https://verified.example/',key,key,None,''))
# One genuinely unresolved original source, plus one unresolved Europe source.
for circuit in ['fitp','tennis-europe']:
 key='missing:'+circuit;person='missing-person:'+circuit
 c.execute('INSERT INTO player_identity_people VALUES(?,?,?)',(person,key,'{}'))
 c.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',(key,circuit,'',key,key,'{}'))
 c.execute('INSERT INTO player_circuit_identities VALUES(?,?,?,?,?,?,?,?,?,?)',(key,person,key,circuit,'','',key,key,None,''))
def measured(sql):
 ticks=[0]
 def progress():ticks[0]+=1;return 0
 c.set_progress_handler(progress,100);rows=[dict(r) for r in c.execute(sql).fetchall()];c.set_progress_handler(None,0)
 return rows,ticks[0]
result=[]
for old,new in p['pairs']:
 before,oldSteps=measured(old);after,newSteps=measured(new);result.append({'equal':before==after,'oldSteps':oldSteps,'newSteps':newSteps,'rows':len(after)})
print(json.dumps(result))`;
 const r=spawnSync('python3',['-c',script],{input:JSON.stringify({schema,pairs:[[oldNative,indexedRecoverySql(circuitMissingNativeSourcesSql,'identity_invalid_native')],[oldEurope,indexedRecoverySql(europeMissingIdOriginsSql,'identity_invalid_europe')],[oldProfile,profileSql[0]]]}),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 const results=JSON.parse(r.stdout);console.log('LOCAL_SQLITE_WORK_COMPARISON='+JSON.stringify(results));
 for(const result of results){assert.equal(result.equal,true);assert.ok(result.newSteps<result.oldSteps*.6,JSON.stringify(result))}
});

test('pre-migration recovery falls back to authoritative query; migrated recovery selects its sparse index',async()=>{
 for(const present of [false,true]){
  const seen=[];const sql='SELECT source_key FROM player_circuit_identities WHERE circuit=\'fitp\'';
  const rows=await recoveryReadQuery(async q=>{seen.push(q);return q.includes('sqlite_master')?(present?[{name:'identity_invalid_native'}]:[]):[{source_key:'missing'}]},sql,'identity_invalid_native');
  assert.deepEqual(rows,[{source_key:'missing'}]);assert.equal(seen.length,2);
  assert.equal(seen[1].includes('INDEXED BY identity_invalid_native'),present);
 }
});

test('match deltas and participant-only changes use indexed pending keys, with zero writes on replay',async()=>{
 const {syncAcquiredSearch}=await import('../scripts/sync-acquired-player-search.mjs');
 const d=database({identityMapping:true,readChecks:true});try{
  d.execute("INSERT INTO matches(id,tournament_id,circuit,payload) VALUES('m','t','fitp','{}')");
  d.execute("INSERT INTO match_participants(match_id,participant_key,team_index,is_winner,display_name,normalized_name,source_player_id,nationality,payload) VALUES('m','p',0,0,'Test Player','test player','123456','ITA','{}')");
  const query=async sql=>{assert.doesNotMatch(sql,/FROM matches m LEFT JOIN search_match_indexed/);return d.query(sql)};
  assert.equal((await syncAcquiredSearch(query)).matchesProcessed,1);
  assert.equal(d.execute('SELECT COUNT(*) AS n FROM search_pending_matches')[0].n,0);
  const before=d.writes();assert.equal((await syncAcquiredSearch(query)).matchesProcessed,0);assert.equal(d.writes(),before);
  d.execute("UPDATE match_participants SET display_name='Corrected Player',normalized_name='corrected player' WHERE match_id='m'");
  assert.equal((await syncAcquiredSearch(query)).matchesProcessed,1);
  assert.equal(d.execute("SELECT display_name FROM search_acquired_players WHERE official_id='123456'")[0].display_name,'Corrected Player');
  const plan=d.execute('EXPLAIN QUERY PLAN SELECT m.id FROM search_pending_matches p CROSS JOIN matches m ON m.id=p.match_id ORDER BY p.match_id LIMIT 100').map(r=>r.detail).join('\n');assert.doesNotMatch(plan,/SCAN m\b/);
 }finally{d.close()}
});

test('failed match indexing retains pending revision; participant change during acknowledgement is processed again',async()=>{
 const {syncAcquiredSearch}=await import('../scripts/sync-acquired-player-search.mjs');
 const d=database({identityMapping:true,readChecks:true});try{
  d.execute("INSERT INTO matches(id,tournament_id,circuit,payload) VALUES('m','t','fitp','{}')");
  d.execute("INSERT INTO match_participants(match_id,participant_key,team_index,is_winner,display_name,normalized_name,source_player_id,nationality,payload) VALUES('m','p',0,0,'Test Player','test player','123456','ITA','{}')");
  await assert.rejects(syncAcquiredSearch(async sql=>{if(sql.includes('INSERT INTO search_acquired_players'))throw Error('failed write');return d.query(sql)}),/failed write/);
  assert.equal(d.execute('SELECT COUNT(*) AS n FROM search_pending_matches')[0].n,1);
  let changed=false;
  const result=await syncAcquiredSearch(async sql=>{
   if(!changed&&sql.startsWith('DELETE FROM search_pending_matches')){changed=true;d.execute("UPDATE match_participants SET display_name='Concurrent Player',normalized_name='concurrent player' WHERE match_id='m'")}
   return d.query(sql);
  });
  assert.equal(result.matchesProcessed,2);assert.equal(d.execute('SELECT COUNT(*) AS n FROM search_pending_matches')[0].n,0);
  assert.equal(d.execute("SELECT display_name FROM search_acquired_players WHERE official_id='123456'")[0].display_name,'Concurrent Player');
 }finally{d.close()}
});
