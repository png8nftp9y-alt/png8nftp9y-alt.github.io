import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
import {applyReviewedBirthYears} from '../lib/reviewed-player-birth.mjs';
import {enrichPlayerBirthMetadata} from '../lib/player-birth-metadata.mjs';
const evidence=JSON.parse(readFileSync(new URL('../data/reviewed-player-birth-years.json',import.meta.url),'utf8'));
function fixture(){
 const dir=mkdtempSync(path.join(tmpdir(),'birth-review-')),file=path.join(dir,'db.sqlite');let writes=0;
 const run=body=>{const r=spawnSync('python3',['-c',`import json,sqlite3,sys
p=json.load(sys.stdin);c=sqlite3.connect(p['file']);c.row_factory=sqlite3.Row
with c:
 if p.get('schema'):c.executescript(p['schema'])
 rows=[]
 if p.get('sql'):
  cur=c.execute(p['sql'],p.get('args',[]));rows=[dict(r) for r in cur.fetchall()] if cur.description else []
print(json.dumps({'rows':rows,'writes':c.total_changes}))`],{encoding:'utf8',input:JSON.stringify({file,...body})});assert.equal(r.status,0,r.stderr);const v=JSON.parse(r.stdout);writes+=v.writes;return v.rows;};
 run({schema:`CREATE TABLE app_players(id TEXT PRIMARY KEY,payload TEXT);
 CREATE TABLE user_app_players(user_id TEXT,courtwatch_id TEXT,created_at TEXT);
 CREATE TABLE user_app_other_players(user_id TEXT,courtwatch_id TEXT,created_at TEXT);
 CREATE TABLE user_app_player_removals(user_id TEXT,courtwatch_id TEXT,removed_at TEXT);
 CREATE TABLE user_app_player_additions(user_id TEXT,courtwatch_id TEXT,payload TEXT);
 CREATE TABLE player_identity_aliases(alias_id TEXT PRIMARY KEY,canonical_id TEXT);
 CREATE TABLE player_identity_people(canonical_id TEXT PRIMARY KEY,payload TEXT);`+readFileSync(new URL('../migrations/0048_observed_player_birth_metadata.sql',import.meta.url),'utf8')});
 const execute=(sql,args=[])=>run({sql,args}),query=async(sql,args=[])=>execute(sql,args);
 for(const [i,p] of evidence.players.entries()){
  execute('INSERT INTO app_players VALUES(?,?)',[p.id,JSON.stringify({id:p.id,name:p.name,circuitProfiles:[{url:p.identityProfile}]})]);
  execute('INSERT INTO '+(i%2?'user_app_other_players':'user_app_players')+' VALUES(?,?,?)',['owner',p.id,'2026-01-01']);
  execute('INSERT INTO player_identity_people VALUES(?,?)',[p.canonicalId,'{}']);
 }
 const DB={prepare(sql){return{bind(...args){return{all:async()=>({results:await query(sql,args)})}}}}};
 return{execute,query,DB,writes:()=>writes,close:()=>rmSync(dir,{recursive:true,force:true})};
}
test('D1_TEST_INITIAL_IMPORT D1_TEST_IDENTICAL_ZERO_WRITES: reviewed and owner-confirmed years in both lists persist with source, runtime readback, and zero-write replay',async()=>{
 const d=fixture();try{const first=await applyReviewedBirthYears({query:d.query,evidence,userId:'owner'});assert.equal(first.selected,evidence.players.length);assert.equal(first.writes,evidence.players.length);
 const people=evidence.players.map(p=>({id:p.id}));await enrichPlayerBirthMetadata(d.DB,people);
 for(const p of people){assert.equal(p.birthYear,evidence.players.find(r=>r.id===p.id).birthYear);assert.equal(p.birthDate,undefined);}
 const before=d.writes(),again=await applyReviewedBirthYears({query:d.query,evidence,userId:'owner',now:()=> '2027-01-01'});assert.equal(again.writes,0);assert.equal(d.writes(),before);
 assert.equal(d.execute('SELECT count(*) AS n FROM player_birth_metadata WHERE source_url LIKE ?', ['https://%'])[0].n,evidence.players.length);
 }finally{d.close();}
});
test('D1_TEST_REAL_DELTAS_ONLY: changed evidence URL updates exactly one row and never rewrites unrelated sources',async()=>{
 const d=fixture();try{await applyReviewedBirthYears({query:d.query,evidence,userId:'owner'});const next=structuredClone(evidence);next.players[0].sourceUrl+='?verified=1';
 assert.equal((await applyReviewedBirthYears({query:d.query,evidence:next,userId:'owner'})).writes,1);
 assert.equal(d.execute('SELECT count(*) AS n FROM player_birth_metadata')[0].n,evidence.players.length);
 }finally{d.close();}
});
test('removed memberships and another account are excluded while Others membership remains eligible',async()=>{
 const d=fixture();try{const p=evidence.players[0];d.execute('DELETE FROM user_app_players WHERE courtwatch_id=?',[p.id]);d.execute('INSERT INTO user_app_players VALUES(?,?,?)',['another',p.id,'now']);
 assert.equal((await applyReviewedBirthYears({query:d.query,evidence,userId:'owner'})).selected,evidence.players.length-1);
 d.execute('INSERT INTO user_app_other_players VALUES(?,?,?)',['owner',p.id,'now']);assert.equal((await applyReviewedBirthYears({query:d.query,evidence,userId:'owner'})).writes,1);
 }finally{d.close();}
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: missing sources, changed name or exact profile stop before any write',async()=>{
 for(const mutate of [e=>{delete e.players[0].sourceUrl;},e=>{e.players[0].name='Different Player';},e=>{e.players[0].identityProfile='https://www.fitp.it/wrong';}]){
 const d=fixture();try{const e=structuredClone(evidence);mutate(e);const before=d.writes();await assert.rejects(applyReviewedBirthYears({query:d.query,evidence:e,userId:'owner'}),/reviewed_birth_/);assert.equal(d.writes(),before);}finally{d.close();}
 }
});
test('existing different year or canonical identity change never gets overwritten',async()=>{
 for(const mode of ['year','alias']){const d=fixture();try{const p=evidence.players[0];
 if(mode==='year')d.execute("INSERT INTO player_birth_metadata(source_key,canonical_id,circuit,birth_year,status,checked_at) VALUES(?,?,?,?,?,?)",['existing',p.canonicalId,'itf',1990,'year_only','now']);
 else d.execute('INSERT INTO player_identity_aliases VALUES(?,?)',[p.id,'different-person']);
 const before=d.writes();await assert.rejects(applyReviewedBirthYears({query:d.query,evidence,userId:'owner'}),/reviewed_birth_(conflict|identity_changed)/);assert.equal(d.writes(),before);
 }finally{d.close();}}
});
test('unresolved records are never imported and evidence persists year only',()=>{
 assert.equal(evidence.players.length,23);assert.equal(evidence.unresolved.length,0);
 assert.ok(!evidence.players.some(p=>evidence.unresolved.some(u=>u.id===p.id)));
 for(const p of evidence.players){assert.equal(typeof p.birthYear,'number');assert.equal(p.birthDate,undefined);assert.equal(p.dateOfBirth,undefined);}
});
