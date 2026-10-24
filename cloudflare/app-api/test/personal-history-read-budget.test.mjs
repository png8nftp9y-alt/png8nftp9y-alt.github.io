import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {personalCircuitHistory} from '../lib/personal-tennis-europe-history.mjs';
import {personalUnreleasedTournamentHistory} from '../lib/personal-unreleased-tournaments.mjs';

// Actual runtime statements, with an empty result so capture needs no network.
async function statements() {
 const calls=[];
 const db={prepare(sql){return {bind(...values){return {all:async()=>{calls.push({sql,values});return {results:[]}}}}}}};
 const native='12345678-1234-1234-1234-123456789abc';
 await personalCircuitHistory(db,{id:'test',name:'Case Player',sourceCircuit:'tennis-europe',profileSync:{tennisEurope:{profileId:native}}});
 await personalUnreleasedTournamentHistory(db,[{id:'test',sourceCircuit:'itf',sourcePlayerId:'800000001'}]);
 return {calls,native};
}
const python=`import sqlite3,json,sys
x=json.load(sys.stdin);d=sqlite3.connect(':memory:');d.row_factory=sqlite3.Row
d.executescript(x['schema'])
for i in range(12000):
 mid='m'+str(i).zfill(5);circuit='tennis-europe' if i%2==0 else 'itf';own=i%50 in (0,1)
 native=x['native'] if circuit=='tennis-europe' else '800000001'
 d.execute('INSERT OR IGNORE INTO tournaments(id,circuit,source_tournament_id,payload) VALUES(?,?,?,?)',('t'+str(i%8),circuit,'T'+str(i%8),'{}'))
 d.execute('INSERT INTO matches(id,tournament_id,circuit,played_date,payload) VALUES(?,?,?,?,?)',(mid,'t'+str(i%8),circuit,'2026-01-01','{}'))
 d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',(mid,'self',native if own else 'other'+str(i),'Case Player' if own else 'Other Player','case player' if own else 'other player','SUI',0,1,'{}'))
 d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',(mid,'opponent','opponent'+str(i),'Opponent Player','opponent player','ITA',1,0,'{}'))
# Model the deployed schema before and after the migration, without synthetic planner statistics.
out=[]
for case in x['cases']:
 pair=[]
 for mode,query in enumerate([case['before'],case['after']]):
  d.executescript('DROP INDEX IF EXISTS match_participants_source_match;DROP INDEX IF EXISTS match_participants_name_match_key;')
  if mode:d.executescript(x['indexes'])
  ticks=[0]
  def count():ticks[0]+=1;return 0
  d.set_progress_handler(count,100)
  rows=[dict(r) for r in d.execute(query['sql'],query['values'])]
  d.set_progress_handler(None,0)
  plan=[r['detail'] for r in d.execute('EXPLAIN QUERY PLAN '+query['sql'],query['values'])]
  pair.append({'rows':rows,'steps':ticks[0]*100,'plan':plan})
 out.append(pair)
print(json.dumps(out))
`;
test('three costly history queries preserve exact rows and seek player indexes on a large SQLite fixture',async()=>{
 const {calls,native}=await statements();
 const aliases=calls.find(c=>c.sql.includes('p.normalized_name IN'));
 const history=calls.find(c=>c.sql.includes('candidate_matches'));
 const tournaments=calls.find(c=>c.sql.includes('WITH links AS'));
 assert.ok(aliases&&history&&tournaments);
 // Include alias/native overlap and a local alias not present in the native ID.
 const aliasIds=JSON.stringify(['m00000','m00002']);
 history.values[2]=aliasIds;
 const cases=[
  {before:{...aliases,sql:aliases.sql.replace('CROSS JOIN matches','JOIN matches').replace('+p.match_id','p.match_id')},after:aliases},
  {before:{sql:`SELECT DISTINCT m.id AS match_id,m.tournament_id,m.played_date,m.payload AS match_payload,t.payload AS tournament_payload,t.source_tournament_id FROM match_participants self JOIN matches m ON m.id=self.match_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE (self.source_player_id=? OR self.match_id IN (SELECT value FROM json_each(?))) AND m.circuit=? AND m.id>? ORDER BY m.id LIMIT 250`,values:[native,aliasIds,'tennis-europe','']},after:history},
  {before:{...tournaments,sql:tournaments.sql.replaceAll('CROSS JOIN','JOIN')},after:tournaments}
 ];
 const schema=['0001_universal_schema.sql','0006_tennis_europe_oop.sql','0017_tennis_europe_ranking_history.sql','0021_tennis_europe_identity_indexes.sql','0031_player_history_lookup_index.sql','0038_itf_match_projection_lookup.sql'].map(n=>readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8')).join('\n');
 const r=spawnSync('python3',['-c',python],{input:JSON.stringify({schema,native,cases,indexes:readFileSync(new URL('../migrations/0040_personal_history_read_indexes.sql',import.meta.url),'utf8')}),encoding:'utf8',maxBuffer:4*1024*1024});
 assert.equal(r.status,0,r.stderr);
 const results=JSON.parse(r.stdout);
 for(const [index,[before,after]] of results.entries()){
  const sorted=rows=>rows.map(row=>JSON.stringify(row)).sort();
  assert.deepEqual(sorted(after.rows),sorted(before.rows),`query ${index+1} parity`);
  assert.ok(after.plan.some(p=>/SEARCH (?:p|match_participants) USING (?:COVERING )?INDEX match_participants_(?:source_match|name_match_key|name)/.test(p)),after.plan.join('\n'));
  assert.ok(!after.plan.some(p=>/SCAN (?:m|p|self)(?:$| )/.test(p)),after.plan.join('\n'));
  console.log(`D1_HISTORY_FIXTURE query=${index+1} rows=${after.rows.length} old_steps=${before.steps} new_steps=${after.steps}`);
 }
 assert.ok(results.every(([before,after])=>after.steps<before.steps/5),'production circuit/tournament index must not turn player history into broad traversal');
});

import {database} from './search-sqlite-fixture.mjs';
test('native-ID history skips redundant canonical alias reads and loads participant pages with bounded concurrency', {timeout:5000}, async()=>{
 const d=database({identityMapping:true});
 try{
  const native='12345678-1234-1234-1234-123456789abc',player={id:'cw-native',name:'Case Player',sourceCircuit:'tennis-europe',profileSync:{tennisEurope:{profileId:native}}};
  const statements=["INSERT INTO tournaments VALUES('t','tennis-europe','t','2026-01-01','2026-01-01','{}');"];
  for(let i=0;i<100;i++){
   const id='m'+String(i).padStart(3,'0');
   statements.push(`INSERT INTO matches VALUES('${id}','t','tennis-europe','2026-01-01','{"event":"BS14","score":"6-1 6-2"}');`);
   statements.push(`INSERT INTO match_participants VALUES('${id}','self','${native}','Case Player','case player','ITA',0,1,'{}');`);
   statements.push(`INSERT INTO match_participants VALUES('${id}','other','other','Other Player','other player','ITA',1,0,'{}');`);
  }
  await d.query(statements.join('\n'));
  let aliasLookups=0,active=0,maximum=0;const releases=[];
  function wrap(s,sql){return new Proxy(s,{get(t,k){const v=t[k];if(k==='bind')return(...args)=>wrap(v.apply(t,args),sql);
   if(k==='all')return async(...args)=>{
    if(sql.includes('WITH requested AS'))aliasLookups++;
    if(sql.includes('FROM match_participants WHERE match_id IN')){
     active++;maximum=Math.max(maximum,active);
     return new Promise((resolve,reject)=>{releases.push(()=>Promise.resolve(v.apply(t,args)).then(resolve,reject).finally(()=>active--));if(releases.length===3)for(const release of releases)release()});
    }return v.apply(t,args);
   };return typeof v==='function'?v.bind(t):v;}})}
  const db={prepare:sql=>wrap(d.db.prepare(sql),sql)},before=d.writes();
  const result=await personalCircuitHistory(db,player);
  assert.equal(result.matches.length,100);assert.equal(result.tournaments.length,1);
  assert.deepEqual(result.matches.map(m=>m.matchId),Array.from({length:100},(_,i)=>'m'+String(i).padStart(3,'0')));
  assert.ok(result.matches.every(m=>m.advances&&m.score==='6-1 6-2'));
  assert.equal(aliasLookups,0);assert.equal(maximum,3);assert.ok(maximum<=4);assert.equal(d.writes(),before);
 }finally{d.close()}
});

test('native history starts before slow alias verification ends without a duplicate read',async()=>{
 let releaseAliases,releaseHistory,aliasReads=0,historyReads=0;
 const db={prepare(sql){return {bind(){return {all(){
  if(sql.includes('p.normalized_name IN')){aliasReads++;return new Promise(r=>releaseAliases=()=>r({results:[]}));}
  if(sql.includes('candidate_matches')){historyReads++;return new Promise(r=>releaseHistory=()=>r({results:[]}));}
  throw Error('Unexpected query: '+sql);
 }}}}}};
 const pending=personalCircuitHistory(db,{id:'test',name:'Case Player',sourceCircuit:'tennis-europe',profileSync:{tennisEurope:{profileId:'12345678-1234-1234-1234-123456789abc'}}});
 await new Promise(r=>setImmediate(r));assert.equal(aliasReads,1);assert.equal(historyReads,1);
 releaseHistory();releaseAliases();const result=await pending;assert.deepEqual(result.matches,[]);assert.equal(historyReads,1);
});
