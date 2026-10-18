import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url),read=file=>readFileSync(new URL(file,root),'utf8');
const routes=JSON.parse(readFileSync(new URL('./engine-d1-routes.json',import.meta.url),'utf8'));
test('each acquisition motor has an explicit completion route to its D1 importer without relying on bot push events',()=>{
 for(const route of routes){
  const producer=read('.github/workflows/'+route.producer),bridge=read('.github/workflows/'+route.bridge),name=producer.match(/^name: (.+)$/m)?.[1];
  assert.ok(name,route.id+': missing producer name');
  const completion=bridge.match(/^  workflow_run:\n([\s\S]*?)(?=^  [a-z_]+:|^permissions:|^jobs:)/m)?.[1]||'';
  assert.ok(completion.includes(name),route.id+': no explicit D1 completion bridge for '+name);
  const packageScripts=JSON.parse(read('cloudflare/app-api/package.json')).scripts;
  assert.ok(bridge.includes(route.script)||(bridge.includes('npm run seed')&&packageScripts.seed.includes(route.script)),route.id+': missing importer');
  assert.ok(read('cloudflare/app-api/'+route.reader).length>0,route.id+': missing app reader');
 }
 const common=read('.github/workflows/courtwatch-cloudflare-app-api.yml');
 assert.ok(!common.match(/^  workflow_run:\n([\s\S]*?)(?=^  [a-z_]+:)/m)?.[1].includes('Court Watch Cloudflare D1 and app API'),'importer must not recursively trigger itself');
 assert.match(common,/queue: single/);assert.match(common,/D1_SKIP_OBSERVED:/);
});
test('ITF draw, metadata and ranking motors retain explicit direct D1 writes and the app reads those tables',()=>{
 for(const [file,script] of [['courtwatch-itf-draw-d1-sync.yml','verify-itf-draw-documents-d1.mjs'],['courtwatch-itf-draw-d1-backfill.yml','verify-itf-draw-documents-d1.mjs'],['courtwatch-itf-meta-engine.yml','sync-itf-metadata-d1.mjs'],['courtwatch-all-itf-metadata.yml','sync-itf-metadata-d1.mjs'],['courtwatch-tennis-europe-rankings.yml','rankings-*.sql'],['courtwatch-tennis-europe-ranking-history.yml','rankings-*.sql']])assert.ok(read('.github/workflows/'+file).includes(script),file+': missing D1 persistence');
 const draws=read('.github/workflows/courtwatch-v3-itf-t-minus-one.yml');assert.match(draws,/uses: \.\/.github\/workflows\/courtwatch-itf-draw-d1-sync.yml/);
 assert.match(read('cloudflare/app-api/lib/personal-tennis-europe-history.mjs'),/match_participants/);
 assert.match(read('cloudflare/app-api/src/index.js'),/tennis_europe_ranking_history/);
});
test('motor runs resolve main at start and keep one code revision across their acquisition shards',()=>{
 for(const file of new Set([...routes.map(route=>route.producer),'courtwatch-tennis-europe-ranking-history.yml','courtwatch-tennis-europe-oop-backfill.yml'])){
  const source=read('.github/workflows/'+file);
  const checkouts=[...source.matchAll(/uses: actions\/checkout@[^\n]+\n([\s\S]*?)(?=^      - |$(?![\s\S]))/gm)];
  assert.ok(checkouts.length,file+': checkout missing');
  for(const checkout of checkouts)assert.match(checkout[1],/ref: (?:main\b|"?\$\{\{ needs.engine-source.outputs.sha \}\})/,file+': event SHA can execute stale engine code');
  if(source.includes('needs.engine-source.outputs.sha')){assert.match(source,/engine-source:\n[\s\S]*?ref: main/);assert.match(source,/sha: \$\{\{ steps.source.outputs.sha \}\}/);}
 }
});
test('D1 runtime publication and acquired indexing are completion-driven without polling schedules',()=>{
 for(const file of ['courtwatch-runtime-documents-d1.yml','courtwatch-acquired-player-search.yml']){
  const source=read('.github/workflows/'+file),triggers=source.split('permissions:')[0];
  assert.doesNotMatch(triggers,/^  schedule:/m,file+': polling');assert.match(triggers,/workflow_run:/);
  assert.match(source,/ref: main/);assert.match(source,/queue: single/);
 }
});
