import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {RUNTIME_DOCUMENT_FILES,encodeDocument,decodeDocument,versionStatements,releasePlan} from '../lib/runtime-document-plan.mjs';
const fixture=()=>RUNTIME_DOCUMENT_FILES.map(path=>encodeDocument(path,{status:'fixture_complete',players:[{id:'p'}],tournaments:[{competitionId:'EXACT'}],value:'first'}));
test('D1_TEST_INITIAL_IMPORT / D1_TEST_IDENTICAL_ZERO_WRITES / D1_TEST_REAL_DELTAS_ONLY: actual SQLite keeps old versions and replays without writes',()=>{
 const first=fixture(),plan=releasePlan(first,'commit1');const changed=first.map((d,i)=>i===0?encodeDocument(d.path,{players:[{id:'p'}],value:'changed'}):d);
 const delta=releasePlan(changed,'commit2',plan.value);assert.equal(delta.changed,true);
 const replay=releasePlan(first,'different_source_same_content',plan.value);assert.equal(replay.changed,false);assert.deepEqual(replay.sql,[]);
 for(const doc of first)assert.deepEqual(versionStatements(doc,doc.chunks),[]);
 const statements=[...first.flatMap(d=>versionStatements(d,null)),...plan.sql,...changed.flatMap(d=>versionStatements(d,null)),...delta.sql];
 const py=`import sqlite3,json,sys\nx=sqlite3.connect(':memory:')\nx.execute('CREATE TABLE app_state(key TEXT PRIMARY KEY,value TEXT)')\nx.execute('CREATE TABLE runtime_document_chunks(path TEXT,content_hash TEXT,seq INTEGER,data TEXT,PRIMARY KEY(path,content_hash,seq)) WITHOUT ROWID')\nfor sql in json.load(sys.stdin):x.execute(sql)\nprint(json.dumps({'value':x.execute('SELECT value FROM app_state').fetchone()[0],'versions':x.execute('SELECT COUNT(*) FROM (SELECT DISTINCT path,content_hash FROM runtime_document_chunks)').fetchone()[0]}))`;
 const result=spawnSync('python3',['-c',py],{input:JSON.stringify(statements),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const saved=JSON.parse(result.stdout);assert.equal(saved.value,delta.value);assert.equal(saved.versions,first.length+1);
});
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: rejects partial scope, corrupt chunks and incomplete maps before publication',()=>{
 const docs=fixture();assert.throws(()=>releasePlan(docs.slice(1),'sha'),/scope_incomplete/);
 assert.throws(()=>releasePlan([...docs.slice(1),docs[1]],'sha'),/scope_incomplete/);
 const d=docs[0];assert.throws(()=>decodeDocument({...d,chunks:d.chunks.length},[]),/chunks_missing/);
 assert.throws(()=>versionStatements(d,['broken']));
 assert.throws(()=>encodeDocument('dist/v3/players.json',{players:[]}),/incomplete/);
 assert.throws(()=>encodeDocument('dist/v3/source_itf_tournaments.json',{tournaments:[{}],status:'incomplete'}),/incomplete/);
 assert.throws(()=>encodeDocument('../private.json',{}),/invalid/);
});
test('large compressed documents reconstruct every field exactly, including Unicode and embedded quotes',()=>{
 const data={message:"città d'Italia",payload:Array.from({length:10000},(_,i)=>({id:i,v:Math.sin(i).toString(36)}))};
 const d=encodeDocument('dist/v3/diagnostics.json',data);assert.ok(d.chunks.length>1);
 assert.deepEqual(decodeDocument({...d,chunks:d.chunks.length},d.chunks),data);
});
