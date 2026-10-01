import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';
import {reconcileCoverageAudit} from './reconcile-itf-coverage-audit.mjs';
import {buildCoverageQueuePlan,coverageDiagnostic} from './itf-coverage-queue-plan.mjs';
test('official empty inventory stays pending, records its real check, and never counts as complete or technical failure',async()=>{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),id='J-J30-EMPTY-2026-001';
 const tournaments=Array.from({length:1031},(_,i)=>({competitionId:i===13?id:'J-TEST-'+i,startDate:today,endDate:today,classification:i<13?'cancelled_no_draws':i===13?'unverifiable':'complete',declaredDraws:0,acquiredDraws:0,missingDraws:0,events:[],checks:[],missingEvents:[]}));
 const baseline={tournaments:structuredClone(tournaments)},audit={criterion:AUDIT_CRITERION,generatedAt:today+'T00:00:00Z',summary:{catalogChecked:1031,declaredDraws:0,acquiredDraws:0,missingDraws:0},tournaments};
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'itf-empty-inventory-'));
 try{
  const write=async(p,d)=>{await fs.mkdir(path.dirname(path.join(dir,p)),{recursive:true});await fs.writeFile(path.join(dir,p),JSON.stringify(d));};
  await write('src/v3/itf-audit-baseline-20261001.json',baseline);await write('audit.json',audit);await write('dist/v3/source_itf_tournaments.json',{tournaments:[{...tournaments[13],sourceUrl:'https://www.itftennis.com/en/tournament/test/'}]});
  await fs.writeFile(path.join(dir,'mock.mjs'),"globalThis.fetch=async()=>new Response(JSON.stringify([]),{status:200,headers:{'Content-Type':'application/json'}});");
  const run=(script,extra=[])=>spawnSync(process.execPath,[...extra,new URL(script,import.meta.url).pathname],{cwd:dir,encoding:'utf8',env:{...process.env,ITF_COMPETITION_ID:id,ITF_AUDIT_STATE_FILE:path.join(dir,'audit.json'),ITF_REQUEST_DELAY_MS:'0'},timeout:3000});
  const invRun=run('inventory-itf-history-tournament.mjs',['--import',path.join(dir,'mock.mjs')]);assert.equal(invRun.status,2,invRun.stderr);
  const inv=JSON.parse(await fs.readFile(path.join(dir,'dist/v3/shards/itf/inventory/'+id+'.json')));assert.equal(inv.status,'retry');assert.equal(inv.error,'empty_inventory');
  const queue=run('build-itf-t1-draw-batch.mjs');assert.equal(queue.status,0,queue.stderr);assert.match(queue.stdout,/"tasks": 0/);assert.match(queue.stdout,/"inventoryErrors": 1/);
  const prepared=JSON.parse(await fs.readFile(path.join(dir,'dist/v3/shards/itf/t1-inventory/'+id+'.json')));assert.equal(prepared.inventoryCheckedAt,inv.generatedAt);
  await write('dist/v3/itf_t1_section_inventory.json',prepared);const merge=run('merge-itf-t1-history-method.mjs');assert.equal(merge.status,0,merge.stderr);
  const state=JSON.parse(await fs.readFile(path.join(dir,'history/itf_draw_target_db.json'))).tournaments[id];assert.equal(state.decision,'pending');assert.equal(state.eventFailure,null);
  const updated=reconcileCoverageAudit(audit,[],{inventories:[prepared],baseline});assert.equal(updated.audit.tournaments[13].classification,'unverifiable');assert.equal(updated.audit.tournaments[13].lastAttemptAt,inv.generatedAt);
  const diagnostic=coverageDiagnostic(buildCoverageQueuePlan(updated.audit,baseline,today));assert.equal(diagnostic.ordinary.tournaments[0].status,'inventory_empty');assert.equal(diagnostic.ordinary.tournaments[0].inventoryError,'empty_inventory');assert.equal(diagnostic.ordinary.tournaments[0].checkedAt,inv.generatedAt);assert.equal(diagnostic.ordinary.total,1);
  const later=reconcileCoverageAudit(updated.audit,[],{baseline,now:today+'T23:59:59Z'});assert.equal(later.audit.tournaments[13].lastAttemptAt,inv.generatedAt);
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
