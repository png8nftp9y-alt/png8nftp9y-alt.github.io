import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
import {inspectObservedEuropeHistory} from '../lib/observed-europe-history-audit.mjs';import {readObservedEuropeEvidence} from '../lib/europe-draw-evidence.mjs';
const source=fs.readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const draw={playerId:'p',circuit:'tennis-europe',competitionId:'X',name:'Event',drawConfirmed:true,entryStatus:'official_draw'};
function snapshots(){return {main:{group:'main',players:[{id:'p',name:'Player'}],tournaments:[],matches:[],europeDrawEvidence:[draw]},others:{group:'others',players:[{id:'o',name:'Other'}],tournaments:[],matches:[],europeDrawEvidence:[{...draw,playerId:'o',competitionId:'Y'}]}};}
test('audits every TCL/Altri presence and distinguishes match-backed visibility from a lost confirmation',()=>{
 const s=snapshots();let r=inspectObservedEuropeHistory(s,[],source);assert.equal(r.missingCount,2);assert.equal(r.lostConfirmationCount,2);
 s.main.matches=[{...draw,id:'match'}];r=inspectObservedEuropeHistory(s,[],source);assert.equal(r.missingCount,1);assert.equal(r.lostConfirmationCount,2);assert.equal(r.lostConfirmations[0].visibleViaMatches,true);
 s.main.tournaments=[draw];s.others.tournaments=[{...draw,playerId:'o',competitionId:'Y'}];assert.equal(inspectObservedEuropeHistory(s,[],source).status,'complete');
});
test('agenda-only matches and other players never cover a missing profile; incomplete groups fail closed',()=>{
 const s=snapshots();s.main.matches=[{...draw,agendaOnly:true},{...draw,playerId:'not-observed'}];assert.equal(inspectObservedEuropeHistory(s,[],source).missingCount,2);
 delete s.others;assert.throws(()=>inspectObservedEuropeHistory(s,[],source),/incomplete/);
});
test('identity failures cannot produce a green empty report',()=>{
 const s=snapshots();s.main.players[0].sourceCircuit='tennis-europe';assert.equal(inspectObservedEuropeHistory(s,[],source).unverified.length,1);
});
test('indexed native evidence accepts case variants and excludes namesakes and another circuit',async()=>{
 const native='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';let calls=0;
 const db={prepare(sql){return {bind(param){return {all:async()=>{calls++;const py=`import json,sqlite3,sys
x=json.load(sys.stdin);d=sqlite3.connect(':memory:');d.row_factory=sqlite3.Row
d.executescript("CREATE TABLE match_participants(match_id TEXT,source_player_id TEXT);CREATE INDEX native ON match_participants(source_player_id);CREATE TABLE matches(id TEXT PRIMARY KEY,tournament_id TEXT,circuit TEXT);CREATE TABLE tournaments(id TEXT PRIMARY KEY,source_tournament_id TEXT,payload TEXT);")
for i,n,c in [('1','AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE','tennis-europe'),('2','foreign','tennis-europe'),('3','aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee','itf')]:
 d.execute('INSERT INTO match_participants VALUES(?,?)',(i,n));d.execute('INSERT INTO matches VALUES(?,?,?)',(i,i,c));d.execute('INSERT INTO tournaments VALUES(?,?,?)',(i,'C'+i,json.dumps({'name':'Event '+i})))
print(json.dumps([dict(r) for r in d.execute(x['sql'],[x['param']])]))`;const run=spawnSync('python3',['-c',py],{input:JSON.stringify({sql,param}),encoding:'utf8'});assert.equal(run.status,0,run.stderr);return {results:JSON.parse(run.stdout)};}}}}}};
 const rows=await readObservedEuropeEvidence(db,[{id:'owned',name:'Player',profileSync:{tennisEurope:{profileId:native}}}]);assert.equal(calls,1);assert.equal(rows.length,1);assert.equal(rows[0].competitionId,'C1');assert.equal(rows[0].playerId,'owned');
});
test('old UI and corrected UI produce different findings for a confirmed but withdrawn Europe row',()=>{
 const s=snapshots();s.main.tournaments=[{...draw,status:'withdrawn',acceptanceCode:'W'}];s.others.tournaments=[{...draw,playerId:'o',competitionId:'Y'}];
 const old=fs.readFileSync(new URL('../fixtures/europe-profile-eligibility-before-permanent.js',import.meta.url),'utf8');
 assert.equal(inspectObservedEuropeHistory(s,[],old).missingCount,1);
 assert.equal(inspectObservedEuropeHistory(s,[],source).missingCount,0);
});
