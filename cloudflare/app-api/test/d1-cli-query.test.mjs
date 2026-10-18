import test from 'node:test';import assert from 'node:assert/strict';import {cliD1Query} from '../lib/d1-cli-query.mjs';
test('CLI query preserves exact SQL/results and logs Cloudflare counters once, without echoing SQL',async()=>{
 const logs=[];let calls=0;const rows=await cliD1Query('SELECT private_column FROM players',{log:s=>logs.push(s),execute:(name,args)=>{calls++;assert.equal(name,'npx');assert.equal(args.at(-2),'SELECT private_column FROM players');return{status:0,stdout:JSON.stringify([{success:true,results:[{n:3}],meta:{rows_read:123,rows_written:0}},{success:true,results:[],meta:{rows_read:4,rows_written:2}}])}}});
 assert.deepEqual(rows,[{n:3}]);assert.equal(calls,1);assert.deepEqual(JSON.parse(logs[0].split('=')[1]),{queries:2,rowsRead:127,rowsWritten:2});assert.doesNotMatch(logs[0],/private_column/);
});
test('failed or unmeasured CLI responses are rejected and never retried',async()=>{
 for(const response of [{status:1,stderr:'failed'},{status:0,stdout:'[]'},{status:0,stdout:'[{"success":false}]'},{status:0,stdout:'[{"success":true,"results":[]}]'}]){
  let calls=0;await assert.rejects(cliD1Query('SELECT 1',{log:()=>{},execute:()=>{calls++;return response}}));assert.equal(calls,1);
 }
});
