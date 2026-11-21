import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import scheduler from '../src/scheduler.mjs';
import {listWorkflowControls,setWorkflowEnabled} from '../src/workflow-controls.mjs';
const env={COURTWATCH_GITHUB_TOKEN:'fixture'};
const workflow=(id,state='active')=>({id,state,name:'Workflow '+id,path:'.github/workflows/test-'+id+'.yml'});
test('read-only listing paginates and preserves previously disabled workflows',async()=>{
 const requests=[],rows=Array.from({length:101},(_,i)=>workflow(i+1,i===1?'disabled_manually':'active'));
 const result=await listWorkflowControls(env,async(url,init)=>{requests.push({url,init});const page=Number(new URL(url).searchParams.get('page'));return Response.json({total_count:101,workflows:rows.slice((page-1)*100,page*100)});});
 assert.equal(result.length,101);assert.equal(result.find(x=>x.id===2).state,'disabled_manually');assert.equal(requests.length,2);assert.ok(requests.every(r=>!r.init.method));
});
test('incomplete listings and permission errors never report a complete control panel',async()=>{
 await assert.rejects(listWorkflowControls(env,async()=>Response.json({total_count:2,workflows:[]})),/changed/);
 await assert.rejects(listWorkflowControls(env,async()=>new Response('',{status:403})),/403/);
});
test('pause changes exactly one workflow and verifies it; resume never dispatches a run',async()=>{
 let state='active';const requests=[];
 const api=async(url,init)=>{requests.push({url,method:init.method||'GET'});if(init.method==='PUT'){state=url.endsWith('/disable')?'disabled_manually':'active';return new Response(null,{status:204});}return Response.json(workflow(42,state));};
 assert.deepEqual(await setWorkflowEnabled(env,{id:42,enabled:false,expectedState:'active'},api),{id:42,state:'disabled_manually',changed:true});
 assert.equal(requests.filter(x=>x.method==='PUT').length,1);assert.ok(requests.every(x=>x.url.includes('/42')));assert.ok(!requests.some(x=>/cancel|dispatch/.test(x.url)));
 await setWorkflowEnabled(env,{id:42,enabled:true,expectedState:'disabled_manually'},api);assert.equal(state,'active');assert.ok(!requests.some(x=>/dispatch/.test(x.url)));
});
test('stale state, unsupported identity, failed writes and missing readback stop explicitly',async()=>{
 let puts=0;
 await assert.rejects(setWorkflowEnabled(env,{id:42,enabled:false,expectedState:'active'},async()=>Response.json(workflow(42,'disabled_manually'))),/conflict/);
 await assert.rejects(setWorkflowEnabled(env,{id:42,enabled:false,expectedState:'active'},async()=>Response.json({...workflow(42),path:'dynamic/pages'})),/invalid/);
 await assert.rejects(setWorkflowEnabled(env,{id:42,enabled:false,expectedState:'active'},async(url,init)=>{if(init.method==='PUT'){puts++;return new Response('',{status:403});}return Response.json(workflow(42));}),/write:403/);assert.equal(puts,1);
 await assert.rejects(setWorkflowEnabled(env,{id:42,enabled:false,expectedState:'active'},async(url,init)=>init.method==='PUT'?new Response(null,{status:204}):Response.json(workflow(42))),/unverified/);
});
test('watchdog skips a paused workflow without dispatch, cancellation or re-enable',async()=>{
 const original=globalThis.fetch,requests=[];
 globalThis.fetch=async(url,init={})=>{requests.push({url,method:init.method||'GET'});return Response.json(url.includes('/runs?')?{workflow_runs:[]}:{state:'disabled_manually'});};
 try{const promises=[];await scheduler.scheduled({cron:'10,40 * * * *',scheduledTime:Date.UTC(2026,10,21,12,10)},env,{waitUntil:p=>promises.push(p)});await Promise.all(promises);assert.ok(requests.length>0);assert.ok(requests.every(x=>x.method==='GET'));}finally{globalThis.fetch=original;}
});
test('mutations are RPC-only and public HTTP exposes no credentials or mutation method',async()=>{
 const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');assert.match(source,/extends WorkerEntrypoint/);assert.match(source,/export default scheduler/);
 const response=await scheduler.fetch(new Request('https://watchdog.test/admin/automation',{method:'POST'}),env);const text=await response.text();assert.doesNotMatch(text,/fixture|Authorization/);assert.match(text,/ready/);
});
