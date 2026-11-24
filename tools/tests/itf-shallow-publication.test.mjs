import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
const merger=new URL('../../src/v3/merge-itf-draw-target-ownership.mjs',import.meta.url);
test('shallow ITF publisher preserves concurrent main updates and draw ownership after a rejected push',()=>{
 const root=mkdtempSync(join(tmpdir(),'cw-itf-shallow-'));
 const env={...process.env,GIT_AUTHOR_NAME:'Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid',GIT_CONFIG_NOSYSTEM:'1'};
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const save=(dir,name,value)=>writeFileSync(join(dir,name),typeof value==='string'?value:JSON.stringify(value));
 const initial={targets:{old:{id:'old'}},tournaments:{T:{draw:'initial'}},targetCount:1};
 try {
  const remote=join(root,'remote.git'),producer=join(root,'producer'),publisher=join(root,'publisher');mkdirSync(producer);
  git(root,'init','--bare',remote);git(producer,'init','-b','main');save(producer,'state.json',initial);save(producer,'other.txt','initial');git(producer,'add','.');git(producer,'commit','-m','base');git(producer,'remote','add','origin','file://'+remote);git(producer,'push','-u','origin','main');git(producer,'tag','unneeded-tag');git(producer,'push','origin','refs/tags/unneeded-tag');
  git(root,'clone','--depth','1','--single-branch','--no-tags','--branch','main','file://'+remote,publisher);
  assert.equal(git(publisher,'rev-parse','--is-shallow-repository'),'true');assert.equal(git(publisher,'tag'),'');
  const incoming={...initial,targets:{fresh:{id:'fresh'}}};save(root,'incoming.json',incoming);
  const remoteChange=version=>{save(producer,'state.json',{...initial,tournaments:{T:{draw:version}}});save(producer,'other.txt',version);git(producer,'add','.');git(producer,'commit','-m',version);git(producer,'push','origin','main');};
  const rebuild=()=>{
   git(publisher,'fetch','--no-tags','--depth=1','origin','+refs/heads/main:refs/remotes/origin/main');git(publisher,'reset','--hard','origin/main');
   assert.equal(git(publisher,'rev-list','--count','HEAD'),'1');save(root,'current.json',JSON.parse(readFileSync(join(publisher,'state.json'))));
   execFileSync(process.execPath,[merger.pathname,'acceptance',join(root,'current.json'),join(root,'incoming.json'),join(publisher,'state.json')],{env,stdio:'pipe'});
   git(publisher,'add','state.json');git(publisher,'commit','-m','validated acceptance');
  };
  remoteChange('concurrent-1');rebuild();remoteChange('concurrent-2');
  const rejected=spawnSync('git',['push','origin','HEAD:main'],{cwd:publisher,env,encoding:'utf8'});assert.notEqual(rejected.status,0);
  rebuild();git(publisher,'push','origin','HEAD:main');
  const state=JSON.parse(git(root,'--git-dir='+remote,'show','main:state.json'));
  assert.deepEqual(state.targets,incoming.targets);assert.deepEqual(state.tournaments,{T:{draw:'concurrent-2'}});assert.equal(git(root,'--git-dir='+remote,'show','main:other.txt'),'concurrent-2');
  assert.equal(git(publisher,'tag'),'');assert.equal(git(publisher,'rev-parse','HEAD^'),git(producer,'rev-parse','HEAD'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
