import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {exactCurrentRankingRows} from '../lib/exact-current-ranking.mjs';
import {opponentEuropeSources} from '../lib/opponent-europe-sources.mjs';
import {tennisEuropeNativeId} from '../lib/opponent-linked-identity.mjs';
import {otherCircuitOpponentHistory} from '../lib/opponent-canonical-history.mjs';

async function capture(){
 const calls=[],db={prepare(sql){return{bind(...values){return{all:async()=>{calls.push({sql,values});return{results:[]}}}}}}};
 await exactCurrentRankingRows(db,{name:'Ivona Dirnbek'});
 const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 const context={opponentEuropeSources,tennisEuropeNativeId,normalizeTennisEuropeName:n=>n.toLowerCase(),tennisEuropeNameKey:n=>n.toLowerCase().split(' ').sort().join(' '),tennisEuropeNameVariants:n=>[n,n.split(' ').reverse().join(' ')],optionalRows:async statement=>(await statement.all()).results};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('async function tennisEuropeOpponentHistory('),source.indexOf('async function universalOpponentHistory(')),context);
 await context.tennisEuropeOpponentHistory({DB:db},{name:'Ivona Dirnbek',asOf:'2026-10-14'});
 await otherCircuitOpponentHistory(db,{name:'Ivona Dirnbek',asOf:'2026-10-14'});
 await otherCircuitOpponentHistory(db,{name:'Ivona Dirnbek',asOf:'2026-10-14',identity:{sourceCircuit:'itf',sourcePlayerId:'800000001',membershipCard:'123456'}});
 return calls;
}

test('actual opponent queries seek names/native IDs and preserve rows on a large multi-circuit database',async()=>{
 const calls=await capture(),rank=calls[0],histories=calls.filter(c=>c.sql.includes('FROM match_participants self')||c.sql.includes('WITH candidate_matches'));
 assert.equal(histories.length,3);
 assert.ok(!rank.sql.includes('LIKE'));
 const cases=histories.map(after=>({after,before:{...after,sql:after.sql.replaceAll('CROSS JOIN','JOIN').replaceAll('m.id=+self.match_id','m.id=self.match_id')}}));
 const schema=['0001_universal_schema.sql','0006_tennis_europe_oop.sql','0017_tennis_europe_ranking_history.sql','0021_tennis_europe_identity_indexes.sql','0038_itf_match_projection_lookup.sql','0040_personal_history_read_indexes.sql'].map(n=>readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8')).join('\n');
 const python=`import sqlite3,json,sys
x=json.load(sys.stdin);d=sqlite3.connect(':memory:');d.row_factory=sqlite3.Row;d.executescript(x['schema'])
for i in range(18000):
 circuit=['tennis-europe','itf','fitp'][i%3];mid='m'+str(i).zfill(6);tid='t'+str(i%9);own=i%1000 in (0,1,2)
 payload=json.dumps({'startDate':'2026-09-01','endDate':'2026-09-07'})
 d.execute('INSERT OR IGNORE INTO tournaments VALUES(?,?,?,?,?,?)',(tid,circuit,tid,'2026-09-01','2026-09-07',payload))
 d.execute('INSERT INTO matches VALUES(?,?,?,?,?)',(mid,tid,circuit,'2026-09-02','{}'))
 native='800000001' if circuit=='itf' else '123456' if circuit=='fitp' else 'native-te'
 d.execute('INSERT INTO match_participants VALUES(?,?,?,?,?,?,?,?,?)',(mid,'self',native if own else 'other'+str(i),'Ivona Dirnbek' if own else 'Other Player','ivona dirnbek' if own else 'other player','SLO',0,1,'{}'))
 d.execute('INSERT INTO tennis_europe_ranking_history(profile_id,ranking_date,publication_id,week_label,category,ranking,display_name,normalized_name,source_url,captured_at) VALUES(?,?,?,?,?,?,?,?,?,?)',('p'+str(i),'2026-10-13','pub','week','G14',i+1,'Other '+str(i),'other '+str(i),'https://example.test','2026-10-13'))
d.execute('INSERT INTO tennis_europe_ranking_history(profile_id,ranking_date,publication_id,week_label,category,ranking,display_name,normalized_name,source_url,captured_at) VALUES(?,?,?,?,?,?,?,?,?,?)',('target','2026-10-13','pub','week','G14',388,'Ivona Dirnbek','dirnbek ivona','https://example.test','2026-10-13'))
def run(q):
 ticks=[0]
 def count():ticks[0]+=1;return 0
 d.set_progress_handler(count,100)
 rows=[dict(r) for r in d.execute(q['sql'],q['values'])];d.set_progress_handler(None,0)
 return {'rows':rows,'steps':ticks[0]*100,'plan':[r['detail'] for r in d.execute('EXPLAIN QUERY PLAN '+q['sql'],q['values'])]}
oldRank={'sql':'SELECT category,ranking,ranking_date,profile_id,normalized_name FROM tennis_europe_ranking_history WHERE normalized_name LIKE ? ORDER BY ranking_date DESC LIMIT 250','values':['%dirnbek%']}
out={'oldRank':run(oldRank),'rank':run(x['rank']),'histories':[[run(c['before']),run(c['after'])] for c in x['cases']]}
print(json.dumps(out))`;
 const result=spawnSync('python3',['-c',python],{input:JSON.stringify({schema,rank,cases}),encoding:'utf8',maxBuffer:4*1024*1024});
 assert.equal(result.status,0,result.stderr);const data=JSON.parse(result.stdout);
 assert.deepEqual(data.rank.rows.map(r=>r.profile_id),['target']);
 assert.deepEqual(data.rank.rows,data.oldRank.rows.map(r=>({...r,nationality:null})));
 assert.ok(data.rank.steps<data.oldRank.steps/5);
 console.log('OPPONENT_RANK_FIXTURE '+JSON.stringify({beforeSteps:data.oldRank.steps,afterSteps:data.rank.steps}));
 assert.ok(data.rank.plan.some(p=>p.includes('SEARCH tennis_europe_ranking_history USING INDEX te_ranking_name_date')),data.rank.plan.join('\n'));
 for(const [index,[before,after]] of data.histories.entries()){
  const sorted=rows=>rows.map(r=>JSON.stringify(r)).sort();
  assert.deepEqual(sorted(after.rows),sorted(before.rows));
  assert.ok(after.rows.length>0);
  assert.ok(after.plan.some(p=>/SEARCH (?:self|match_participants) USING (?:COVERING )?INDEX match_participants_(?:name|source)/.test(p)),after.plan.join('\n'));
  assert.ok(!after.plan.some(p=>/SCAN (?:m|self)(?:$| )/.test(p)),after.plan.join('\n'));
  assert.ok(index===0?after.steps<=before.steps*2:after.steps<before.steps/5,JSON.stringify({index,before:before.steps,after:after.steps}));
  console.log('OPPONENT_READ_FIXTURE '+JSON.stringify({case:index+1,rows:after.rows.length,beforeSteps:before.steps,afterSteps:after.steps}));
 }
});
