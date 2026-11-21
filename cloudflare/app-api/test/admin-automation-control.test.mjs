import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {automationControlPage,changeAutomation} from '../lib/admin-automation-control.mjs';
import {renderCurrentWorkflows} from '../lib/admin-current-panels.mjs';
const rows=[{id:1,name:'FITP <script>',state:'active',path:'.github/workflows/courtwatch-v3-fitp-entries.yml'},{id:2,name:'ITF',state:'disabled_manually',path:'.github/workflows/courtwatch-itf-junior-rankings.yml'}];
const html='<nav></nav><section class="card">'+renderCurrentWorkflows({items:[]})+'</section><section><h2>Altro</h2><table><th>Riferimento</th></table></section>';
const request=(action='pause',extra={})=>new Request('https://app.test/admin/automation',{method:'POST',headers:{Origin:'https://app.test','Content-Type':'application/x-www-form-urlencoded',...extra},body:new URLSearchParams({workflowId:'1',expectedState:'active',action})});
test('controls appear only after Riferimento in existing Workflow e watchdog table',async()=>{
 let reads=0,writes=0;const env={AUTOMATION_CONTROL:{list:async()=>{reads++;return rows;},set:async()=>writes++}};
 const out=await automationControlPage(html,'diagnostica',env);assert.equal(reads,1);assert.equal(writes,0);assert.equal((out.match(/action="\/admin\/automation"/g)||[]).length,2);assert.match(out,/<th>Riferimento<\/th><th>ON\/OFF<\/th>/);assert.match(out,/FITP &lt;script&gt;/);assert.match(out,/OFF · Riattiva/);assert.match(out,/ON · Metti in pausa/);assert.doesNotMatch(out,/Pausa dei singoli workflow/);
 const fitp=out.match(/<tr><td><b>FITP · iscrizioni e cancellazioni[\s\S]*?<\/tr>/)[0];assert.match(fitp,/value="1"/);assert.doesNotMatch(fitp,/value="2"/);
 assert.ok(out.endsWith('<section><h2>Altro</h2><table><th>Riferimento</th></table></section>'));
 assert.equal(await automationControlPage(html,'id',env),html);assert.equal(reads,1);
});
test('failed state reads preserve table and show unavailable cells without buttons',async()=>{
 const out=await automationControlPage(html,'diagnostica',{});assert.match(out,/Stato non verificabile/);assert.doesNotMatch(out,/<form/);assert.match(out,/Riferimento/);
});
test('same-origin POST changes only selected workflow with readback',async()=>{
 const calls=[],env={AUTOMATION_CONTROL:{set:async value=>{calls.push(value);return{id:value.id,state:'disabled_manually'};}}};
 assert.equal((await changeAutomation(request(),env,{})).status,303);assert.deepEqual(calls,[{id:1,enabled:false,expectedState:'active'}]);
 assert.equal((await changeAutomation(request('pause',{Origin:'https://other.test'}),env,{})).status,403);assert.equal(calls.length,1);
});
test('unconfirmed states and stale commands never claim success',async()=>{
 assert.equal((await changeAutomation(request(),{AUTOMATION_CONTROL:{set:async()=>({id:1,state:'active'})}},{})).status,503);
 assert.equal((await changeAutomation(request(),{AUTOMATION_CONTROL:{set:async()=>{throw Error('workflow_control_conflict')}}},{})).status,409);
});
test('real Worker authenticates Admin before mutations',async()=>{
 let writes=0;const env={ADMIN_TOKEN:'fixture-admin',AUTOMATION_CONTROL:{set:async value=>{writes++;return{id:value.id,state:'disabled_manually'};}}};
 assert.equal((await worker.fetch(request(),env)).status,401);assert.equal(writes,0);
 assert.equal((await worker.fetch(request('pause',{Authorization:'Basic '+btoa('admin:fixture-admin')}),env)).status,303);assert.equal(writes,1);
});
