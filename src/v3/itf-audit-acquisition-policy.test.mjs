import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {acquiredDrawStatus,requiredAuditEvents} from './itf-audit-acquisition-policy.mjs';

const player={name:'Player'},match={teams:[{players:[player]},{players:[]}]};
const artifact={status:'complete',players:[player],matches:[match],rowParity:{certified:false,emptyRows:3}};
test('Algiers-style empty entry slots do not invalidate an archived acquisition',()=>{
 assert.equal(acquiredDrawStatus({event:'B-S-Q-KO',structure:'KO',artifact}).complete,true);
 assert.equal(acquiredDrawStatus({event:'G-S-Q-KO',structure:'KO',artifact:{...artifact,status:'retry',error:'draw_rows_incomplete:11/16;empty=5'}}).complete,true);
});
test('merged report balances 1031 and keeps 235 unknown; cancelled count as resolved',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'itf-audit-merge-'));
 try{
  for(const dir of ['src/v3','history','shards','archive'])await fs.mkdir(path.join(root,dir),{recursive:true});
  for(const name of ['merge-itf-full-inventory-audit.mjs','itf-audit-acquisition-policy.mjs','itf-known-match-only-draws.mjs','itf-known-unused-draws.mjs','itf-audit-baseline-20261001.json'])await fs.copyFile(new URL(name,import.meta.url),path.join(root,'src/v3',name));
  await fs.writeFile(path.join(root,'history/itf_draw_target_db.json'),JSON.stringify({tournaments:{}}));
  for(const event of ['B-S-M-KO','B-S-Q-KO','B-D-M-KO','G-S-M-KO','G-S-Q-KO','G-D-M-KO'])await fs.writeFile(path.join(root,'archive',event+'.json.gz'),gzipSync(JSON.stringify({...artifact,competitionId:'J-J100-ALG-2026-001',event})));
  const result=spawnSync(process.execPath,['src/v3/merge-itf-full-inventory-audit.mjs','shards','archive'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(await fs.readFile(path.join(root,'dist/v3/audits/itf-official-draw-parity.json'),'utf8'));
  assert.equal(report.summary.catalogChecked,1031);assert.equal(report.summary.cancelledNoDraws,13);
  assert.equal(report.summary.unverifiable,235);assert.equal(report.summary.readyForT1,false);
  assert.equal(report.summary.resolved+report.summary.missingDrawsTournaments+report.summary.unverifiable,1031);
  assert.equal(report.tournaments.find(row=>row.competitionId==='J-J100-ALG-2026-001').classification,'complete');
  await fs.writeFile(path.join(root,'archive','corrupt.json.gz'),'invalid archive');
  const invalid=spawnSync(process.execPath,['src/v3/merge-itf-full-inventory-audit.mjs','shards','archive'],{cwd:root,encoding:'utf8'});
  assert.notEqual(invalid.status,0);assert.match(invalid.stderr,/ITF_unreadable_artifacts/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('empty and blocked documents are not promoted by removing the BYE check',()=>{
 assert.equal(acquiredDrawStatus({event:'B-S-M-KO',artifact:{status:'complete',players:[],matches:[]}}).complete,false);
 assert.equal(acquiredDrawStatus({event:'B-S-M-KO',artifact:{...artifact,status:'retry',error:'GetDrawsheet_incapsula_challenge'}}).reasonCode,'incapsula_blocked');
 assert.equal(acquiredDrawStatus({event:'B-S-M-KO',live:{populated:true,players:[player]}}).complete,false);
});
test('RR requires all declared groups, independent of linked KO and row parity',()=>{
 const rr={...artifact,roundRobin:{declaredGroups:8,completeGroups:8,missingGroups:[],missingKnockoutSections:[1],certified:false}};
 assert.equal(acquiredDrawStatus({event:'G-S-M-RR',structure:'RR',artifact:rr}).complete,true);
 assert.equal(acquiredDrawStatus({event:'G-S-M-RR',structure:'RR',artifact:{...rr,roundRobin:{...rr.roundRobin,completeGroups:7,missingGroups:[8]}}}).complete,false);
 assert.equal(acquiredDrawStatus({event:'G-S-M-RR',structure:'RR',artifact}).complete,false);
});
test('boys RR excludes only boys singles main KO, preserving girls, qualifying and doubles',()=>{
 const events=['B-S-M-RR','B-S-M-KO','B-S-Q-KO','B-D-M-KO','G-S-M-KO'].map(event=>({event,family:event.slice(0,-3),structure:event.slice(-2)}));
 assert.deepEqual(requiredAuditEvents(events).map(item=>item.event),['B-S-M-RR','B-S-Q-KO','B-D-M-KO','G-S-M-KO']);
});
test('the frozen 1031 baseline selects all 235 unverified inventories, including future dates',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'itf-audit-policy-'));
 try{
  await fs.mkdir(path.join(root,'src/v3'),{recursive:true});
  for(const name of ['build-itf-full-inventory-matrix.mjs','itf-common.mjs','itf-audit-baseline-20261001.json'])await fs.copyFile(new URL(name,import.meta.url),path.join(root,'src/v3',name));
  const baseline=JSON.parse(await fs.readFile(path.join(root,'src/v3/itf-audit-baseline-20261001.json'),'utf8'));
  assert.equal(baseline.tournaments.length,1031);
  assert.equal(baseline.tournaments.filter(row=>row.classification==='cancelled_no_draws').length,13);
  const previous=path.join(root,'state.json'),output=path.join(root,'output');
  await fs.writeFile(previous,JSON.stringify(baseline));
  const result=spawnSync(process.execPath,['src/v3/build-itf-full-inventory-matrix.mjs'],{cwd:root,env:{...process.env,ITF_AUDIT_STATE_FILE:previous,GITHUB_OUTPUT:output},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const include=JSON.parse((await fs.readFile(output,'utf8')).trim().slice('matrix='.length)).include;
  const ids=include.flatMap(row=>row.competitionIds.split(',').filter(Boolean));
  assert.equal(ids.length,235);assert.equal(new Set(ids).size,235);
  assert.deepEqual(new Set(ids),new Set(baseline.tournaments.filter(row=>row.classification==='unverifiable').map(row=>row.competitionId)));
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
