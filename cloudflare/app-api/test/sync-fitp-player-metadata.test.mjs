import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {syncFitpMetadata,metadataPlan,metadataWriteSql,inventorySql} from '../scripts/sync-fitp-player-metadata.mjs';
const source=[{membership_card:'123456',canonical_id:'p1',club:'Club One',ranking:'2.7'},{membership_card:'222222',canonical_id:'p2',club:'Club Two',ranking:'4.NC'}];
async function setup(fn){const d=database({identityMapping:true});try{
 await d.query(readFileSync(new URL('../migrations/0041_fitp_metadata_engine.sql',import.meta.url),'utf8'));
 for(const r of source)d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',['fitp|'+r.membership_card,r.canonical_id,'same','fitp',r.membership_card,'SAME','Same']);
 const calls=[],writes=[];const ctx={query:async(sql,params=[])=>d.execute(sql,params),write:async(sql,params=[])=>{writes.push(sql);return d.execute(sql,params)},fetchProfile:async card=>{calls.push(card);return source.find(r=>r.membership_card===card)},now:()=>Date.UTC(2026,9,18),log:()=>{},batchSize:1};
 await fn(d,ctx,calls,writes);
 }finally{d.close()}}
test('D1_TEST_INITIAL_IMPORT: all exact FITP identities are acquired and stored with checkpoint',()=>setup(async(d,ctx,calls)=>{
 await syncFitpMetadata(ctx);assert.deepEqual(calls,['123456','222222']);assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_player_metadata')[0].n,2);
 const before=d.writes();await syncFitpMetadata(ctx);assert.equal(d.writes(),before);assert.equal(calls.length,2);
}));
test('D1_TEST_IDENTICAL_ZERO_WRITES: next 21-day cycle checks sources without rewriting metadata',()=>setup(async(d,ctx,calls,writes)=>{
 await syncFitpMetadata(ctx);writes.length=0;await syncFitpMetadata({...ctx,now:()=>Date.UTC(2026,10,8)});
 assert.equal(calls.length,4);assert.equal(writes.filter(s=>s===metadataWriteSql).length,0);
 assert.equal(d.execute('SELECT updated_at FROM fitp_player_metadata LIMIT 1')[0].updated_at,'2026-10-18T00:00:00.000Z');
}));
test('D1_TEST_REAL_DELTAS_ONLY: one changed field updates only its identity, blanks preserve good data',()=>setup(async(d,ctx)=>{
 await syncFitpMetadata(ctx);await syncFitpMetadata({...ctx,now:()=>Date.UTC(2026,10,8),fetchProfile:async card=>({...source.find(r=>r.membership_card===card),...(card==='123456'?{club:'New Club',ranking:''}:{})})});
 const row=d.execute('SELECT * FROM fitp_player_metadata WHERE membership_card=?',['123456'])[0];assert.equal(row.club,'New Club');assert.equal(row.ranking,'2.7');
 assert.equal(d.execute('SELECT updated_at FROM fitp_player_metadata WHERE membership_card=?',['222222'])[0].updated_at,'2026-10-18T00:00:00.000Z');
}));
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: outage preserves data and cursor; explicit normal resume clears interrupted failures',()=>setup(async(d,ctx)=>{
 await syncFitpMetadata(ctx);const next={...ctx,now:()=>Date.UTC(2026,10,8)};
 await assert.rejects(syncFitpMetadata({...next,fetchProfile:async()=>{throw Error('HTTP 503')}}),/resume_manually/);
 assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_player_metadata')[0].n,2);
 assert.equal(d.execute("SELECT COUNT(*) AS n FROM fitp_metadata_progress WHERE cycle='2026-11-08'")[0].n,0);
 await syncFitpMetadata(next);assert.equal(d.execute("SELECT complete FROM fitp_metadata_progress WHERE cycle='2026-11-08'")[0].complete,1);
 assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_metadata_failures')[0].n,0);
}));
test('isolated errors do not stop the census; manual retry visits only failed cards',()=>setup(async(d,ctx,calls)=>{
 await assert.rejects(syncFitpMetadata({...ctx,batchSize:2,fetchProfile:async card=>{calls.push(card);if(card==='123456')throw Error('HTTP 503');return source[1]}}),/retry_failures_manually/);
 assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_player_metadata')[0].n,1);assert.equal(d.execute('SELECT membership_card FROM fitp_metadata_failures')[0].membership_card,'123456');
 assert.equal(d.execute('SELECT complete FROM fitp_metadata_progress')[0].complete,1);
 // Re-running without the explicit option must not turn a failed cycle green.
 await assert.rejects(syncFitpMetadata(ctx),/retry_failures_manually/);
 calls.length=0;await syncFitpMetadata({...ctx,retryFailures:true});assert.deepEqual(calls,['123456']);assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_metadata_failures')[0].n,0);
 assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_player_metadata')[0].n,2);
}));
test('ambiguous IDs are excluded and aliases resolving to one canonical person remain eligible',()=>setup(async(d,ctx,calls)=>{
 d.execute("INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES('conflict','other','same','fitp','123456','SAME','Same')");
 await syncFitpMetadata(ctx);assert.deepEqual(calls,['222222']);
}));
test('mismatched source cards do not attach; incomplete metadata does not erase records',()=>setup(async(d,ctx)=>{
 await assert.rejects(syncFitpMetadata({...ctx,fetchProfile:async()=>({...source[0],membership_card:'999999'})}),/resume_manually/);
 assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_player_metadata')[0].n,0);
 assert.equal(metadataPlan(source,source).writes,0);assert.equal(metadataPlan(source,[{...source[0],club:'',ranking:''}]).writes,0);
 assert.throws(()=>metadataPlan([],[{membership_card:'123456',club:'Club'}]),/incomplete_identity/);
}));
test('inventory uses the circuit and official-ID index, without OFFSET or repeated source scans',()=>setup(async(d)=>{
 const plan=d.execute('EXPLAIN QUERY PLAN '+inventorySql,['123456',100]).map(r=>r.detail).join('\n');assert.match(plan,/SEARCH l USING INDEX player_circuit_identity_official/);assert.doesNotMatch(plan,/SCAN l\b/);
}));

