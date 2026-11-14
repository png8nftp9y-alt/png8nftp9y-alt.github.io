import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';

const verifier='cloudflare/app-api/scripts/verify-d1-new-feature-policy.mjs';
function verifyChangedSource(source,{committed=false}={}){
 const dir=mkdtempSync(join(tmpdir(),'cw-d1-policy-test-'));
 try{
  const script=join(dir,verifier);mkdirSync(dirname(script),{recursive:true});
  copyFileSync(new URL('../scripts/verify-d1-new-feature-policy.mjs',import.meta.url),script);
  const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});
  git('init','-q');git('config','user.name','Policy regression');git('config','user.email','policy@example.invalid');
  writeFileSync(join(dir,'feature.mjs'),'// baseline\n');git('add','.');git('commit','-qm','baseline');
  git('commit','--allow-empty','-qm','unchanged');
  writeFileSync(join(dir,'feature.mjs'),source+'\n');
  if(committed){git('add','feature.mjs');git('commit','-qm','feature');}
  const result=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
  return {status:result.status,output:result.stdout+result.stderr};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('official OOP search-field regex does not declare a D1 writer, including committed changes',()=>{
 const source=readFileSync(new URL('../../../src/v3/tennis-europe-oop-completeness.mjs',import.meta.url),'utf8');
 assert.match(source,/query\|filter\|search/);
 for(const committed of [false,true]){
  const result=verifyChangedSource(source,{committed});
  assert.equal(result.status,0,result.output);
  assert.match(result.output,/file D1 controllati: 0/);
 }
});
for(const source of [
 'await fetch(`${endpoint}/query`, {method:"POST"});',
 'await fetch("https://api.cloudflare.com/client/v4/accounts/a/d1/database/b/query", {method:"POST"});',
 'await fetch(`${endpoint}/query?trace=1`, {method:"POST"});',
 'await db.prepare(`INSERT\nINTO players VALUES (?)`).run();',
 'await db.prepare("UPDATE players SET name = ?").run();',
 'await db.prepare("DELETE FROM players").run();',
 'await db.prepare("REPLACE INTO players VALUES (?)").run();',
 'wrangler d1 execute app --remote --file import.sql',
])test('unguarded mutation remains blocked: '+source,()=>{
 const result=verifyChangedSource(source);
 assert.equal(result.status,1,result.output);
 assert.match(result.output,/D1 GLOBAL NEW FEATURE POLICY: BLOCCATA/);
 assert.match(result.output,/D1_WRITE_POLICY: incremental/);
});
