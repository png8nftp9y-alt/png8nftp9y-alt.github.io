import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url),read=file=>readFileSync(new URL(file,root),'utf8');
const routes=JSON.parse(readFileSync(new URL('./engine-d1-routes.json',import.meta.url),'utf8'));
test('every acquisition motor retains D1 publication, with general imports consolidated after verified Europe Agenda',()=>{
 for(const route of routes){
  const producer=read('.github/workflows/'+route.producer),bridge=read('.github/workflows/'+route.bridge),name=producer.match(/^name: (.+)$/m)?.[1];
  assert.ok(name,route.id+': missing producer name');
  const completion=bridge.match(/^  workflow_run:\n([\s\S]*?)(?=^  [a-z_]+:|^permissions:|^jobs:)/m)?.[1]||'';
  if(route.bridge==='courtwatch-cloudflare-app-api.yml'){
   const triggers=(completion.match(/^      - .+$/gm)||[]).map(line=>line.slice(8));
   assert.deepEqual(triggers,['Court Watch Tennis Europe agenda D1'],route.id+': general imports must follow only Agenda');
   const writer=bridge.slice(bridge.indexOf('  migrate-import-verify-deploy:'));
   const checkout=writer.match(/with: \{ref: main, fetch-depth: (\d+)\}/);
   assert.ok(checkout,route.id+': consolidation must read current data after the writer lease');
   assert.ok(Number(checkout[1])>=2,route.id+': release guard must have HEAD^ available');
  }else assert.ok(completion.includes(name),route.id+': no explicit D1 completion bridge for '+name);
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
test('D1 runtime publication remains completion-driven without a periodic schedule',()=>{
 for(const file of ['courtwatch-runtime-documents-d1.yml']){
  const source=read('.github/workflows/'+file),triggers=source.split('permissions:')[0];
  assert.doesNotMatch(triggers,/^  schedule:/m,file+': polling');assert.match(triggers,/workflow_run:/);
  assert.match(source,/ref: main/);assert.match(source,/queue: single/);
 }
});

test('general D1 follows successful Europe Agenda and has no autonomous periodic timer',()=>{
 const general=read('.github/workflows/courtwatch-cloudflare-app-api.yml');
 const header=general.split('permissions:')[0];
 assert.doesNotMatch(header,/^  schedule:|cron:/m);
 assert.match(header,/^  workflow_dispatch:/m);assert.match(header,/^  push:/m);
 assert.match(general,/github.event.workflow_run.conclusion == 'success'/);
 const agenda=read('.github/workflows/courtwatch-tennis-europe-agenda.yml');
 assert.match(agenda,/Court Watch Tennis Europe OOP and results live/);
 assert.match(agenda,/github.event.workflow_run.conclusion == 'success'/);
 assert.match(general,/node src\/v3\/build-universal-database.mjs/);
 assert.match(general,/node scripts\/sync-runtime-documents-d1.mjs/);
});

test('acquired index has only the user-approved hourly schedule and manual entrypoint',()=>{
 const source=read('.github/workflows/courtwatch-acquired-player-search.yml'),header=source.split('permissions:')[0];
 assert.doesNotMatch(header,/^  schedule:/m);assert.match(header,/Dispatched hourly at minute 17/);
 assert.equal((header.match(/cron:/g)||[]).length,0);
 assert.doesNotMatch(header,/^  (workflow_run|push):/m);assert.match(header,/^  workflow_dispatch:/m);
 assert.match(source,/group: courtwatch-acquired-search\n/);assert.match(source,/queue: single/);
 assert.match(source,/group: courtwatch-d1-writes\n      cancel-in-progress: false\n      queue: max/);
});
