import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
test('persist historical draw absent from current catalog using frozen baseline metadata',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'itf-historical-map-'));
 try{
  const write=async(name,data)=>{await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),JSON.stringify(data));};
  const id='J-J60-NEP-2026-001';
  await write('src/v3/itf-audit-baseline-20261001.json',{tournaments:[{competitionId:id,tournamentName:'J60 Kathmandu',startDate:'2026-01-05',endDate:'2026-01-10'}]});
  await write('dist/v3/source_itf_tournaments.json',{tournaments:[]});await write('dist/v3/universal/tournaments.json',{tournaments:[]});
  await fs.mkdir(path.join(root,'draw-tasks'));
  const doc={competitionId:id,event:'B-S-M-KO',status:'complete',generatedAt:'2026-10-01T23:07:00Z',players:[{id:'p',name:'Player'}],matches:[{matchId:'m',teams:[{players:[{id:'p',name:'Player'}]}]}]};
  await fs.writeFile(path.join(root,'draw-tasks/test.json.gz'),gzipSync(JSON.stringify(doc)));
  const script=new URL('persist-itf-t1-draws.mjs',import.meta.url).pathname;
  const run=spawnSync(process.execPath,[script,'draw-tasks'],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const audit=JSON.parse(await fs.readFile(path.join(root,'dist/v3/audits/itf-t1-persistence.json')));assert.equal(audit.unmappedDocuments,0);assert.equal(audit.newTournaments,1);assert.equal(audit.completeDocuments,1);assert.equal(audit.newMatches,1);
  const rows=JSON.parse(await fs.readFile(path.join(root,'dist/v3/universal/tournaments.json'))).tournaments;assert.equal(rows[0].sourceTournamentId,id);assert.equal(rows[0].name,'J60 Kathmandu');
  const again=spawnSync(process.execPath,[script,'draw-tasks'],{cwd:root,encoding:'utf8'});assert.equal(again.status,0,again.stderr);const second=JSON.parse(await fs.readFile(path.join(root,'dist/v3/audits/itf-t1-persistence.json')));assert.equal(second.newTournaments,0);assert.equal(second.newMatches,0);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
