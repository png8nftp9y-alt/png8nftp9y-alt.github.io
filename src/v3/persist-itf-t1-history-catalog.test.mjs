import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
const script=new URL('./persist-itf-t1-draws.mjs',import.meta.url).pathname;
const id='J-J30-EGY-2026-002';
const source={competitionId:id,tournamentName:'J30 Ismailia',startDate:'2026-01-12',endDate:'2026-01-18',surface:'Hard',indoorOutdoor:'Outdoor'};
async function fixture(fn){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'itf-history-persistence-'));
 const write=async(name,data)=>{const target=path.join(root,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(data));};
 const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
 const run=()=>spawnSync(process.execPath,[script,'draw-tasks'],{cwd:root,encoding:'utf8'});
 try{
  await write('dist/v3/source_itf_tournaments.json',{tournaments:[]});
  await write('src/v3/itf-audit-baseline-20261001.json',{tournaments:[]});
  await write('dist/v3/universal/tournaments.json',{tournaments:[]});
  await fs.mkdir(path.join(root,'draw-tasks'));
  await fs.writeFile(path.join(root,'draw-tasks/draw.json.gz'),gzipSync(JSON.stringify({competitionId:id,event:'G-S-M-KO',status:'complete',players:[{id:'p',name:'Player'}],matches:[{matchId:'m',winnerTeam:0,teams:[{players:[{id:'p',name:'Player'}],score:'6-0'}]}]})));
  await fn({root,write,read,run});
 }finally{await fs.rm(root,{recursive:true,force:true});}
}
test('validated historical catalog maps a new historical tournament; repeated import preserves IDs and existing records',()=>fixture(async({write,read,run})=>{
 await write('dist/v3/source_itf_history_tournaments.json',{status:'itf_global_tournament_map_complete',tournaments:[source]});
 await write('dist/v3/universal/matches.json',{matches:[{id:'existing-match',circuit:'fitp'}]});
 await write('dist/v3/universal/results.json',{results:[{id:'existing-result',circuit:'fitp'}]});
 const first=run();assert.equal(first.status,0,first.stderr);
 const audit=await read('dist/v3/audits/itf-t1-persistence.json');
 assert.equal(audit.unmappedDocuments,0);assert.equal(audit.newTournaments,1);assert.equal(audit.newMatches,1);assert.equal(audit.newResults,1);
 const rows=(await read('dist/v3/universal/tournaments.json')).tournaments;assert.equal(rows[0].sourceTournamentId,id);assert.equal(rows[0].name,source.tournamentName);assert.equal(rows[0].startDate,source.startDate);
 assert.ok((await read('dist/v3/universal/matches.json')).matches.some(x=>x.id==='existing-match'));
 assert.ok((await read('dist/v3/universal/results.json')).results.some(x=>x.id==='existing-result'));
 const second=run();assert.equal(second.status,0,second.stderr);
 const again=await read('dist/v3/audits/itf-t1-persistence.json');assert.equal(again.newTournaments,0);assert.equal(again.newMatches,0);assert.equal(again.newResults,0);
}));
test('incomplete historical catalog cannot silently authorize a tournament mapping',()=>fixture(async({write,read,run})=>{
 await write('dist/v3/source_itf_history_tournaments.json',{status:'itf_global_tournament_map_incomplete',tournaments:[source]});
 const result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/no canonical ITF tournament mapping/);
 assert.equal((await read('dist/v3/audits/itf-t1-persistence.json')).unmappedDocuments,1);
}));
test('current catalog metadata takes precedence over historical metadata',()=>fixture(async({write,read,run})=>{
 await write('dist/v3/source_itf_history_tournaments.json',{status:'itf_global_tournament_map_complete',tournaments:[source]});
 await write('dist/v3/source_itf_tournaments.json',{tournaments:[{...source,tournamentName:'Updated official name'}]});
 const result=run();assert.equal(result.status,0,result.stderr);
 assert.equal((await read('dist/v3/universal/tournaments.json')).tournaments[0].name,'Updated official name');
}));
test('baseline fallback still works without a historical catalog',()=>fixture(async({write,run})=>{
 await write('src/v3/itf-audit-baseline-20261001.json',{tournaments:[source]});
 const result=run();assert.equal(result.status,0,result.stderr);
}));
