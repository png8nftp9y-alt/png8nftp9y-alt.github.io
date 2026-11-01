import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('CI mirror repair handles both Ubuntu source formats without changing suites, components or other vendors',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'courtwatch-apt-'));
 try {
  mkdirSync(path.join(dir,'sources.list.d'));
  const legacy='deb http://azure.archive.ubuntu.com/ubuntu/ noble-updates main universe\n';
  const modern='Types: deb\nURIs: http://azure.archive.ubuntu.com/ubuntu\nSuites: noble noble-updates noble-backports noble-security\nComponents: main universe\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n';
  const vendor='deb https://packages.microsoft.com/repos/azure-cli/ noble main\n';
  writeFileSync(path.join(dir,'sources.list'),legacy);
  writeFileSync(path.join(dir,'sources.list.d','ubuntu.sources'),modern);
  writeFileSync(path.join(dir,'sources.list.d','vendor.list'),vendor);
  const run=()=>execFileSync('python3',['tools/prepare-ci-browser-apt.py','--apt-dir',dir],{encoding:'utf8'});
  assert.match(run(),/updated: 2/);
  assert.equal(readFileSync(path.join(dir,'sources.list'),'utf8'),legacy.replace('http://azure.archive.ubuntu.com','https://archive.ubuntu.com'));
  assert.equal(readFileSync(path.join(dir,'sources.list.d','ubuntu.sources'),'utf8'),modern.replace('http://azure.archive.ubuntu.com','https://archive.ubuntu.com'));
  assert.equal(readFileSync(path.join(dir,'sources.list.d','vendor.list'),'utf8'),vendor);
  const before=statSync(path.join(dir,'sources.list')).mtimeMs;
  assert.match(run(),/updated: 0/);assert.equal(statSync(path.join(dir,'sources.list')).mtimeMs,before);
  assert.match(readFileSync(path.join(dir,'apt.conf.d','99courtwatch-browser-network'),'utf8'),/Acquire::Retries "0"/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('both Shield entry points retain mandatory browser checks and bound browser installation',()=>{
 for(const file of ['courtwatch-release-safety.yml','courtwatch-shield.yml']){
  const text=readFileSync('.github/workflows/'+file,'utf8');
  assert.match(text,/timeout-minutes: 5\n(?:[^\n]*\n){0,3}\s+run: \|\n\s+sudo python3 tools\/prepare-ci-browser-apt.py/);
  assert.match(text,/npx playwright install --with-deps chromium/);
  assert.doesNotMatch(text,/continue-on-error:\s*true/);
 }
});
