import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';
import {reconcileCoverageAudit} from './reconcile-itf-coverage-audit.mjs';
import {buildCoverageQueuePlan,coverageDiagnostic} from './itf-coverage-queue-plan.mjs';
import {coverageSections,reusableInventory} from './itf-t1-acquisition-state.mjs';
const events=['B-S-M-KO','B-S-Q-KO','B-D-M-KO','G-S-M-KO','G-S-Q-KO','G-D-M-KO'],today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function fixture(){
 const tournaments=Array.from({length:1031},(_,i)=>({competitionId:`J-TEST-${String(i).padStart(4,'0')}`,tournamentName:'Synthetic test',startDate:today,endDate:today,classification:i<13?'cancelled_no_draws':'complete',events:[],checks:[],missingEvents:[],declaredDraws:0,acquiredDraws:0,missingDraws:0}));
 const row=tournaments[13];row.events=events.map(event=>({event,family:event.split('-').slice(0,3).join('-'),structure:'KO',tournamentId:123,tourType:'N',sourceUrl:'https://example.invalid/test'}));row.checks=row.events.map((e,i)=>({...e,acquired:i<5,reasonCode:i<5?'complete':'incomplete_draw'}));Object.assign(row,{classification:'missing_draws',declaredDraws:6,acquiredDraws:5,missingDraws:1,missingEvents:row.checks.filter(c=>!c.acquired)});
 const baseline={tournaments:structuredClone(tournaments)},audit={criterion:AUDIT_CRITERION,tournaments,summary:{catalogChecked:1031,declaredDraws:6,acquiredDraws:5,missingDraws:1}};
 const doc={competitionId:row.competitionId,event:events[5],taskId:row.competitionId+'__'+events[5],status:'complete',players:[{id:'test',name:'Synthetic participant'}],matches:[{matchId:'m',teams:[{players:[{id:'test',name:'Synthetic participant'}]}]}]};
 return{row,baseline,audit,doc};
}
test('unfinished ordinary tournament moves to extraordinary after end date with only the missing draw',()=>{
 const f=fixture(),nextDay=new Date(Date.parse(today+'T00:00:00Z')+864e5).toISOString().slice(0,10);
 const ordinary=buildCoverageQueuePlan(f.audit,f.baseline,today);assert.equal(ordinary.queues.ordinary.length,1);
 const after=buildCoverageQueuePlan(f.audit,f.baseline,nextDay);assert.equal(after.queues.ordinary.length,0);
 const moved=[...after.queues.extraordinaryA,...after.queues.extraordinaryB];assert.equal(moved.length,1);assert.equal(moved[0].acquiredDraws,5);assert.equal(moved[0].needsInventory,false);assert.deepEqual(after.tasks.map(t=>t.event),[events[5]]);
});
test('5/6 requests only the sixth despite legacy populated flags; valid sixth makes both queues and diagnostics empty',()=>{
 const f=fixture(),previous={eventCache:Object.fromEntries(events.map(e=>[e,{populated:true,terminalAlternative:true}]))},inventory=reusableInventory({competitionId:f.row.competitionId,tournament:{sourceUrl:'https://example.invalid/test'},auditRow:f.row,previous}),sections=coverageSections(inventory,f.row,previous);
 assert.deepEqual(sections.filter(s=>!s.resolved).map(s=>s.event),[events[5]]);
 const result=reconcileCoverageAudit(f.audit,[f.doc],{baseline:f.baseline,now:today+'T12:00:00Z'}),plan=buildCoverageQueuePlan(result.audit,f.baseline,today),diagnostic=coverageDiagnostic(plan);
 assert.equal(result.newlyAcquired,1);assert.equal(result.audit.tournaments[13].classification,'complete');assert.equal(result.audit.summary.missingDraws,0);assert.equal(plan.tasks.length,0);assert.equal(diagnostic.ordinary.total,0);assert.equal(diagnostic.extraordinary.total,0);
 const again=reconcileCoverageAudit(result.audit,[f.doc],{baseline:f.baseline,now:today+'T12:01:00Z'});assert.equal(again.newlyAcquired,0);
});
test('an empty response or technical error cannot close the sixth draw; RR ignores KO but requires every declared group',()=>{
 const f=fixture();for(const bad of [{...f.doc,matches:[]},{...f.doc,status:'retry',error:'HTTP_403'}]){
  const result=reconcileCoverageAudit(f.audit,[bad],{baseline:f.baseline,now:today+'T12:00:00Z'});assert.equal(result.audit.tournaments[13].missingDraws,1);
 }
});
test('RR needs all declared groups and ignores the linked KO',()=>{
 const f=fixture(),rr={event:'G-D-M-RR',family:'G-D-M',structure:'RR',tournamentId:123};f.row.events[5]=rr;f.row.checks[5]={...rr,acquired:false,reasonCode:'round_robin_incomplete'};f.row.missingEvents=[f.row.checks[5]];
 const bad={...f.doc,event:rr.event,roundRobin:{declaredGroups:2,completeGroups:1,missingGroups:[2],missingKnockoutSections:[1]}};
 assert.equal(reconcileCoverageAudit(f.audit,[bad],{baseline:f.baseline,now:today+'T12:00:00Z'}).audit.tournaments[13].missingDraws,1);
 const good={...bad,roundRobin:{declaredGroups:2,completeGroups:2,missingGroups:[],missingKnockoutSections:[1]}};assert.equal(reconcileCoverageAudit(f.audit,[good],{baseline:f.baseline,now:today+'T12:00:00Z'}).audit.tournaments[13].classification,'complete');
});
test('real CLI path reuses inventory without ITF calls, queues only the missing draw, and saves a complete tournament',async()=>{
 const f=fixture(),dir=await fs.mkdtemp(path.join(os.tmpdir(),'itf-missing-only-'));
 const write=async(file,data)=>{await fs.mkdir(path.dirname(path.join(dir,file)),{recursive:true});await fs.writeFile(path.join(dir,file),JSON.stringify(data))};
 const script=name=>new URL(name,import.meta.url).pathname;
 const run=name=>{const r=spawnSync(process.execPath,[script(name)],{cwd:dir,env:{...process.env,ITF_COMPETITION_ID:f.row.competitionId,ITF_AUDIT_STATE_FILE:path.join(dir,'audit.json')},encoding:'utf8',timeout:3000});assert.equal(r.status,0,r.stderr||r.error?.message);return r};
 try{
  await write('audit.json',f.audit);await write('src/v3/itf-audit-baseline-20261001.json',f.baseline);await write('dist/v3/source_itf_tournaments.json',{tournaments:[{...f.row,sourceUrl:'https://example.invalid/test'}]});
  await write('history/itf_draw_target_db.json',{tournaments:{[f.row.competitionId]:{competitionId:f.row.competitionId,eventCache:Object.fromEntries(events.map(e=>[e,{populated:true}]))}}});
  // Regression: catalog, baseline and live state can all lack the URL.
  const historicalSource='https://www.itftennis.com/en/tournament/synthetic/test/2026/'+f.row.competitionId.toLowerCase()+'/';
  await write('dist/v3/source_itf_tournaments.json',{tournaments:[{...f.row,sourceUrl:''}]});
  await write('src/v3/itf-history-draw-batch-07.json',{tasks:[{competitionId:f.row.competitionId,sourceUrl:historicalSource}]});
  for(const event of f.row.events)delete event.sourceUrl;await write('audit.json',f.audit);
  assert.match(run('inventory-itf-history-tournament.mjs').stdout,/"officialInventoryCalls":0/);
  const reused=JSON.parse(await fs.readFile(path.join(dir,'dist/v3/shards/itf/inventory/'+f.row.competitionId+'.json'),'utf8'));assert.equal(reused.events[0].sourceUrl,historicalSource);
  const result=run('build-itf-t1-draw-batch.mjs');assert.match(result.stdout,/"tasks": 1/);
  const inventory=JSON.parse(await fs.readFile(path.join(dir,'dist/v3/shards/itf/t1-inventory/'+f.row.competitionId+'.json'),'utf8'));assert.equal(inventory.requestedSections,1);await write('dist/v3/itf_t1_section_inventory.json',inventory);
  await fs.mkdir(path.join(dir,'draw-tasks'));await fs.writeFile(path.join(dir,'draw-tasks/test.json.gz'),gzipSync(JSON.stringify(f.doc)));run('merge-itf-t1-history-method.mjs');
  const state=JSON.parse(await fs.readFile(path.join(dir,'history/itf_draw_target_db.json'),'utf8'));assert.equal(state.tournaments[f.row.competitionId].decision,'complete');assert.equal(state.tournaments[f.row.competitionId].missingSections,0);assert.equal(state.tournaments[f.row.competitionId].eventCache[events[5]].acquisitionProof.complete,true);
  await fs.rm(path.join(dir,'src/v3/itf-history-draw-batch-07.json'));await write('history/itf_draw_target_db.json',{tournaments:{}});
  const failed=spawnSync(process.execPath,[script('inventory-itf-history-tournament.mjs')],{cwd:dir,env:{...process.env,ITF_COMPETITION_ID:f.row.competitionId,ITF_AUDIT_STATE_FILE:path.join(dir,'audit.json')},encoding:'utf8',timeout:3000});assert.equal(failed.status,2);
  const retry=JSON.parse(await fs.readFile(path.join(dir,'dist/v3/shards/itf/inventory/'+f.row.competitionId+'.json'),'utf8'));assert.equal(retry.status,'retry');assert.equal(retry.error,'tournament_source_not_found');
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});

test('diagnostic distinguishes Incapsula from a draw returned without players and retains the technical error',()=>{
 const f=fixture();
 for(const [document,reason] of [[{...f.doc,status:'retry',players:[],matches:[],failureType:'technical_error',error:'GetDrawsheet_incapsula_challenge'},'incapsula_blocked'],[{...f.doc,status:'retry',players:[],matches:[{teams:[]}],failureType:'not_published_or_incomplete',error:'draw_not_published_or_incomplete'},'draw_without_players']]){
  const result=reconcileCoverageAudit(f.audit,[document],{baseline:f.baseline,now:today+'T12:00:00Z'});
  const diagnostic=coverageDiagnostic(buildCoverageQueuePlan(result.audit,f.baseline,today));
  const missing=diagnostic.ordinary.tournaments[0].missingEvents[0];
  assert.equal(missing.reasonCode,reason);assert.equal(missing.lastError,document.error);assert.equal(diagnostic.ordinary.missingByReason[reason],1);assert.equal(result.audit.tournaments[13].missingDraws,1);
 }
});

test('empty singles qualification resolves only against the acquired matching main, for KO and RR',()=>{
 for(const structure of ['KO','RR']){
  const f=fixture();f.row.checks=f.row.checks.map(c=>({...c,acquired:c.event!=='G-S-Q-KO'}));f.row.missingEvents=f.row.checks.filter(c=>!c.acquired);f.row.acquiredDraws=5;
  if(structure==='RR'){const e=f.row.events.find(e=>e.event==='G-S-M-KO');e.event='G-S-M-RR';e.structure='RR';const c=f.row.checks.find(c=>c.event==='G-S-M-KO');c.event='G-S-M-RR';c.structure='RR';f.row.events.push({event:'G-S-M-KO',family:'G-S-M',structure:'KO',tournamentId:123});}
  const empty={...f.doc,event:'G-S-Q-KO',status:'retry',players:[],matches:[{teams:[]}],error:'draw_not_published_or_incomplete',generatedAt:today+'T10:00:00Z'};
  const result=reconcileCoverageAudit(f.audit,[empty],{baseline:f.baseline,now:today+'T12:00:00Z'});const row=result.audit.tournaments[13];
  assert.equal(row.classification,'complete');assert.equal(row.acquiredDraws,5);assert.equal(row.declaredDraws,5);assert.equal(row.resolvedEvents[0].event,'G-S-Q-KO');assert.equal(buildCoverageQueuePlan(result.audit,f.baseline,today).tasks.length,0);
  const main=f.row.checks.find(c=>c.event==='G-S-M-'+structure);main.acquired=false;f.row.missingEvents=f.row.checks.filter(c=>!c.acquired);f.row.acquiredDraws=4;f.row.missingDraws=2;
  const blocked=reconcileCoverageAudit(f.audit,[empty],{baseline:f.baseline,now:today+'T12:00:00Z'});assert.equal(blocked.audit.tournaments[13].resolvedEvents.length,0);assert.equal(blocked.audit.tournaments[13].missingDraws,2);
 }
});
test('Incapsula and empty doubles qualification remain missing; unrelated tournaments retain their freshness',()=>{
 const f=fixture();f.row.lastAttemptAt=today+'T08:00:00Z';f.row.reconciledAt=f.row.lastAttemptAt;
 const unchanged=reconcileCoverageAudit(f.audit,[],{baseline:f.baseline,now:today+'T12:00:00Z'});assert.equal(unchanged.audit.tournaments[13].lastAttemptAt,f.row.lastAttemptAt);
 for(const doc of [{...f.doc,status:'retry',players:[],matches:[],error:'GetDrawsheet_incapsula_challenge',failureType:'technical_error'},{...f.doc,status:'retry',players:[],matches:[{teams:[]}],error:'draw_not_published_or_incomplete'}]){
  const result=reconcileCoverageAudit(f.audit,[{...doc,generatedAt:today+'T10:00:00Z'}],{baseline:f.baseline,now:today+'T12:00:00Z'});assert.equal(result.audit.tournaments[13].missingDraws,1);assert.equal(result.audit.tournaments[13].lastAttemptAt,today+'T10:00:00Z');
 }
});

test('merge persists empty singles qualification as resolved without an acquired artifact and skips its next task',async()=>{
 const f=fixture(),dir=await fs.mkdtemp(path.join(os.tmpdir(),'itf-empty-qual-'));
 try{
  const inventory=reusableInventory({competitionId:f.row.competitionId,tournament:{sourceUrl:'https://example.invalid/test'},auditRow:f.row});
  const sections=coverageSections(inventory,f.row);for(const section of sections){section.acquired=false;section.resolved=false;}
  await fs.mkdir(path.join(dir,'dist/v3'),{recursive:true});await fs.mkdir(path.join(dir,'draw-tasks'));
  await fs.writeFile(path.join(dir,'dist/v3/itf_t1_section_inventory.json'),JSON.stringify({competitionId:f.row.competitionId,criterion:AUDIT_CRITERION,sections,tournament:f.row}));
  for(const event of events){const doc={...f.doc,event,taskId:f.row.competitionId+'__'+event};if(event==='G-S-Q-KO')Object.assign(doc,{status:'retry',players:[],matches:[{teams:[]}],error:'draw_not_published_or_incomplete'});await fs.writeFile(path.join(dir,'draw-tasks/'+event+'.json.gz'),gzipSync(JSON.stringify(doc)));}
  const run=spawnSync(process.execPath,[new URL('merge-itf-t1-history-method.mjs',import.meta.url).pathname],{cwd:dir,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const previous=JSON.parse(await fs.readFile(path.join(dir,'history/itf_draw_target_db.json'),'utf8')).tournaments[f.row.competitionId];assert.equal(previous.decision,'complete');assert.equal(previous.acquiredSections,5);assert.equal(previous.resolvedSections,6);assert.equal(previous.eventCache['G-S-Q-KO'].populated,false);
  const next=coverageSections(inventory,undefined,previous);assert.equal(next.filter(s=>!s.resolved).length,0);assert.equal(next.find(s=>s.event==='G-S-Q-KO').acquired,false);
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
