import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=new URL('../../../',import.meta.url);
const plan=new URL('src/v3/itf-draw-d1-work-plan.mjs',root).pathname;
const verify=new URL('src/v3/verify-itf-draw-documents-d1.mjs',root).pathname;
function fixture(audit,check){
 const dir=mkdtempSync(path.join(tmpdir(),'cw-itf-empty-'));
 try{mkdirSync(path.join(dir,'dist/v3/audits'),{recursive:true});writeFileSync(path.join(dir,'dist/v3/audits/itf-draw-d1-sync.json'),JSON.stringify(audit));
 const env={...process.env,GITHUB_OUTPUT:path.join(dir,'outputs'),CLOUDFLARE_ACCOUNT_ID:'',CLOUDFLARE_API_TOKEN:''};
 check({dir,run:file=>spawnSync(process.execPath,[file],{cwd:dir,env,encoding:'utf8'})});
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('pending-only work needs neither a D1 configuration nor credentials and reports zero verified documents',()=>{
 fixture({scope:'pending',documents:[],storedDocuments:0,sqlFiles:0,archiveMissing:[]},({dir,run})=>{
  const planned=run(plan);assert.equal(planned.status,0,planned.stderr);assert.equal(readFileSync(path.join(dir,'outputs'),'utf8'),'has_documents=false\n');
  const checked=run(verify);assert.equal(checked.status,0,checked.stderr);
  const report=JSON.parse(readFileSync(path.join(dir,'dist/v3/audits/itf-draw-d1-content-verification.json')));
  assert.equal(report.status,'no_complete_documents');assert.equal(report.expectedDocuments,0);assert.equal(report.verifiedDocuments,0);assert.equal(report.fullPeriodCertified,false);
 });
});
test('saved documents still require D1 configuration and cannot silently take the empty path',()=>{
 fixture({documents:[{drawKey:'T|B-S-M-KO',sha256:'hash'}],storedDocuments:1,sqlFiles:1},({dir,run})=>{
  assert.equal(run(plan).status,0);assert.equal(readFileSync(path.join(dir,'outputs'),'utf8'),'has_documents=true\n');
  const checked=run(verify);assert.notEqual(checked.status,0);
  const report=JSON.parse(readFileSync(path.join(dir,'dist/v3/audits/itf-draw-d1-content-verification.json')));assert.equal(report.status,'failed');assert.equal(report.expectedDocuments,1);
 });
});
for(const audit of [{documents:[],storedDocuments:0,sqlFiles:1},{documents:[{}],storedDocuments:1,sqlFiles:0},{documents:[],storedDocuments:0,sqlFiles:0,archiveMissing:['T|B-S-M-KO']}])test('an inconsistent work manifest cannot bypass persistence: '+JSON.stringify(audit),()=>fixture(audit,({run})=>assert.notEqual(run(plan).status,0)));
