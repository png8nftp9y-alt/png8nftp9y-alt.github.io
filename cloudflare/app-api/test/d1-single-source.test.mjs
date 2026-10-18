import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {storedPresentationLoaders} from '../lib/personal-tournament-presentation.mjs';
import './runtime-publishers.test.mjs';
import './engine-d1-routing.test.mjs';
import './itf-automatic-d1-persistence.test.mjs';
import './opponent-entry-current-source.test.mjs';
import './courtwatch-acceptance-player-profiles.test.mjs';
import {prepareRuntimeAssets} from '../scripts/prepare-runtime-assets.mjs';
const read=p=>readFileSync(new URL('../../../'+p,import.meta.url),'utf8');
test('player/opponent enrichment reads stored D1 documents even when network is forbidden',async()=>{
 const requested=[],old=globalThis.fetch;globalThis.fetch=()=>{throw Error('HTTP forbidden')};
 try{const loaders=storedPresentationLoaders({get:async path=>{requested.push(path);return path.startsWith('history/')?{tournaments:{EXACT:{venueName:'Official saved club'}}}:{tournaments:[{competitionId:'EXACT',circuit:'itf',location:'Saved city'}]};}});
 const map=await loaders.itf();assert.equal(map.get('itf|EXACT').venueName,'Official saved club');assert.equal(requested.length,4);
 await assert.rejects(storedPresentationLoaders({get:async()=>{throw Error('corrupt D1')}}).itf(),/corrupt D1/);
 }finally{globalThis.fetch=old;}
});
test('browser documents and app shell are same-origin Cloudflare; deploy is gated by verified D1 content',async()=>{
 const ui=read('v3.js'),html=read('v3.html'),worker=read('cloudflare/app-api/src/index.js');
 assert.match(ui,/const V3 = location.origin \+ "\/app\/api\/documents\/"/);assert.ok(!html.includes('github.io/dist/v3/'));
 assert.ok(!worker.includes('raw.githubusercontent.com'));assert.ok(!worker.includes('PUBLIC_APP'));
 assert.ok(worker.includes('env.ASSETS.fetch'));assert.ok(worker.includes('FRONTEND_DOCUMENTS.has(name)'));
 for(const path of ['.github/workflows/courtwatch-cloudflare-app-api.yml','.github/workflows/courtwatch-cloudflare-app-hotfix.yml','.github/workflows/courtwatch-tennis-europe-agenda.yml','.github/workflows/courtwatch-tennis-europe-rankings.yml']){
  const code=read(path);assert.match(code,/uses: actions\/checkout@v4\s+with: \{ref: main, fetch-depth: 1\}/);assert.ok(code.indexOf('run: node scripts/sync-runtime-documents-d1.mjs')<code.indexOf('npx wrangler deploy --minify'));
 }
 const dir=await prepareRuntimeAssets();assert.ok(readFileSync(dir+'v3.html','utf8').includes('<html'));
});

import worker from '../src/index.js';
import {database} from './search-sqlite-fixture.mjs';
import {verifyRuntimeAppReaders} from '../lib/verify-runtime-app-readers.mjs';
test('real authenticated document endpoint serves D1 and app shell comes from ASSETS with HTTP forbidden',async()=>{
 const fixture=database({identityMapping:true}),old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Network forbidden')};
 const headers={'Cf-Access-Authenticated-User-Email':'federico181099@gmail.com'};
 try{
  const response=await worker.fetch(new Request('https://app.invalid/app/api/documents/players.json',{headers}),{DB:fixture.db},{});
  assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).players[0].id,'fixture');
  const denied=await worker.fetch(new Request('https://app.invalid/app/api/documents/history/itf_official_metadata.json',{headers}),{DB:fixture.db},{});assert.equal(denied.status,404);
  const shell=await worker.fetch(new Request('https://app.invalid/app',{headers}),{DB:fixture.db,ASSETS:{fetch:async request=>{assert.equal(new URL(request.url).pathname,'/v3.html');return new Response('<html><head></head><body>Stored shell</body></html>')}}},{});
  assert.equal(shell.status,200);assert.ok((await shell.text()).includes('Stored shell'));
 }finally{globalThis.fetch=old;fixture.close();}
});

test('all authenticated frontend documents and both group snapshots work using real SQLite with no network or writes',async()=>{
 const fixture=database({identityMapping:true}),old=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('Network forbidden')};
 try{
  const owner='user-federico-181099',player={id:'stored-player',name:'Stored Player'};
  fixture.execute('INSERT INTO app_players VALUES(?,?,?)',[1,player.id,JSON.stringify(player)]);
  for(const table of ['user_app_players','user_app_other_players'])fixture.execute(`INSERT INTO ${table} VALUES(?,?,?)`,[owner,player.id,'2026-10-18']);
  fixture.execute('INSERT INTO app_tournaments VALUES(?,?,?,?,?)',[1,player.id,'EUROPE','tennis-europe',JSON.stringify({playerId:player.id,competitionId:'EUROPE',circuit:'tennis-europe'})]);
  fixture.execute('INSERT INTO app_matches VALUES(?,?,?,?,?)',[1,player.id,'EUROPE','2026-10-17',JSON.stringify({playerId:player.id,competitionId:'EUROPE',circuit:'tennis-europe',score:'6-2 6-3',won:true})]);
  const before=fixture.writes();
  const result=await verifyRuntimeAppReaders(worker,fixture.db,'federico181099@gmail.com');
  assert.equal(Object.keys(result.documentRoutes).length,10);
  assert.deepEqual(Object.keys(result.snapshots),['main','others']);
  for(const snapshot of Object.values(result.snapshots))assert.deepEqual(snapshot,{players:1,tournaments:1,matches:1,playerProfileChecked:true});
  assert.equal(fixture.writes(),before);
  fixture.execute("DELETE FROM runtime_document_chunks WHERE path='dist/v3/agenda.json'");
  await assert.rejects(verifyRuntimeAppReaders(worker,fixture.db,'federico181099@gmail.com'),/runtime_app_route_failed:documents\/agenda.json/);
 }finally{globalThis.fetch=old;fixture.close();}
});
