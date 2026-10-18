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
