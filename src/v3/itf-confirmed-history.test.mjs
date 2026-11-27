import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import vm from 'node:vm';
import {mergeConfirmedItfHistory, preserveConfirmedItfTargets, itfTargetEvidence} from './itf-confirmed-history.mjs';
const recovery=JSON.parse(await readFile(new URL('../../history/itf-confirmed-draw-recovery.json',import.meta.url),'utf8'));
const draw=recovery.entries[0], key=`${draw.playerId}|${draw.competitionId}`;
const alternate={...draw,entryStatus:'confirmed_on_official_acceptance_list',calendarState:'acceptance_live',acceptanceCode:'A',acceptancePosition:19,calendarListLabel:'A-19'};
delete alternate.drawConfirmedAt;
const today='2026-11-26';
test('documented draw confirmation overrides A-19 and remains unique through repeated stale snapshots',()=>{
 let rows=mergeConfirmedItfHistory([alternate],[draw],today);
 for(let n=0;n<3;n++)rows=mergeConfirmedItfHistory([alternate],[...rows,draw],today);
 assert.equal(rows.length,1);assert.equal(rows[0].entryStatus,'draw_confirmed');assert.equal(rows[0].acceptanceCode,'');assert.equal(rows[0].drawConfirmed,true);
});
test('an empty refresh retains begun confirmed events without promoting unconfirmed alternates',()=>{
 assert.equal(mergeConfirmedItfHistory([],[alternate],today).length,0);
 assert.equal(mergeConfirmedItfHistory([],[draw],today).length,1);
});
test('draw confirmation remains permanent even before the start and after a withdrawal',()=>{
 const withdrawn={...alternate,entryStatus:'withdrawn'};
 assert.equal(mergeConfirmedItfHistory([withdrawn],[draw],'2026-10-30')[0].entryStatus,'draw_confirmed');
 assert.equal(mergeConfirmedItfHistory([withdrawn],[draw],today)[0].entryStatus,'draw_confirmed');
});
test('unrelated events survive and conflicting native identity blocks publication',()=>{
 const other={...alternate,playerId:'other',competitionId:'J-J30-ITA-2026-001'};
 assert.equal(mergeConfirmedItfHistory([other],[draw],today).length,2);
 assert.throws(()=>mergeConfirmedItfHistory([{...alternate,worldTennisId:'different'}],[draw],today),/Conflicting ITF identity/);
});
test('target repair clears obsolete removal flags and keeps acceptance evidence',()=>{
 const targets=preserveConfirmedItfTargets({[key]:{...alternate,drawDecision:'removed',removalReason:'draw_absent_verified',removedAt:'old',acceptanceEntry:alternate}},[draw],today);
 assert.equal(targets[key].drawDecision,'confirmed');assert.equal(targets[key].removedAt,undefined);assert.equal(targets[key].acceptanceEntry.acceptanceCode,'A');
 assert.equal(itfTargetEvidence({targets}).length,2);
});
const script=name=>new URL(name,import.meta.url).pathname;
async function fixture(fn){const root=await mkdtemp(join(tmpdir(),'cw-itf-confirmation-'));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
async function json(root,name,data){await mkdir(join(root,name,'..'),{recursive:true});await writeFile(join(root,name),JSON.stringify(data));}
test('concurrent acceptance publication cannot erase an existing begun draw confirmation',()=>fixture(async root=>{
 await json(root,'history/itf-confirmed-draw-recovery.json',{entries:[]});
 await json(root,'current.json',{targets:{[key]:{...draw,drawDecision:'confirmed',drawEntry:draw}},tournaments:{existing:{}}});
 await json(root,'incoming.json',{targets:{[key]:{...alternate,drawDecision:'pending'}},tournaments:{}});
 const run=spawnSync(process.execPath,[script('./merge-itf-draw-target-ownership.mjs'),'acceptance','current.json','incoming.json','out.json'],{cwd:root,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);const out=JSON.parse(await readFile(join(root,'out.json')));
 assert.equal(out.targets[key].drawDecision,'confirmed');assert.ok(out.tournaments.existing);
}));
test('real shard merge repairs an R2-restored stale target and protects it from a late withdrawal',()=>fixture(async root=>{
 await json(root,'history/itf-confirmed-draw-recovery.json',recovery);
 await json(root,'history/itf_draw_target_db.json',{targets:{[key]:{...alternate,drawDecision:'pending'}},tournaments:{}});
 await json(root,'dist/v3/source_itf_entries.json',{entries:[alternate]});
 await json(root,'dist/v3/shards/itf/acceptance-0.json',{status:'itf_acceptance_shard_complete',mode:'known_targets_fast',entries:[],withdrawals:[{...alternate,entryStatus:'withdrawn'}],errors:[],scannedTournamentIds:[]});
 await writeFile(join(root,'dist/v3/shards/itf/participants-0.json.gz'),gzipSync(JSON.stringify({participants:[]})));
 await writeFile(join(root,'history/itf_participant_cache.json.gz'),gzipSync(JSON.stringify({participants:[]})));
 const run=spawnSync(process.execPath,[script('./merge-itf-acceptance-shards.mjs')],{cwd:root,env:{...process.env,ITF_ACCEPTANCE_TOTAL:'1'},encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);const out=JSON.parse(await readFile(join(root,'dist/v3/source_itf_entries.json')));
 assert.equal(out.entries.length,1);assert.equal(out.entries[0].entryStatus,'draw_confirmed');
}));
test('first-load profile eligibility accepts restored entry without matches or deferred hydration',async()=>{
 const source=await readFile(new URL('../../v3.js',import.meta.url),'utf8');
 const ctx={iso:()=>today,Date,active:t=>!['withdrawn','excluded','eliminated'].includes(t.status)};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function tournamentConcluded'),source.indexOf('function groups(')),ctx);
 assert.equal(ctx.playerTournamentEligible(alternate),false);
 assert.equal(ctx.playerTournamentEligible(mergeConfirmedItfHistory([alternate],[draw],today)[0]),true);
});

test('automatic cancelled metadata cannot erase an already documented ITF presence',()=>{
 const rows=mergeConfirmedItfHistory([{...alternate,status:'cancelled'}],[draw],today);
 assert.equal(rows[0].status,'detected');assert.equal(rows[0].entryStatus,'draw_confirmed');
});

test('repeated target replay stays flat and a stale withdrawn status cannot hide confirmed presence',()=>{
 let targets={[key]:{...draw,drawDecision:'confirmed',drawEntry:draw,acceptanceEntry:alternate}};
 for(let n=0;n<100;n++)targets=preserveConfirmedItfTargets(targets,itfTargetEvidence({targets}),today);
 assert.equal(targets[key].drawEntry.drawEntry,undefined);assert.equal(targets[key].drawEntry.acceptanceEntry,undefined);
 assert.ok(JSON.stringify(targets).length<6000);
 assert.equal(mergeConfirmedItfHistory([{...alternate,status:'withdrawn'}],[draw],today)[0].status,'detected');
});
