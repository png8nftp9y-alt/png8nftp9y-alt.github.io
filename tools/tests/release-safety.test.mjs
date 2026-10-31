import './ensure-release-safety.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {releaseCodeFingerprint,verifyCertificate} from '../release-code-fingerprint.mjs';
const root=new URL('../../',import.meta.url);
test('only exact tested code may reuse approval; ordinary data updates retain it',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-safety-'));
 try{
  const put=(p,v)=>{fs.mkdirSync(path.dirname(path.join(dir,p)),{recursive:true});fs.writeFileSync(path.join(dir,p),v);};
  put('v3.js','app');put('cloudflare/app-api/src/index.js','worker');put('dist/data.json','old');put('.github/workflows/deploy.yml','guard');put('package-lock.json','deps');
  execFileSync('git',['init','-q'],{cwd:dir});execFileSync('git',['add','.'],{cwd:dir});
  const initial=releaseCodeFingerprint(dir);put('dist/data.json','new');assert.equal(releaseCodeFingerprint(dir),initial);
  for(const p of ['v3.js','cloudflare/app-api/src/index.js','.github/workflows/deploy.yml','package-lock.json']){const old=fs.readFileSync(path.join(dir,p));put(p,'changed');assert.notEqual(releaseCodeFingerprint(dir),initial,p);put(p,old);}
  put('verified.json',JSON.stringify({version:1,passed:true,fingerprint:initial}));assert.equal(verifyCertificate(dir,initial).passed,true);assert.throws(()=>verifyCertificate(dir,'different'));put('verified.json',JSON.stringify({version:1,passed:false,fingerprint:initial}));assert.throws(()=>verifyCertificate(dir,initial));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('every app Worker publisher waits for safety and checks code before publication',()=>{
 for(const name of ['cloudflare-app-hotfix','cloudflare-app-api','tennis-europe-agenda','tennis-europe-rankings']){
  const s=fs.readFileSync(new URL('.github/workflows/courtwatch-'+name+'.yml',root),'utf8');
  assert.match(s,/uses: .\/.github\/workflows\/courtwatch-release-safety.yml/);
  const writer=s.slice(s.indexOf('    needs: [check-source, release-safety]'));
  assert.ok(writer.length>0);assert.match(writer,/with: \{ref: main, fetch-depth: 2\}/);assert.ok(writer.includes('node tools/ensure-release-safety.mjs --expect'));const check=writer.indexOf('--expect "${{ needs.release-safety.outputs.code_fingerprint }}"');assert.ok(check>0);
  for(const mutation of ['wrangler deploy','sync-runtime-documents-d1.mjs','configure-d1.mjs'])if(writer.includes(mutation))assert.ok(check<writer.indexOf(mutation),name+' '+mutation);
 }
});
test('approval is saved only after Shield and both real group browser checks',()=>{
 const s=fs.readFileSync(new URL('.github/workflows/courtwatch-release-safety.yml',root),'utf8');
 for(const phase of ['local','live']){const check=s.indexOf('node tools/run-release-safety.mjs --phase '+phase);assert.ok(check>0&&check<s.indexOf('--write-certificate'));}
 const runner=fs.readFileSync(new URL('tools/run-release-safety.mjs',root),'utf8');
 for(const check of ['courtwatch-functional-shield.mjs',"COURTWATCH_REPLAY_GROUP:'main'",'verify-others-real-snapshot-browser.mjs','verify-player-group-release-browser.mjs'])assert.ok(runner.includes(check));
 assert.match(s,/--expect .* --write-certificate/);assert.doesNotMatch(s,/restore-keys:|schedule:|workflow_dispatch:/);
 assert.match(s,/path: artifacts\/courtwatch-\*\.json/);
});
