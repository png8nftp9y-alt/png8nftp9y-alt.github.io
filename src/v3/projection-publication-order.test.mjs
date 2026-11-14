import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const start=source.indexOf('    let readyPublication = null, immediatePublication = null;');
assert.ok(start>=0);
const end=source.indexOf('\n  } catch (e) {',start);
assert.ok(end>start);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const execute=new AsyncFunction('apiProjection','v3json','publishProjection','state','console',
  'const preparedProjection=null, preparedDocuments=null; let lastLoadedDocuments={cached:true}; const names=["players","manual"], files=["players.json","manual_matches.json"];\n'+source.slice(start,end));
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(failFirst=false){
  const api=gate(),docs=gate(),calls=[],state={};let attempts=0;
  const done=execute(()=>api.promise,()=>docs.promise,(projection,documents,settled)=>{
    attempts++;if(failFirst&&attempts===1)throw Error('render failed');
    calls.push({projection,documents,settled});
  },state,{warn(){}});
  return {api,docs,calls,done,state,get attempts(){return attempts}};
}
test('documents first: publish fresh inputs once, preserving manual data',async()=>{
  const f=fixture(),document={matches:[{manual:true}]};
  f.docs.resolve(document);await flush();f.api.resolve({players:[]});await f.done;
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].documents.manual,document);
  assert.equal(f.calls[0].settled.length,2);assert.equal(f.state.completeProjectionVersion,1);
});
test('API first: immediate publication and later documents both remain',async()=>{
  const f=fixture();f.api.resolve({players:[]});await flush();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].documents.cached,true);
  const document={matches:[{manual:true}]};f.docs.resolve(document);await f.done;
  assert.equal(f.calls.length,2);assert.equal(f.calls[1].documents.manual,document);
});
test('API failure preserves document fallback',async()=>{
  const f=fixture();f.docs.resolve({players:[]});f.api.reject(Error('offline'));await f.done;
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].projection,null);
});
test('failed immediate publication does not suppress final publication',async()=>{
  const f=fixture(true);f.docs.resolve({players:[]});await flush();
  f.api.resolve({players:[]});await f.done;
  assert.equal(f.attempts,2);assert.equal(f.calls.length,1);
});
test('failed documents retain failure evidence with successful API',async()=>{
  const f=fixture();f.docs.reject(Error('offline'));await flush();
  f.api.resolve({players:[]});await f.done;
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].settled.filter(r=>r.status==='rejected').length,2);
});
