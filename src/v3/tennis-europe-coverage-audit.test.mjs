import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {auditDate,discoverAuditDraws,compareOfficialOop,validateCoverageShards} from './tennis-europe-coverage-audit.mjs';
import {resolveOopScope} from './tennis-europe-oop-scope.mjs';
const id='B63AC692-6B21-4BCE-BD55-0DDA745AFF30',base='https://te.tournamentsoftware.com';
const docs=()=>Array.from({length:16},(_,shard)=>({shard,total:16,queued:0,results:[],baselineSourceRunId:123,catalogGeneratedAt:'2026-11-03T23:47:13.871Z',today:'2026-11-03',cutoff:'2025-12-18',scope:'ended'}));
test('one frozen UTC day survives midnight; invalid or absent dates fail closed',()=>{
 assert.equal(auditDate('2026-11-03','2026-11-04T01:00:00Z'),'2026-11-03');
 assert.equal(auditDate('', '2026-11-03T23:59:59Z'),'2026-11-03');
 for(const v of ['2026-02-30','2026-1-3','wrong'])assert.throws(()=>auditDate(v,''));
 assert.throws(()=>auditDate('',undefined));
});
test('legacy relative draw links resolve against their listing, foreign tournaments remain excluded',()=>{
 const html=`<a href="draw.aspx?id=${id}&amp;draw=3">BS14 Main Draw</a><option value="draw.aspx?id=${id}&amp;draw=4">GS14 Main Draw</option><a href="https://evil.example/sport/draw.aspx?id=${id}&draw=5">BS14</a><a href="draw.aspx?id=OTHER&draw=6">BS14</a>`;
 assert.deepEqual(discoverAuditDraws(html,`${base}/sport/draws.aspx?id=${id}`,id).map(d=>d.number),['3','4']);
 assert.equal(discoverAuditDraws(`<a href="/tournament/${id}/draw/1">BS14</a>`,`${base}/tournament/${id}/draws`,id).length,1);
});
test('snapshot guard retains midnight, duplicate, missing and baseline failures',()=>{
 assert.deepEqual(validateCoverageShards(docs()),[]);
 let d=docs();d[15].today='2026-11-04';assert(validateCoverageShards(d).includes('inconsistent_baseline_or_scope'));
 d=docs();d[15].shard=16;assert(validateCoverageShards(d).includes('missing_or_invalid_shards'));
 d=docs();d[15].baselineSourceRunId=124;assert(validateCoverageShards(d).length);
 d=docs();d[0].queued=1;assert(validateCoverageShards(d).length);
 d=docs();for(const n of [0,1]){d[n].queued=1;d[n].results=[{competitionId:id}];}assert(validateCoverageShards(d).includes('repeated_or_missing_tournament'));
});
const retirement=()=>({id:'ret',competitionId:id,event:'BS14 Main Draw',round:'Round of 32',date:'2026-08-31',drawUrl:`${base}/tournament/${id}/draw/1`,sourceUrl:`${base}/tournament/${id}/matches/20260831`,players:[{id:'17',name:'Leon Miarka'},{id:'16',name:'Richard Mrazek'}],teams:[['17'],['16']],winnerPlayerIds:[],score:'7-6 4-6 2-5',status:'completed',retired:true,retirementSource:'official_match_message'});
const next=()=>({...retirement(),id:'next',round:'Round of 16',date:'2026-09-01',sourceUrl:`${base}/tournament/${id}/matches/20260901`,players:[{id:'1',name:'Leidolf'},{id:'16',name:'Richard Mrazek'}],teams:[['1'],['16']],retired:false,winnerTeamIndex:1,winnerPlayerIds:['16'],score:'2-6 6-7'});
test('retirement winner uses independent later round; stored winner cannot resolve absent official evidence',()=>{
 const old=retirement(),later=next(),stored=[{...old,winnerTeamIndex:1,winnerPlayerIds:['16']},later];
 assert.equal(compareOfficialOop({competitionId:id},[],[old,later],stored).conflicts.length,0);
 assert.equal(old.winnerPlayerIds.length,0);
 const unresolved=compareOfficialOop({competitionId:id},[],[old],stored);assert.equal(unresolved.issues.length,1);assert.equal(unresolved.conflicts.length,1);
 const wrong={...later,drawUrl:`${base}/tournament/${id}/draw/2`};assert.equal(compareOfficialOop({competitionId:id},[],[old,wrong],stored).issues.length,1);
});
test('missing OOPs and wrong results remain visible; explicit empty day creates no fictitious match',()=>{
 const m=next();assert.equal(compareOfficialOop({competitionId:id},[],[m],[]).missing.length,1);
 assert.equal(compareOfficialOop({competitionId:id},[],[m],[{...m,score:'6-0 6-0'}]).conflicts.length,1);
 assert.deepEqual(compareOfficialOop({competitionId:id},[{date:'20260901',cards:[],explicitEmpty:true}],[],[]),{missing:[],conflicts:[],issues:[]});
});
test('scope requires no published days and source-confirmed cancellations',async()=>{
 const team={competitionId:id,tournamentName:'Winter Cups'};
 assert.equal((await resolveOopScope(team,[],()=>{throw Error('unused')})).status,'deferred_team');
 assert.equal(await resolveOopScope(team,['20260901'],()=>{throw Error('unused')}),null);
 const canceled={competitionId:'B7087FEB-72B4-47FF-89B9-C6C514A852E9'};
 assert.equal((await resolveOopScope(canceled,[],async()=>'<span>Cancelled</span>')).status,'cancelled');
 await assert.rejects(()=>resolveOopScope(canceled,[],async()=>'<span>Active</span>'));
 assert.equal(await resolveOopScope({competitionId:id},[],()=>{throw Error('unused')}),null);
});
test('invalid shard set writes diagnostic artifacts and still exits nonzero',async()=>{
 const cwd=await mkdtemp(path.join(tmpdir(),'cw-coverage-'));
 try{await mkdir(path.join(cwd,'coverage-shards'));const d=docs();d[15].today='2026-11-04';for(const x of d)await writeFile(path.join(cwd,'coverage-shards',`coverage-${x.shard}.json`),JSON.stringify(x));
 const run=spawnSync(process.execPath,[new URL('./merge-tennis-europe-coverage.mjs',import.meta.url).pathname],{cwd,encoding:'utf8'});
 assert.notEqual(run.status,0);const report=JSON.parse(await readFile(path.join(cwd,'coverage-report/coverage.json'),'utf8'));assert.equal(report.status,'invalid');assert(report.errors.includes('inconsistent_baseline_or_scope'));assert.match(await readFile(path.join(cwd,'coverage-report/coverage.md'),'utf8'),/Certificazione rifiutata/);
 }finally{await rm(cwd,{recursive:true,force:true});}
});

test('Not scheduled recovery is compared after all source days, with no invented date',()=>{
 const m=next(),t={competitionId:id,startDate:'2026-08-30',endDate:'2026-09-05'};
 const card={...m,date:'20260901',winnerIds:['16'],sourceHash:'a'.repeat(64)};
 const one=[{date:'20260901',cards:[card]}];
 const c=compareOfficialOop(t,one,[],[]);assert.equal(c.missing.length,1);assert.equal(c.missing[0].date,'2026-09-01');assert.equal(c.missing[0].court,'');
 assert.equal(compareOfficialOop(t,one,[],[m]).missing.length,0);
 const ambiguous=[...one,{date:'20260902',cards:[{...card,date:'20260902'}]}];
 assert.equal(compareOfficialOop(t,ambiguous,[],[]).missing.length,0); // independent inventory still flags absence; no guessed date.
});
