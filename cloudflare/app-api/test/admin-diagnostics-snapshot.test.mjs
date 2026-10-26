import test from 'node:test';import assert from 'node:assert/strict';
import worker from '../src/index.js';import {database} from './search-sqlite-fixture.mjs';
import {renderCurrentWorkflows,renderCoverageCauses,ADMIN_PANEL_SCRIPT} from '../lib/admin-current-panels.mjs';
const workflow='courtwatch-v3-tennis-europe-live.yml';
const failed={id:701,status:'completed',conclusion:'failure',updated_at:'2026-10-26T11:52:00Z',html_url:'https://github.com/example/actions/runs/701'};
const active={id:702,status:'in_progress',conclusion:null,updated_at:'2026-10-26T12:05:00Z',html_url:'https://github.com/example/actions/runs/702'};
const issue={label:'Europe motore live',workflow,critical:true,status:'red',runId:701,url:failed.html_url,generatedAt:failed.updated_at,detail:'event_switch_failed nel blocco 7',latestRun:active,completedRun:failed};
test('Coverage gives the exact critical failed run and reason; current active work does not hide the failure',()=>{
 const html=renderCoverageCauses({overall:'red',items:[issue,{...issue,critical:false,runId:800,url:'https://github.com/example/actions/runs/800'}]});assert.match(html,/event_switch_failed/);assert.match(html,/href="https:\/\/github.com\/example\/actions\/runs\/701"/);assert.doesNotMatch(html,/run 800/);
 const table=renderCurrentWorkflows({items:[issue],workflowStates:[issue]});assert.match(table,/pill bad">failure/);assert.match(table,/run 701/);assert.match(table,/run 702/);assert.match(table,/rosso complessivo/);
 assert.equal(renderCoverageCauses({overall:'green',items:[]}), '');assert.match(renderCoverageCauses({overall:'red',items:[]}),/dettaglio.*non è disponibile/);
 assert.match(renderCoverageCauses({overall:'red',items:[{label:'Controllo dati',critical:true,status:'red',detail:'dato mancante'}]}),/Run non registrato/);
});
test('complete Diagnostics reading, Coverage and failed-run links stay together until explicit refresh; normal opening needs zero D1/HTTP reads',async()=>{
 const d=database();const values=new Map();let reads=0,saves=0,requests=0;
 const db={prepare(sql){reads++;return d.db.prepare(sql)}};
 const env={ADMIN_TOKEN:'secret',DB:db,ARCHIVE:{async get(key){return values.has(key)?{json:async()=>JSON.parse(values.get(key))}:null},async put(key,value){saves++;values.set(key,value)}}};
 const req=refresh=>new Request('https://snapshot.test/admin/diagnostica'+(refresh?'?refreshDiagnostics=1':''),{headers:{Authorization:'Basic '+btoa('admin:secret')}});
 const publish=(status,items)=>d.publishRuntimeDocuments({'dist/v3/sync_status.json':{coverageFrom:'2025-12-18',checks:{players:23,tournamentEntries:513}},'dist/v3/diagnostics.json':{generatedAt:'2026-10-26T12:00:00Z',overall:status,items},'dist/v3/operational_status.json':{generatedAt:'2026-10-26T12:00:00Z',items,workflowStates:items}});
 const beforeFetch=globalThis.fetch;globalThis.fetch=async()=>{requests++;throw Error('external reads forbidden')};
 try{
  publish('red',[issue]);let writes=d.writes();const response=await worker.fetch(req(true),env),red=await response.text();assert.equal(response.status,200);assert.match(red,/Dal: <b>2025-12-18/);assert.match(red,/Giocatori: <b>23/);assert.match(red,/Presenze visibili: <b>513/);assert.match(red,/run 701/);assert.match(red,/event_switch_failed/);assert.doesNotMatch(red,/panels.js|currentPanels=1|admin-panel-loader/);assert.equal(d.writes(),writes);assert.equal(saves,1);
  publish('green',[]);writes=d.writes();const priorReads=reads;const retained=await worker.fetch(req(false),env);assert.equal(await retained.text(),red);assert.equal(reads,priorReads);assert.equal(saves,1);
  const refreshed=await worker.fetch(req(true),env),green=await refreshed.text();const coverage=green.match(/<h2>Copertura<\/h2>[\s\S]*?<\/section>/)[0];assert.match(coverage,/pill ok">green/);assert.doesNotMatch(coverage,/run 701|event_switch_failed/);assert.equal(saves,2);assert.equal(d.writes(),writes);assert.equal(requests,0);
 }finally{globalThis.fetch=beforeFetch;d.close()}
});
