import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import worker from '../src/index.js';import {database} from './search-sqlite-fixture.mjs';
import {renderCurrentWorkflows,attachAdminPanels,ADMIN_PANEL_SCRIPT} from '../lib/admin-current-panels.mjs';
test('current D1 workflow fragment replaces retained red diagnostics, includes missing workflows and performs no writes or counts',async()=>{
 const d=database();try{
 const workflow='courtwatch-acceptance-player-profiles.yml',latestRun={id:9,status:'completed',conclusion:'success',updated_at:'2026-10-25T21:00:00Z',html_url:'https://github.com/example/actions/runs/9'};
 const current={generatedAt:'2026-10-25T21:00:00Z',items:[{label:'D1 generale',workflow:'d1.yml',status:'green',detail:'success',latestRun}],workflowStates:[{workflow,label:'Acceptance',latestRun,checkedAt:'2026-10-25T21:00:00Z'}]};
 d.publishRuntimeDocuments({'dist/v3/operational_status.json':current,'dist/v3/diagnostics.json':{items:[{label:'D1 generale',workflow:'d1.yml',status:'red',detail:'old failure'}]}});
 let reads=0;const db={prepare(sql){reads++;assert.doesNotMatch(sql,/COUNT\(|player_circuit_identities|observed_players/);return d.db.prepare(sql)}};
 const auth={Authorization:'Basic '+btoa('admin:secret')},env={ADMIN_TOKEN:'secret',DB:db},writes=d.writes();
 assert.equal((await worker.fetch(new Request('https://app/admin/diagnostica?currentPanels=1'),env)).status,401);assert.equal(reads,0);
 const response=await worker.fetch(new Request('https://app/admin/diagnostica?currentPanels=1',{headers:auth}),env),panels=await response.json();assert.equal(response.status,200);assert.match(panels.workflows,/Acceptance/);assert.match(panels.workflows,/run 9/);assert.doesNotMatch(panels.application,/old failure/);assert.match(panels.application,/green/);assert.equal(reads,1);assert.equal(d.writes(),writes);
 }finally{d.close()}
});
test('Diagnostics preserves the complete saved reading until its explicit refresh',()=>{
 const raw='<html><nav></nav><section class="card"><h2>Workflow e watchdog</h2>OLD RED</section><section class="card"><h2>Diagnostica applicativa</h2>OLD FAILURE</section><div>COUNT 123</div></html>';
 const html=attachAdminPanels(raw,'diagnostica','https://app/admin/diagnostica');assert.match(html,/admin-identity-refresh/);assert.match(html,/OLD RED|OLD FAILURE/);assert.match(html,/COUNT 123/);assert.doesNotMatch(html,/currentPanels=1/);assert.match(html,/panels.js/);assert.match(renderCurrentWorkflows(null),/non disponibili/);
});
test('client requests once on opening and once on click; errors never retry and source data is never executed',async()=>{
 let calls=0,handler,finish;const pending=new Promise(r=>{finish=r}),host={dataset:{url:'/admin/id?currentPanels=1'}},button={addEventListener(event,fn){assert.equal(event,'click');handler=fn}},error={},target={};
 vm.runInNewContext(ADMIN_PANEL_SCRIPT,{document:{getElementById:id=>({'admin-panel-loader':host,'admin-panel-refresh':button,'admin-panel-error':error,'admin-review':target}[id])},AbortSignal,fetch:async()=>{calls++;await pending;return{ok:true,json:async()=>({review:'<p>Current</p>'})}}});
 assert.equal(calls,1);await handler();assert.equal(calls,1);finish();await new Promise(r=>setImmediate(r));assert.equal(target.innerHTML,'<p>Current</p>');await handler();assert.equal(calls,2);assert.doesNotMatch(ADMIN_PANEL_SCRIPT,/setInterval|setTimeout|eval\(/);
 const ctx={document:{getElementById:id=>({'admin-panel-loader':host,'admin-panel-refresh':button,'admin-panel-error':error}[id])},AbortSignal,fetch:async()=>{calls++;throw Error('down')}};vm.runInNewContext(ADMIN_PANEL_SCRIPT,ctx);await new Promise(r=>setImmediate(r));assert.equal(calls,3);assert.match(error.textContent,/non disponibili/);
});
test('panel script remains authenticated and no-store, and navigation never starts hidden ID preparation',async()=>{
 const env={ADMIN_TOKEN:'secret',DB:{prepare(){throw Error('must not read')}}};assert.equal((await worker.fetch(new Request('https://app/admin/panels.js'),env)).status,401);
 const r=await worker.fetch(new Request('https://app/admin/panels.js',{headers:{Authorization:'Basic '+btoa('admin:secret')}}),env);assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/javascript/);assert.equal(r.headers.get('Cache-Control'),'no-store');
 let background=0;const archive={get:async()=>null};const page=await worker.fetch(new Request('https://app/admin/diagnostica',{headers:{Authorization:'Basic '+btoa('admin:secret')}}),{...env,ARCHIVE:archive},{waitUntil(){background++}});assert.equal(page.status,200);assert.equal(background,0);assert.match(page.headers.get('Content-Security-Policy'),/script-src 'self'; connect-src 'self'/);
});


import './admin-essential-workflows.test.mjs';
