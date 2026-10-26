import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {ADMIN_OPERATIONAL_WORKFLOWS,operationalWorkflowRows} from '../lib/admin-operational-workflows.mjs';
import {renderCurrentWorkflows,attachAdminPanels,ADMIN_PANEL_SCRIPT} from '../lib/admin-current-panels.mjs';
const status=(workflow,id=1)=>({workflow,label:'Source label',latestRun:{id,status:'completed',conclusion:'success',html_url:'https://github.com/example/actions/runs/'+id}});
test('only production flows are shown, regardless of success/failure; old repairs are excluded',()=>{
 const doc={items:[],workflowStates:[status('courtwatch-acceptance-player-profiles.yml'),status('courtwatch-approved-iris-grosso-link.yml'),status('courtwatch-global-identity-splits.yml'),status('courtwatch-cloudflare-app-api.yml')]};
 const rows=operationalWorkflowRows(doc);assert.equal(rows.length,ADMIN_OPERATIONAL_WORKFLOWS.length);assert.equal(new Set(rows.map(x=>x.workflow)).size,rows.length);
 assert.ok(rows.some(x=>x.workflow==='courtwatch-cloudflare-app-api.yml'));assert.ok(rows.some(x=>x.workflow==='courtwatch-v3-fitp-tournaments-sharded.yml'));
 assert.ok(!rows.some(x=>/approved|global-identity-splits/.test(x.workflow)));
 const html=renderCurrentWorkflows(doc);assert.match(html,/Acceptance/);assert.match(html,/catalogo provinciale/);assert.match(html,/non disponibile/);assert.doesNotMatch(html,/Iris|global-identity-splits/);
});
test('workflow states override old critical items; missing evidence remains explicitly unavailable',()=>{
 const workflow='courtwatch-cloudflare-app-api.yml';const rows=operationalWorkflowRows({items:[status(workflow,1)],workflowStates:[status(workflow,2)]});assert.equal(rows.find(x=>x.workflow===workflow).latestRun.id,2);assert.ok(rows.some(x=>!x.latestRun));
});
test('diagnostics has only its existing refresh button, while ID retains its separate review control',()=>{
 const source='<html><nav></nav><form><button name="refreshDiagnostics" value="1">Aggiorna diagnostica</button></form><section class="card"><h2>Workflow e watchdog</h2>old</section><section class="card"><h2>Diagnostica applicativa</h2>old</section></html>';
 const html=attachAdminPanels(source,'diagnostica','https://app/admin/diagnostica');assert.match(html,/Aggiorna diagnostica/);assert.doesNotMatch(html,/Aggiorna stati|id="admin-panel-refresh"/);assert.doesNotMatch(html,/panels.js|currentPanels=1/);assert.equal(html,source);
 assert.match(attachAdminPanels('<html><nav></nav></html>','id','https://app/admin/id'),/Aggiorna segnalazioni/);
});
test('without the removed button diagnostics makes one request on opening, succeeds and never retries',async()=>{
 let calls=0;const host={dataset:{url:'/admin/diagnostica?currentPanels=1',view:'diagnostica'}},error={},target={};
 const document={getElementById:id=>({'admin-panel-loader':host,'admin-panel-error':error,'admin-workflows':target}[id])};
 vm.runInNewContext(ADMIN_PANEL_SCRIPT,{document,AbortSignal,fetch:async()=>{calls++;return{ok:true,json:async()=>({workflows:'current'})}}});await new Promise(r=>setImmediate(r));assert.equal(calls,1);assert.equal(target.innerHTML,'current');assert.equal(error.textContent,'');
 vm.runInNewContext(ADMIN_PANEL_SCRIPT,{document,AbortSignal,fetch:async()=>{calls++;throw Error('down')}});await new Promise(r=>setImmediate(r));assert.equal(calls,2);assert.match(error.textContent,/Aggiorna diagnostica/);assert.doesNotMatch(ADMIN_PANEL_SCRIPT,/setInterval|setTimeout/);
});

test('the three non-routine flows are excluded from diagnostics even when their saved runs failed',()=>{
 const excluded=['courtwatch-all-itf-metadata.yml','courtwatch-v3-oop.yml','courtwatch-v3-results.yml'];
 const doc={items:[],workflowStates:excluded.map((workflow,i)=>({...status(workflow,900+i),latestRun:{...status(workflow,900+i).latestRun,conclusion:'failure'}}))};
 const rows=operationalWorkflowRows(doc);assert.equal(rows.length,25);assert.ok(excluded.every(file=>!rows.some(row=>row.workflow===file)));
 assert.doesNotMatch(renderCurrentWorkflows(doc),/run 900|run 901|run 902/);
 for(const file of ['courtwatch-itf-meta-engine.yml','courtwatch-tennis-europe-oop-live.yml','courtwatch-tennis-europe-agenda.yml','courtwatch-cloudflare-app-api.yml'])assert.ok(rows.some(row=>row.workflow===file));
});
