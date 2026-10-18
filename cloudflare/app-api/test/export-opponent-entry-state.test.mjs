import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportOpponentEntryState} from '../scripts/export-opponent-entry-state.mjs';
import {createReadOnlyD1Client,openReadOnlyD1} from '../lib/read-only-d1-client.mjs';
const source=readFileSync(new URL('../scripts/export-opponent-entry-state.mjs',import.meta.url),'utf8');
const row=i=>({circuit:'fitp',source_player_id:String(i).padStart(8,'0'),normalized_name:'player '+i,display_name:'Player '+i,payload:JSON.stringify({tournaments:[{id:i,withdrawn:i%3===0}],unicode:'Černá'})});
test('complete keyset export preserves every original field over multiple pages without a CLI process',async()=>{
 const expected=Array.from({length:12001},(_,i)=>row(i));let offset=0;const sql=[];
 const {query}=createReadOnlyD1Client(async statement=>{sql.push(statement);const page=expected.slice(offset,offset+5000);offset+=page.length;return page;});
 const state=await exportOpponentEntryState(query);assert.deepEqual(state,{rows:expected});assert.equal(sql.length,3);
 assert.match(sql[1],/WHERE \(circuit,source_player_id\)>\('fitp','00004999'\)/);assert.match(sql[2],/'00009999'/);
 assert.doesNotMatch(source,/spawn|execFile|child_process|wrangler|OFFSET/);assert.match(source,/D1_READ_ONLY: guarded/);
});
test('an exact final page is followed by one terminating empty read, with no duplicate rows',async()=>{
 const pages=[[row(0),row(1)],[]];let calls=0;assert.deepEqual(await exportOpponentEntryState(async()=>{calls++;return pages.shift();},{pageSize:2}),{rows:[row(0),row(1)]});assert.equal(calls,2);
});
test('a failed page aborts immediately instead of returning an incomplete state or retrying',async()=>{
 let calls=0;await assert.rejects(exportOpponentEntryState(async()=>{calls++;if(calls===1)return[row(0),row(1)];throw Error('remote_failure');},{pageSize:2}),/remote_failure/);assert.equal(calls,2);
});
test('duplicate cursors and malformed rows cannot certify a complete state',async()=>{
 await assert.rejects(exportOpponentEntryState(async()=>[row(0)],{pageSize:1}),/cursor did not advance/);
 for(const bad of [null,[{circuit:'fitp',source_player_id:'1'}]])await assert.rejects(exportOpponentEntryState(async()=>bad),/Invalid opponent/);
});
// D1_TEST_READ_ONLY_TRANSPORT / D1_TEST_MUTATIONS_REJECTED
test('direct HTTP export uses one database lookup and one request per page; transport is SELECT-only and single-attempt',async()=>{
 const oldAccount=process.env.CLOUDFLARE_ACCOUNT_ID,oldToken=process.env.CLOUDFLARE_API_TOKEN;
 process.env.CLOUDFLARE_ACCOUNT_ID='fixture';process.env.CLOUDFLARE_API_TOKEN='fixture';
 try{
  const requests=[];let pages=0;
  const client=await openReadOnlyD1({fetcher:async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({success:true,result:options.body?[{success:true,results:pages++?[]:[row(0),row(1)]}]:[{name:'courtwatch-app',uuid:'database'}]}));}});
  assert.deepEqual(await exportOpponentEntryState(client.query,{pageSize:2}),{rows:[row(0),row(1)]});assert.equal(requests.length,3);
  await assert.rejects(client.query('DELETE FROM opponent_entry_profiles'),/read_only_guard/);assert.equal(requests.length,3);
 }finally{if(oldAccount===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=oldAccount;if(oldToken===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=oldToken;}
});
