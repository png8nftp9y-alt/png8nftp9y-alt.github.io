import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync,spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url)),guard=path.join(root,'tools/courtwatch-release-guard.mjs');
function fixture(before,after,{asset='v3.js',changeHtml=true}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'courtwatch-cache-guard-'));
 const write=(name,s)=>{const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,s);};
 const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});
 const commit=()=>{git('add','-f','.');git('-c','user.name=Cache Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','-qm','fixture');};
 write('.courtwatch/release-baseline.json',JSON.stringify({stableCommit:'fixture',requiredDomIds:[],requiredAssetVersions:['v3.js?v='],minimums:{players:1,tournaments:0,agenda:0,byCircuit:{}}}));
 write('v3.js',fs.readFileSync(path.join(root,'v3.js'),'utf8'));write('v3.css','body{}');
 const html=v=>`<html><script src="v3.js?v=${asset==='v3.js'?v:'1'}"></script><link href="v3.css?v=${asset==='v3.css'?v:'1'}"></html>`;
 write('v3.html',html(before));write('dist/v3/players.json',JSON.stringify({players:[{id:'p',name:'Player'}]}));write('dist/v3/tournaments.json','{"tournaments":[]}');write('dist/v3/agenda.json','{"agenda":[]}');
 git('init','-q');commit();write(asset,fs.readFileSync(path.join(dir,asset),'utf8')+'\n/* asset changed */\n');if(changeHtml)write('v3.html',html(after));write('docs/CourtWatch_v3_handoff_report.md','Fixture evidence');commit();
 return{dir,run(file=guard){const result=spawnSync(process.execPath,[file],{cwd:dir,encoding:'utf8'});return{status:result.status,report:JSON.parse(fs.readFileSync(path.join(dir,'artifacts/courtwatch-release-guard.json'),'utf8'))};},close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('real guard accepts adjacent 19-digit revisions; old Number implementation reproduces the failed deployment',()=>{
 const f=fixture('1793578378465339000-fix','1793578378465339001-fix');try{
  assert.equal(Number('1793578378465339000'),Number('1793578378465339001'));
  const old=path.join(f.dir,'tools/old-guard.mjs');fs.mkdirSync(path.dirname(old),{recursive:true});fs.writeFileSync(old,fs.readFileSync(guard,'utf8').replace('=>BigInt(','=>Number('));fs.copyFileSync(path.join(root,'tools/courtwatch-refresh-contract.mjs'),path.join(f.dir,'tools/courtwatch-refresh-contract.mjs'));
  const broken=f.run(old);assert.equal(broken.status,1);assert.equal(broken.report.results.find(r=>r.name==='cache-v3.js').status,'fail');
  const fixed=f.run();assert.equal(fixed.status,0);assert.equal(fixed.report.results.find(r=>r.name==='cache-v3.js').status,'pass');
 }finally{f.close();}
});
test('unchanged or decreased numeric revisions remain blocked even when suffix changes',()=>{for(const [before,after]of [['1793578378465339001-a','1793578378465339001-b'],['1793578378465339001','1793578378465339000']]){const f=fixture(before,after);try{assert.equal(f.run().status,1);}finally{f.close();}}});
test('an asset change without HTML cache update remains blocked',()=>{const f=fixture('100','101',{changeHtml:false});try{assert.equal(f.run().status,1);}finally{f.close();}});
test('large CSS revisions and ordinary numeric JS revisions use the same strict guard',()=>{for(const [before,after,asset]of [['1793578378465339000','1793578378465339001','v3.css'],['2026110200','2026110201','v3.js']]){const f=fixture(before,after,{asset});try{assert.equal(f.run().status,0);}finally{f.close();}}});

test('shared release safety executes the real cache regression before the guard and retains Shield/live checks',async()=>{const {runReleaseSafety}=await import('../run-release-safety.mjs'),calls=[];runReleaseSafety('all',{run:(command,args,env)=>calls.push({command,args,env})});const at=calls.findIndex(c=>c.args.includes('tools/tests/release-cache-version.test.mjs')),guardAt=calls.findIndex(c=>c.args.includes('tools/courtwatch-release-guard.mjs'));assert.ok(at>=0&&at<guardAt);assert.ok(calls.some(c=>c.args.includes('tools/courtwatch-functional-shield.mjs')));assert.equal(calls.filter(c=>c.args.includes('tools/replay-others-real-snapshot.mjs')).length,2);assert.ok(calls.some(c=>c.args.includes('tools/verify-player-group-release-browser.mjs')));});

test('data JSON is not JavaScript; source still requires report',()=>{
 for(const name of ['players.json','tournaments.json','players.js','players.mjs','cloudflare/app-api/lib/example.mjs']){
  const f=fixture('100','101');
  try{
   const target=path.join(f.dir,name);
   fs.mkdirSync(path.dirname(target),{recursive:true});
   fs.writeFileSync(target,name.endsWith('.json')?'{}':'// changed source');
   const git=(...args)=>execFileSync('git',args,{cwd:f.dir,stdio:'pipe'});
   git('add','-f',name);
   git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid',
       '-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null',
       'commit','-qm','change without report');
   const result=f.run();
   assert.equal(result.report.results.find(r=>r.name==='report-same-commit').status,
                name.endsWith('.json')?'pass':'fail',name);
   assert.equal(result.status,name.endsWith('.json')?0:1,name);
  }finally{f.close();}
 }
});
