import test from 'node:test';import assert from 'node:assert/strict';import {collectWorkflowStatus} from './operational-workflow-status.mjs';
const now='2026-10-25T21:00:00Z';const run=(id,workflow,conclusion='success')=>({id,path:'.github/workflows/'+workflow,status:'completed',conclusion,created_at:now,updated_at:now,html_url:'https://github.com/example/actions/runs/'+id});
test('all catalog workflows seed once; current success supersedes retained failures and event supplies absent global run',async()=>{
 const catalog=[{workflow:'a.yml',label:'A'},{workflow:'b.yml',label:'B'}],calls=[];
 const get=async url=>{calls.push(url);return Response.json({workflow_runs:url.includes('/actions/runs?')?[run(2,'a.yml')]:[]})};
 const prior={workflowStates:[{workflow:'a.yml',label:'A',latestRun:{...run(1,'a.yml','failure'),created_at:'2026-10-24'},checkedAt:'2026-10-24'}]};
 const result=await collectWorkflowStatus({catalog,previous:prior,event:{workflow_run:run(3,'b.yml')},repo:'x/y',now,fetcher:get});assert.equal(result.workflowStates.length,2);assert.equal(result.workflowStates[0].latestRun.id,2);assert.equal(result.workflowStates[1].latestRun.id,3);assert.equal(calls.length,2);
 calls.length=0;await collectWorkflowStatus({catalog,previous:result,repo:'x/y',now,fetcher:get});assert.equal(calls.length,1);
});
test('one failed request remains explicit and cannot become a false green; every core is individually checked',async()=>{
 const calls=[];const result=await collectWorkflowStatus({catalog:[{workflow:'courtwatch-cloudflare-app-api.yml',label:'D1'},{workflow:'missing.yml',label:'Missing'}],repo:'x/y',now,fetcher:async url=>{calls.push(url);return new Response('',{status:503})}});assert.equal(calls.length,3);assert.equal(result.runsError,'GitHub HTTP 503');assert.equal(result.items.find(x=>x.label==='D1 generale').status,'yellow');assert.equal(result.workflowStates[1].latestRun,null);assert.match(result.workflowStates[1].error,/503/);
});
