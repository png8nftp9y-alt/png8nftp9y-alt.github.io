import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {database} from './search-sqlite-fixture.mjs';
import {syncNewFitpMetadata,fetchNewFitpProfile,pendingNewFitpSql} from '../scripts/sync-new-fitp-player-metadata.mjs';
import {metadataWriteSql,openD1} from '../scripts/sync-fitp-player-metadata.mjs';
const migration=readFileSync(new URL('../migrations/0044_fitp_initial_metadata.sql',import.meta.url),'utf8');
async function applyMigration(d){await d.query(migration.slice(0,migration.indexOf('CREATE TRIGGER')));for(const trigger of migration.match(/CREATE TRIGGER[\s\S]*?END;/g))d.execute(trigger)}
const add=(d,card,person='p'+card,key='fitp|'+card,circuit='fitp')=>d.execute('INSERT INTO player_circuit_identities(source_key,canonical_id,name_key,circuit,official_id,normalized_name,display_name) VALUES(?,?,?,?,?,?,?)',[key,person,'SAME NAME',circuit,card,'SAME NAME','Same Name']);
async function setup(fn){const d=database({identityMapping:true});try{
 await d.query(readFileSync(new URL('../migrations/0041_fitp_metadata_engine.sql',import.meta.url),'utf8'));await applyMigration(d);
 const calls=[],ctx={query:async(s,p=[])=>d.execute(s,p),write:async(s,p=[])=>d.execute(s,p),fetchProfile:async card=>{calls.push(card);return {membership_card:card,club:'Club '+card,ranking:'4.1'}},now:()=>Date.UTC(2026,9,20),log:()=>{}};
 await fn(d,ctx,calls);
}finally{d.close()}}
test('D1_TEST_INITIAL_IMPORT: new FITP identities get both fields even after the periodic cycle has completed',()=>setup(async(d,ctx,calls)=>{
 d.execute("INSERT INTO fitp_metadata_progress VALUES('2026-10-18','9999999999',1,100,100,100,0,'old')");add(d,'1234567890');
 const r=await syncNewFitpMetadata(ctx);assert.deepEqual(calls,['1234567890']);assert.equal(r.dataWrites,1);
 assert.deepEqual(d.execute('SELECT membership_card,canonical_id,club,ranking FROM fitp_player_metadata'),[{membership_card:'1234567890',canonical_id:'p1234567890',club:'Club 1234567890',ranking:'4.1'}]);
 assert.equal(d.execute('SELECT state FROM fitp_initial_metadata')[0].state,'complete');
 assert.equal(d.execute('SELECT checked FROM fitp_metadata_progress')[0].checked,100);
}));
test('D1_TEST_IDENTICAL_ZERO_WRITES: unchanged reruns do not fetch or write; additional source links do not reacquire the same ID',()=>setup(async(d,ctx,calls)=>{
 add(d,'1234567890');await syncNewFitpMetadata(ctx);const before=d.writes();calls.length=0;
 const result=await syncNewFitpMetadata(ctx);assert.equal(result.checked,0);assert.equal(d.writes(),before);assert.deepEqual(calls,[]);
 add(d,'1234567890','p1234567890','another-source');calls.length=0;const next=d.writes();await syncNewFitpMetadata(ctx);assert.equal(d.writes(),next);assert.deepEqual(calls,[]);
}));
test('D1_TEST_REAL_DELTAS_ONLY: the second new ID is the only source fetched; existing metadata is not rewritten',()=>setup(async(d,ctx,calls)=>{
 add(d,'1234567890');await syncNewFitpMetadata(ctx);const old=d.execute("SELECT updated_at FROM fitp_player_metadata WHERE membership_card='1234567890'")[0].updated_at;
 add(d,'2234567890');calls.length=0;const r=await syncNewFitpMetadata({...ctx,now:()=>Date.UTC(2026,9,21)});
 assert.deepEqual(calls,['2234567890']);assert.equal(r.dataWrites,1);assert.equal(d.execute("SELECT updated_at FROM fitp_player_metadata WHERE membership_card='1234567890'")[0].updated_at,old);
}));
test('D1_TEST_INCOMPLETE_SOURCE_GUARD: unavailable profiles are recorded once without inventing metadata or automatic retry',()=>setup(async(d,ctx,calls)=>{
 add(d,'1234567890');const missing={...ctx,fetchProfile:async card=>{calls.push(card);throw Error('fitp_profile_missing')}};
 const r=await syncNewFitpMetadata(missing);assert.equal(r.outcomes.unavailable,1);assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_player_metadata')[0].n,0);
 calls.length=0;const before=d.writes();await syncNewFitpMetadata(missing);assert.deepEqual(calls,[]);assert.equal(d.writes(),before);
}));
test('migration never backfills retained identities or closed historical failures',()=>setup(async(d,ctx,calls)=>{
 d.execute('DROP TRIGGER fitp_initial_metadata_insert');add(d,'1234567890');await applyMigration(d);
 assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_initial_metadata')[0].n,0);
 add(d,'1234567890','p1234567890','new-link-for-existing');await syncNewFitpMetadata(ctx);assert.deepEqual(calls,[]);
}));
test('new native ID recovered by an update is acquired once; unrelated changes and other circuits are ignored',()=>setup(async(d,ctx,calls)=>{
 add(d,'','p1','no-id');d.execute("UPDATE player_circuit_identities SET official_id='1234567' WHERE source_key='no-id'");
 add(d,'800123456','itf-person','itf-source','itf');await syncNewFitpMetadata(ctx);assert.deepEqual(calls,['1234567']);
 d.execute("UPDATE player_circuit_identities SET display_name='Renamed',canonical_id='p2' WHERE source_key='no-id'");calls.length=0;await syncNewFitpMetadata(ctx);assert.deepEqual(calls,[]);
}));
test('same names stay separate; ambiguous same-card identities are never fetched or attached',()=>setup(async(d,ctx,calls)=>{
 add(d,'1234567890','a');add(d,'1234567890','b','ambiguous');add(d,'2234567890','c');
 const r=await syncNewFitpMetadata(ctx);assert.deepEqual(calls,['2234567890']);assert.equal(r.outcomes.identity_conflict,1);
 assert.equal(d.execute('SELECT canonical_id FROM fitp_player_metadata')[0].canonical_id,'c');
}));
test('canonical identity changed during source I/O never receives the fetched metadata',()=>setup(async(d,ctx)=>{
 add(d,'1234567890','a');const result=await syncNewFitpMetadata({...ctx,fetchProfile:async card=>{d.execute("UPDATE player_circuit_identities SET canonical_id='b'");return {membership_card:card,club:'Wrong owner',ranking:'4.1'}}});
 assert.equal(result.outcomes.identity_conflict,1);assert.equal(d.execute('SELECT COUNT(*) AS n FROM fitp_player_metadata')[0].n,0);
}));
test('provider failure before metadata commit preserves pending work; lost acknowledgement is reconciled without another FITP fetch',()=>setup(async(d,ctx,calls)=>{
 add(d,'1234567890');let failed=false;
 const r=await syncNewFitpMetadata({...ctx,write:async(s,p)=>{const result=await ctx.write(s,p);if(s===metadataWriteSql&&!failed){failed=true;throw Error('fitp_d1_phase_write:fitp_d1_http_500:codes_7500')}return result}});
 assert.deepEqual(calls,['1234567890']);assert.equal(r.dataWrites,1);assert.equal(d.execute('SELECT state FROM fitp_initial_metadata')[0].state,'complete');
}));
test('unverified metadata prevents queue acknowledgement',()=>setup(async(d,ctx)=>{
 add(d,'1234567890');await assert.rejects(syncNewFitpMetadata({...ctx,write:async(s,p)=>{if(s!==metadataWriteSql)return ctx.write(s,p)}}),/not_verified/);
 assert.equal(d.execute('SELECT state FROM fitp_initial_metadata')[0].state,'pending');
}));
test('source access failures are recorded as technical errors and are not automatically retried',()=>setup(async(d,ctx,calls)=>{
 add(d,'1234567890');const failing={...ctx,fetchProfile:async card=>{calls.push(card);throw Error('fitp_profile_http_429')}};
 await assert.rejects(syncNewFitpMetadata(failing),/source_error_recorded/);assert.equal(d.execute('SELECT state FROM fitp_initial_metadata')[0].state,'error');
 calls.length=0;await syncNewFitpMetadata(failing);assert.deepEqual(calls,[]);
}));
test('already stored metadata from a concurrent periodic run is reused without another source request',()=>setup(async(d,ctx,calls)=>{
 add(d,'1234567890');d.execute("INSERT INTO fitp_player_metadata VALUES('1234567890','p1234567890','Saved club','3.4','original')");
 await syncNewFitpMetadata(ctx);assert.deepEqual(calls,[]);assert.equal(d.execute('SELECT updated_at FROM fitp_player_metadata')[0].updated_at,'original');
}));
test('pending lookup and exact official-card lookups use indexes',()=>setup(async(d)=>{
 const plan=d.execute('EXPLAIN QUERY PLAN '+pendingNewFitpSql,['',40]).map(r=>r.detail).join(' ');assert.match(plan,/fitp_initial_metadata_pending/);assert.doesNotMatch(plan,/SCAN fitp_initial_metadata/);
}));
test('official current endpoint is requested once, carries the exact card and current year, and validates the masked card',async()=>{
 let calls=0;const result=await fetchNewFitpProfile('1234567890',{now:Date.UTC(2027,0,1),fetcher:async(url,options)=>{calls++;assert.match(url,/tesserati\/dettaglio\/semplice$/);assert.deepEqual(JSON.parse(options.body),{cardNumber:btoa('1234567890'),fromYear:2027,toYear:2027});return new Response(JSON.stringify({player:{membershipCard:'*******890',tennis_club_name:'Club',ranking:'4.1'}}))}});
 assert.equal(calls,1);assert.equal(result.club,'Club');await assert.rejects(fetchNewFitpProfile('1234567890',{fetcher:async()=>new Response(JSON.stringify({player:{membershipCard:'*******999'}}))}),/identity_mismatch/);
 await assert.rejects(fetchNewFitpProfile('1234567890',{fetcher:async()=>new Response(JSON.stringify(''))}),/invalid_response/);
});
test('new-player transport can reuse applied migrations without repeating schema operations',async()=>{
 const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN;process.env.CLOUDFLARE_ACCOUNT_ID='test';process.env.CLOUDFLARE_API_TOKEN='not-a-real-token';
 try{let calls=0;await openD1({initializeSchema:false,databaseId:'cc3b23ac-7f90-4a4d-9ec3-44f0f22e6fda',fetcher:async()=>{calls++;throw Error('must not call')}});assert.equal(calls,0)}finally{if(a===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=a;if(t===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=t}
});
