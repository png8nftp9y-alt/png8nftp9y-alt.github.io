import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RUNTIME_DOCUMENT_FILES} from '../lib/runtime-document-plan.mjs';
const read=name=>readFileSync(new URL('../../../.github/workflows/'+name,import.meta.url),'utf8');
const common=read('courtwatch-cloudflare-app-api.yml'),runtime=read('courtwatch-runtime-documents-d1.yml'),agenda=read('courtwatch-tennis-europe-agenda.yml'),hotfix=read('courtwatch-cloudflare-app-hotfix.yml');
const completions=s=>(s.match(/^  workflow_run:\n([\s\S]*?)(?=^  \w+:|^permissions:)/m)?.[1].match(/^      - .+$/gm)||[]).map(x=>x.slice(8));
const paths=s=>(s.match(/^  push:\n([\s\S]*?)(?=^\w|^  \w+:)/m)?.[1].match(/^      - '[^']+'$/gm)||[]).map(x=>x.slice(9,-1));
function matches(pattern,file){return new RegExp('^'+pattern.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(file);}
function owns(source,file){let matched=false;for(const pattern of paths(source)){if(matches(pattern.replace(/^!/,''),file))matched=!pattern.startsWith('!');}return matched;}
test('shared FITP, Europe and ITF producer completions have exactly one runtime publisher, with native metadata coverage retained',()=>{
 const a=completions(common),b=completions(runtime);assert.equal(a.length,12);assert.ok(b.length>=6);
 assert.deepEqual(a.filter(name=>b.includes(name)),[]);
 for(const name of ['Court Watch ITF Meta engine','Court Watch future ITF tournament metadata acquisition','Court Watch v3 ITF T-1 complete draws','Court Watch ITF incremental catalog and diagnostics'])assert.ok(b.includes(name),name);
 assert.match(common,/run: node scripts\/sync-runtime-documents-d1.mjs/);
});
test('each of the 23 runtime data paths retains exactly one push publisher without polling',()=>{
 for(const file of RUNTIME_DOCUMENT_FILES)assert.equal([common,runtime,agenda].filter(s=>owns(s,file)).length,1,file);
 assert.doesNotMatch(runtime,/^  schedule:|cron:/m);
});
test('Worker-only changes use the hotfix deployment instead of starting a general database rebuild too',()=>{
 for(const file of ['cloudflare/app-api/src/index.js','cloudflare/app-api/test/example.test.mjs','cloudflare/app-api/scripts/prepare-runtime-assets.mjs','v3.js','flags/it.svg']){assert.ok(owns(hotfix,file),file);assert.equal(owns(common,file),false,file);}
 assert.ok(owns(common,'cloudflare/app-api/lib/d1-incremental-sync.mjs'));
 assert.ok(owns(common,'cloudflare/app-api/migrations/0999_future.sql'));
 assert.ok(owns(common,'cloudflare/app-api/scripts/generate-seed.mjs'));
});
test('the general publishing owner retains runtime verification and compatible Worker deployment',()=>{
 assert.match(common,/Verify D1 runtime content before the early Worker deployment/);
 assert.match(common,/Deploy read-compatible Worker before database maintenance/);
 assert.match(common,/Verify fresh D1 runtime release before deployment/);
 assert.match(common,/Verify live API and legacy app parity/);
 const final=common.slice(common.indexOf('      - name: Verify fresh D1 runtime release before deployment\n')).split(/\n      - /)[0];assert.doesNotMatch(final,/\n        if:/);assert.match(final,/sync-runtime-documents-d1.mjs/);
});
test('identity and search tests run before their writer lease and changed code is still rechecked against fresh main',()=>{
 for(const [file,job] of [['courtwatch-acquired-player-search.yml','index'],['courtwatch-acceptance-player-profiles.yml','profiles']]){
  const s=read(file),checks=s.slice(s.indexOf('  check-source:\n'),s.indexOf('  '+job+':\n')),writer=s.slice(s.indexOf('  '+job+':\n'));
  assert.match(checks,/node --test/);assert.doesNotMatch(checks,/group: courtwatch-d1-writes/);
  assert.match(writer,/needs: check-source/);assert.match(writer,/group: courtwatch-d1-writes/);assert.match(writer,/ref: main, fetch-depth: 1/);
  assert.match(writer,/CHECKED_SHA: \$\{\{ needs.check-source.outputs.source_sha \}\}/);assert.match(writer,/if ! git diff --quiet "\$CHECKED_SHA" HEAD/);
  assert.ok(writer.indexOf('Recheck source only when code advanced')<writer.indexOf('node scripts/configure-d1.mjs'));
 }
});

test('Node seed/diagnostic helpers retain the required owner without redundant Worker deploys',()=>{
 for(const file of ['cloudflare/app-api/lib/read-only-d1-client.mjs','cloudflare/app-api/lib/tournament-seed-statements.mjs','cloudflare/app-api/lib/seed-statement-plan.mjs']){assert.equal(owns(hotfix,file),false,file);assert.equal(owns(common,file),true,file);}
 assert.equal(owns(hotfix,'cloudflare/app-api/test/read-only-d1-client.test.mjs'),false);
 for(const file of ['cloudflare/app-api/scripts/github-d1-audit-scope.mjs','cloudflare/app-api/scripts/read-audit-projection.mjs'])assert.equal(owns(common,file),false,file);
 for(const file of ['cloudflare/app-api/lib/courtwatch-player-additions.mjs','cloudflare/app-api/src/index.js'])assert.equal(owns(hotfix,file),true,file);
});
