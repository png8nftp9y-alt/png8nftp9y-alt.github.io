import test from 'node:test';import assert from 'node:assert/strict';
import {runtimeDocumentReader} from '../lib/runtime-document-reader.mjs';
import {RUNTIME_DOCUMENT_FILES,encodeDocument,releasePlan} from '../lib/runtime-document-plan.mjs';
function fixture({corrupt=false,incomplete=false,label='Saved club'}={}){
 const documents=RUNTIME_DOCUMENT_FILES.map(path=>encodeDocument(path,{status:'fixture_complete',players:[{id:'stored'}],tournaments:[{competitionId:'EXACT',venueName:label}]}));
 const plan=releasePlan(documents,'verified-source');let reads=0;
 return{documents,reads:()=>reads,db:{prepare(sql){reads++;return{first:async()=>incomplete?null:{value:plan.value},bind(path,hash){const d=documents.find(x=>x.path===path&&x.hash===hash);return{all:async()=>({results:d.chunks.map((data,seq)=>({seq,data:corrupt?'broken':data}))})}}}}}};
}
test('D1 reader pins one verified release and coalesces reads; HTTP and R2 are never consulted',async()=>{
 const f=fixture(),reader=runtimeDocumentReader(f.db),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('HTTP must never run')};
 try{const [a,b]=await Promise.all([reader.get('dist/v3/players.json'),reader.get('dist/v3/players.json')]);assert.equal(a,b);assert.equal(a.players[0].id,'stored');assert.equal(f.reads(),2);await reader.get('dist/v3/tournaments.json');assert.equal(f.reads(),3);}finally{globalThis.fetch=old;}
});
test('absent releases, absent documents and corrupt chunks fail instead of returning fabricated empty data',async()=>{
 await assert.rejects(runtimeDocumentReader(fixture({incomplete:true}).db).get('dist/v3/players.json'),/not_ready/);
 await assert.rejects(runtimeDocumentReader(fixture().db).get('private.json'),/not_published/);
 await assert.rejects(runtimeDocumentReader(fixture({corrupt:true}).db).get('dist/v3/players.json'));
});

test('public catalogue reuse reads the current release but skips unchanged chunks and isolates mutations',async()=>{
 const f=fixture({label:'cache-isolation'}),path='dist/v3/source_fitp_tournaments.json';
 const first=await runtimeDocumentReader(f.db).get(path);assert.equal(f.reads(),2);
 first.tournaments[0].venueName='request-local change';
 const next=await runtimeDocumentReader(f.db).get(path);
 assert.equal(f.reads(),3);assert.equal(next.tournaments[0].venueName,'cache-isolation');
 const changed=fixture({label:'newly published'});
 assert.equal((await runtimeDocumentReader(changed.db).get(path)).tournaments[0].venueName,'newly published');
 assert.equal(changed.reads(),2);
});
test('personal documents are never reused across requests and unavailable releases still fail',async()=>{
 const f=fixture({label:'private-isolation'}),path='dist/v3/players.json';
 await runtimeDocumentReader(f.db).get(path);await runtimeDocumentReader(f.db).get(path);
 assert.equal(f.reads(),4);
 await assert.rejects(runtimeDocumentReader(fixture({incomplete:true}).db).get('dist/v3/source_fitp_tournaments.json'),/not_ready/);
});