test('D1 write failure never advances persisted cursor; explicit resume replays only interrupted batch',()=>setup(async(d,ctx,calls)=>{
 const write=ctx.write;let failed=false;
 await assert.rejects(syncFitpMetadata({...ctx,write:async(sql,params)=>{if(sql===metadataWriteSql&&params[1].includes('222222')){failed=true;throw Error('fitp_d1_http_500:codes_7500');}return write(sql,params)}}),/codes_7500/);
 assert.ok(failed);assert.equal(d.execute('SELECT last_card FROM fitp_metadata_progress')[0].last_card,'123456');
 assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_player_metadata')[0].n,1);
 calls.length=0;await syncFitpMetadata(ctx);assert.deepEqual(calls,['222222']);assert.equal(d.execute('SELECT complete FROM fitp_metadata_progress')[0].complete,1);
}));

test('FITP D1 transport reports numeric Cloudflare codes without leaking body or retrying',async()=>{
 const {openD1}=await import('../scripts/sync-fitp-player-metadata.mjs');
 const oldAccount=process.env.CLOUDFLARE_ACCOUNT_ID,oldToken=process.env.CLOUDFLARE_API_TOKEN;
 process.env.CLOUDFLARE_ACCOUNT_ID='fixture';process.env.CLOUDFLARE_API_TOKEN='secret-token';
 try{for(const json of [async()=>({success:false,errors:[{code:7500,message:'SECRET SQL'}]}),async()=>{throw Error('private response')}]){
  let calls=0;await assert.rejects(openD1({fetcher:async()=>{calls++;return{ok:false,status:500,json}}}),error=>{assert.match(error.message,/fitp_d1_http_500:codes_(7500|none)$/);assert.doesNotMatch(error.message,/SECRET|private|secret-token/);return true});assert.equal(calls,1);
 }}finally{if(oldAccount===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=oldAccount;if(oldToken===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=oldToken;}
});

const realBatch=d=>statements=>d.db.batch(statements.map(({sql,params})=>({sql,values:params})));
test('checkpoint is sent only after every data write succeeds; failed cursor resumes without rewriting saved metadata',()=>setup(async(d,ctx,calls)=>{
 const logs=[],batches=[];let rejected=false;
 const writeBatch=async statements=>{
  batches.push(statements);
  const checkpoint=statements.find(s=>s.sql.includes('INSERT INTO fitp_metadata_progress'));
  if(checkpoint?.params[1]==='222222'&&!rejected){rejected=true;throw Error('fitp_d1_timeout:phase_batch:request_outcome_unknown_resume_manually');}
  return realBatch(d)(statements);
 };
 await assert.rejects(syncFitpMetadata({...ctx,writeBatch,log:line=>logs.push(JSON.parse(line))}),/timeout/);
 assert.equal(d.execute('SELECT last_card FROM fitp_metadata_progress')[0].last_card,'123456');
 assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_player_metadata')[0].n,2);
 assert.equal(logs.at(-1).lastConfirmedCheckpoint.checked,1);assert.equal(logs.at(-1).attemptedThrough,'222222');
 assert.ok(batches.filter(batch=>batch.some(s=>s.sql.includes('INSERT INTO fitp_metadata_progress'))).every(batch=>batch.length===1));
 calls.length=0;const replay=[];await syncFitpMetadata({...ctx,writeBatch:async statements=>{replay.push(...statements);return realBatch(d)(statements)}});assert.deepEqual(calls,['222222']);
 assert.equal(replay.filter(s=>s.sql===metadataWriteSql).length,0);
 assert.equal(d.execute('SELECT complete FROM fitp_metadata_progress')[0].complete,1);
}));
test('partially committed REST data batch cannot advance cursor; explicit resume writes only the missing delta',()=>setup(async(d,ctx,calls)=>{
 await assert.rejects(syncFitpMetadata({...ctx,batchSize:2,writeBatch:async statements=>{
  // Model an API failure after metadata was committed but before cleanup. No atomic REST guarantee is needed.
  const first=statements[0];assert.equal(first.sql,metadataWriteSql);await ctx.write(first.sql,first.params);throw Error('fitp_d1_http_500:codes_7500');
 }}),/7500/);
 assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_metadata_progress')[0].n,0);
 calls.length=0;const replay=[];await syncFitpMetadata({...ctx,batchSize:2,writeBatch:async statements=>{replay.push(...statements);return realBatch(d)(statements)}});
 assert.deepEqual(calls,['123456','222222']);assert.equal(replay.filter(s=>s.sql===metadataWriteSql).length,0);
 assert.equal(d.execute('SELECT checked FROM fitp_metadata_progress')[0].checked,2);
}));
test('lost batch acknowledgement resumes from persisted checkpoint without fetching already committed profiles',()=>setup(async(d,ctx,calls)=>{
 let lost=false;await assert.rejects(syncFitpMetadata({...ctx,writeBatch:async statements=>{
  await realBatch(d)(statements);if(!lost&&statements[0].sql.includes('INSERT INTO fitp_metadata_progress')){lost=true;throw Error('fitp_d1_network:phase_batch:request_outcome_unknown_resume_manually');}
 }}),/network/);
 assert.equal(d.execute('SELECT checked FROM fitp_metadata_progress')[0].checked,1);
 calls.length=0;await syncFitpMetadata({...ctx,writeBatch:realBatch(d)});assert.deepEqual(calls,['222222']);
}));
test('batched next-cycle import sends no identical metadata upserts and keeps source-failure ledger honest',()=>setup(async(d,ctx)=>{
 const batches=[];const writeBatch=async statements=>{batches.push(statements);return realBatch(d)(statements)};
 await syncFitpMetadata({...ctx,writeBatch});batches.length=0;
 await syncFitpMetadata({...ctx,writeBatch,now:()=>Date.UTC(2026,10,8)});
 assert.ok(batches.length);assert.equal(batches.flat().filter(s=>s.sql===metadataWriteSql).length,0);
 await assert.rejects(syncFitpMetadata({...ctx,writeBatch,batchSize:2,now:()=>Date.UTC(2026,10,29),fetchProfile:async card=>{if(card==='123456')throw Error('fitp_http_503');return source[1]}}),/retry_failures_manually/);
 assert.equal(d.execute("SELECT complete FROM fitp_metadata_progress WHERE cycle='2026-11-29'")[0].complete,1);
 assert.equal(d.execute("SELECT COUNT(*) AS n FROM fitp_metadata_failures WHERE cycle='2026-11-29'")[0].n,1);
}));
test('D1 REST sends one batch request and never retries HTTP500, timeout or network failures',async()=>{
 const {openD1,D1_REQUEST_TIMEOUT_MS}=await import('../scripts/sync-fitp-player-metadata.mjs');
 const oldAccount=process.env.CLOUDFLARE_ACCOUNT_ID,oldToken=process.env.CLOUDFLARE_API_TOKEN;
 process.env.CLOUDFLARE_ACCOUNT_ID='fixture';process.env.CLOUDFLARE_API_TOKEN='secret-token';
 const databaseId='cc3b23ac-7f90-4a4d-9ec3-44f0f22e6fda';
 const good=n=>({ok:true,status:200,json:async()=>({success:true,result:Array.from({length:n},()=>({success:true,results:[]}))})});
 try{
  const requests=[];const client=await openD1({databaseId,fetcher:async(url,options)=>{const body=JSON.parse(options.body);requests.push({url,body});return good(body.batch?.length||1)}});
  const batch=[{sql:'SELECT ?',params:['one']},{sql:'SELECT ?',params:['two']}];await client.writeBatch(batch);
  assert.equal(requests.length,2);assert.deepEqual(requests[1].body,{batch});assert.ok(requests.every(r=>r.url.endsWith('/'+databaseId+'/query')));assert.equal(D1_REQUEST_TIMEOUT_MS,120000);
  for(const failure of ['500','timeout','network','body-timeout','partial']){
   let requests=0;
   const client=await openD1({databaseId,fetcher:async()=>{
    if(++requests===1)return good(1);
    if(failure==='500')return{ok:false,status:500,json:async()=>({success:false,errors:[{code:7500,message:'SECRET SQL'}]})};
    if(failure==='timeout')throw new DOMException('SECRET URL','TimeoutError');
    if(failure==='network')throw Error('SECRET TOKEN');
    if(failure==='body-timeout')return{ok:true,status:200,json:async()=>{throw new DOMException('SECRET SQL','AbortError')}};
    return good(1);
   }});
   await assert.rejects(client.writeBatch(batch),error=>{assert.match(error.message,/phase_batch|incomplete_batch/);assert.doesNotMatch(error.message,/SECRET|secret-token/);return true});assert.equal(requests,2);
  }
 }finally{if(oldAccount===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=oldAccount;if(oldToken===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=oldToken;}
});
test('CLI retains a machine-readable failure report even when D1 setup fails',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {spawnSync}=await import('node:child_process');const {fileURLToPath}=await import('node:url');
 const directory=mkdtempSync(join(tmpdir(),'cw-fitp-report-'));
 try{
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/sync-fitp-player-metadata.mjs',import.meta.url))],{cwd:directory,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'',CLOUDFLARE_API_TOKEN:''},encoding:'utf8'});
  assert.equal(result.status,1);assert.deepEqual(JSON.parse(readFileSync(join(directory,'fitp-metadata-report.json'),'utf8')),{status:'failed',error:'fitp_d1_credentials_missing'});
 }finally{rmSync(directory,{recursive:true,force:true});}
});
