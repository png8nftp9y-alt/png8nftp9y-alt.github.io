import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {storedPresentationLoaders} from '../lib/personal-tournament-presentation.mjs';
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
  const code=read(path);assert.ok(code.indexOf('run: node scripts/sync-runtime-documents-d1.mjs')<code.indexOf('npx wrangler deploy --minify'));
 }
 const dir=await prepareRuntimeAssets();assert.ok(readFileSync(dir+'v3.html','utf8').includes('<html'));
});

import worker from '../src/index.js';
import {database} from './search-sqlite-fixture.mjs';
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
