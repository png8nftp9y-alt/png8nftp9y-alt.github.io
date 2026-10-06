import test from 'node:test';import assert from 'node:assert/strict';
import {classifyTargets} from './prepare-itf-14-repair.mjs';
const id='TEST',q='G-S-Q-KO',m='G-S-M-KO',rr='G-S-M-RR';
const draw=(event,extra={})=>({competitionId:id,event,status:'complete',generatedAt:'2026-10-06T00:00:00Z',players:[{id:'1',name:'Player'}],matches:[{teams:[{players:[{id:'1',name:'Player'}]}]}],...extra});
const empty=()=>draw(q,{status:'retry',error:'draw_not_published_or_incomplete',players:[],matches:[{teams:[{players:[]}]}]});
const coverage=events=>({tournaments:[{competitionId:id,events:events.map(event=>({event,family:event.slice(0,5),structure:event.split('-').at(-1)}))}]});
test('safe empty Q resolved only with same-sex main, preserves original',()=>{const d=empty(),p=classifyTargets(coverage([m]),[d,draw(m)],[[id,q]]);assert.equal(p.resolved.length,1);assert.equal(p.selected.get(id+'|'+q),d);assert.equal(p.pending.length,0);});
test('technical response does not resolve Q',()=>{const p=classifyTargets(coverage([m]),[draw(q,{status:'retry',error:'HTTP timeout',players:[],matches:[{}]}),draw(m)],[[id,q]]);assert.equal(p.pending.length,1);});
test('RR must have all groups; KO cannot substitute',()=>{const bad=classifyTargets(coverage([m,rr]),[empty(),draw(m),draw(rr,{roundRobin:{declaredGroups:2,completeGroups:1,missingGroups:[2]}})],[[id,q]]);assert.equal(bad.pending.length,1);const ok=classifyTargets(coverage([m,rr]),[empty(),draw(rr,{roundRobin:{declaredGroups:2,completeGroups:2,missingGroups:[]}})],[[id,q]]);assert.equal(ok.resolved.length,1);});
test('empty doubles, wrong sex and missing inventory remain pending',()=>{assert.equal(classifyTargets(coverage([m]),[draw('G-D-M-KO',{players:[],matches:[{}]}),draw(m)],[[id,'G-D-M-KO']]).pending.length,1);assert.equal(classifyTargets(coverage(['B-S-M-KO']),[empty(),draw('B-S-M-KO')],[[id,q]]).pending.length,1);assert.equal(classifyTargets(coverage([]),[empty(),draw(m)],[[id,q]]).pending.length,1);});
test('complete source survives newer empty retry',()=>{const good=draw(q),p=classifyTargets(coverage([m]),[good,{...empty(),generatedAt:'2026-10-07T00:00:00Z'}],[[id,q]]);assert.equal(p.selected.get(id+'|'+q),good);assert.equal(p.resolved.length,0);});
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {gzipSync} from 'node:zlib';import {fileURLToPath} from 'node:url';import {documentRecord,verifyDocument} from './itf-draw-document-d1.mjs';
test('real prepare/build/finalize retains empty source hash; missing targets keep final check red',async()=>{
 const temp=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'itf14-'))),scripts=path.dirname(fileURLToPath(import.meta.url));
 try{
  await fs.mkdir(path.join(temp,'source'));const cid='J-J200-TUR-2026-002',sourceQ={...empty(),competitionId:cid},sourceM={...draw(m),competitionId:cid};
  await fs.writeFile(path.join(temp,'source/q.json.gz'),gzipSync(JSON.stringify(sourceQ)));await fs.writeFile(path.join(temp,'source/m.json.gz'),gzipSync(JSON.stringify(sourceM)));await fs.writeFile(path.join(temp,'coverage.json'),JSON.stringify({tournaments:[{competitionId:cid,events:[{event:m,family:'G-S-M',structure:'KO'}]}]}));
  const run=(file,args=[],env={})=>spawnSync(process.execPath,[path.join(scripts,file),...args],{cwd:temp,env:{...process.env,...env},encoding:'utf8'});
  const prep=run('prepare-itf-14-repair.mjs',['prepare','coverage.json','source','selected']);assert.equal(prep.status,0,prep.stderr);
  const build=run('build-itf-draw-d1-seed.mjs',['selected'],{ITF_D1_REQUIRED_ARCHIVE_ROOT:path.join(temp,'selected/resolved')});assert.equal(build.status,0,build.stderr);
  assert.equal(run('prepare-itf-14-repair.mjs',['finalize']).status,0);
  const a=JSON.parse(await fs.readFile(path.join(temp,'dist/v3/audits/itf-draw-d1-sync.json'))),row=a.documents.find(d=>d.event===q),original=documentRecord(sourceQ,{archiveEvidence:true});
  assert.equal(row.sha256,original.sha256);assert.equal(row.acquisitionState,'resolved_empty_qualification');assert.equal(a.archivedUnverified.length,0);assert.equal(a.pendingTasks.length,0);
  assert.equal(verifyDocument(row,{chunk_count:row.chunkCount,content_bytes:row.bytes,player_count:row.playerCount,match_count:row.matchCount},original.chunks.map((content,chunk_index)=>({content,chunk_index}))),true);
  await fs.writeFile(path.join(temp,'dist/v3/audits/itf-draw-d1-content-verification.json'),JSON.stringify({expectedDocuments:2,verifiedDocuments:2,missingOrCorrupt:[],status:'verified_saved_documents'}));assert.notEqual(run('prepare-itf-14-repair.mjs',['check']).status,0);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
