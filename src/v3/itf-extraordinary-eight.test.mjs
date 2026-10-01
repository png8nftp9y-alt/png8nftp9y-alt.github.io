import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {AUDIT_CRITERION} from './itf-audit-acquisition-policy.mjs';
import {extraordinaryLane} from './itf-coverage-queue-plan.mjs';
test('A and B select eight distinct pending tournaments and rotate past attempted IDs',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'itf-extra-eight-'));
 try{
  const rows=Array.from({length:1031},(_,i)=>({competitionId:'J-TEST-'+i,startDate:'2026-01-05',endDate:'2026-01-10',classification:i<13?'cancelled_no_draws':'complete',events:[],checks:[],missingEvents:[],declaredDraws:0,acquiredDraws:0,missingDraws:0}));
  for(let i=13;i<53;i++){const e={event:'B-S-M-KO',family:'B-S-M',structure:'KO',tournamentId:123};const c={...e,acquired:false,reasonCode:'never_processed'};Object.assign(rows[i],{classification:'missing_draws',events:[e],checks:[c],missingEvents:[c],declaredDraws:1,missingDraws:1});}
  await fs.mkdir(path.join(root,'src/v3'),{recursive:true});await fs.writeFile(path.join(root,'src/v3/itf-audit-baseline-20261001.json'),JSON.stringify({tournaments:rows}));await fs.writeFile(path.join(root,'audit.json'),JSON.stringify({criterion:AUDIT_CRITERION,tournaments:rows,summary:{declaredDraws:40,acquiredDraws:0,missingDraws:40}}));
  const select=async(lane,excluded='')=>{const r=spawnSync(process.execPath,[new URL('build-itf-t1-extraordinary-batch.mjs',import.meta.url).pathname],{cwd:root,encoding:'utf8',env:{...process.env,ITF_AUDIT_STATE_FILE:path.join(root,'audit.json'),ITF_EXTRAORDINARY_LANE:lane,ITF_EXCLUDE_IDS:excluded}});assert.equal(r.status,0,r.stderr);return JSON.parse(await fs.readFile(path.join(root,'dist/v3/itf_t1_extraordinary_batch.json')));};
  const a=await select('a'),b=await select('b');assert.equal(a.selected.length,8);assert.equal(b.selected.length,8);assert.equal(a.batchLimit,8);assert(a.selected.every(t=>extraordinaryLane(t.competitionId)==='a'));assert(b.selected.every(t=>extraordinaryLane(t.competitionId)==='b'));
  const next=await select('a',a.selected.map(t=>t.competitionId).join(','));assert.equal(next.selected.length,8);assert(next.selected.every(t=>!a.selected.some(old=>old.competitionId===t.competitionId)));
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
