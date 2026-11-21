import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {automationControlPage,changeAutomation} from '../lib/admin-automation-control.mjs';
const rows=[{id:1,name:'FITP <script>',state:'active',path:'.github/workflows/fitp.yml'},{id:2,name:'ITF',state:'disabled_manually',path:'.github/workflows/itf.yml'}];
const html='<main><nav></nav><p>Saved diagnostics</p></main>';
const request=(action='pause',extra={})=>new Request('https://app.test/admin/automation',{method:'POST',headers:{Origin:'https://app.test','Content-Type':'application/x-www-form-urlencoded',...extra},body:new URLSearchParams({workflowId:'1',expectedState:'active',action})});
test('each workflow has its own button with live state and escaped labels; reading never mutates',async()=>{
 let reads=0,writes=0;const env={AUTOMATION_CONTROL:{list:async()=>{reads++;return rows;},set:async()=>writes++}};
 const out=await automationControlPage(html,'diagnostica',env);assert.equal(reads,1);assert.equal(writes,0);assert.equal((out.match(/action="\/admin\/automation"/g)||[]).length,2);assert.match(out,/FITP &lt;script&gt;/);assert.match(out,/IN PAUSA/);assert.match(out,/value="resume"/);assert.match(out,/value="pause"/);
 assert.equal(await automationControlPage(html,'id',env),html);assert.equal(reads,1);
 const fresh=await automationControlPage(html,'diagnostica',{AUTOMATION_CONTROL:{list:async()=>[{...rows[0],state:'disabled_manually'}]}});assert.match(fresh,/Riattiva/);assert.doesNotMatch(fresh,/Metti in pausa/);
});
test('same-origin POST addresses only the selected workflow and redirects after verification',async()=>{
 const calls=[],env={AUTOMATION_CONTROL:{set:async value=>{calls.push(value);return{id:value.id,state:'disabled_manually'};}}};
 const response=await changeAutomation(request(),env,{});assert.equal(response.status,303);assert.equal(response.headers.get('Location'),'/admin/diagnostica');assert.deepEqual(calls,[{id:1,enabled:false,expectedState:'active'}]);
 assert.equal((await changeAutomation(request('pause',{Origin:'https://other.test'}),env,{})).status,403);assert.equal(calls.length,1);
 assert.equal((await changeAutomation(request('invalid'),env,{})).status,400);assert.equal(calls.length,1);
});
test('permission errors and unverifiable results never claim success',async()=>{
 assert.equal((await changeAutomation(request(),{AUTOMATION_CONTROL:{set:async()=>{throw Error('403')}}},{})).status,503);
 assert.equal((await changeAutomation(request(),{AUTOMATION_CONTROL:{set:async()=>({id:1,state:'active'})}},{})).status,503);
 assert.equal((await changeAutomation(request(),{AUTOMATION_CONTROL:{set:async()=>{throw Error('workflow_control_conflict')}}},{})).status,409);
 const out=await automationControlPage(html,'diagnostica',{});assert.match(out,/Stati non verificabili/);assert.doesNotMatch(out,/<form/);
});
test('real Worker route authenticates Admin before any mutation',async()=>{
 let writes=0;const env={ADMIN_TOKEN:'fixture-admin',AUTOMATION_CONTROL:{set:async value=>{writes++;return{id:value.id,state:'disabled_manually'};}}};
 const denied=await worker.fetch(request(),env);assert.equal(denied.status,401);assert.equal(writes,0);
 const accepted=await worker.fetch(request('pause',{Authorization:'Basic '+btoa('admin:fixture-admin')}),env);assert.equal(accepted.status,303);assert.equal(writes,1);
});
