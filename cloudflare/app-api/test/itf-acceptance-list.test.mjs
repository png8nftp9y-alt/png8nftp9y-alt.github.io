import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {itfAcceptanceListResponse} from '../lib/itf-acceptance-list.mjs';
const id='J-J30-SUI-2026-006';const document={version:1,circuit:'itf',competitionId:id,name:'J30 Agno',acquiredAt:'2026-10-28T12:00:00Z',kind:'last_nonempty_acquired_acceptance',entries:[{name:'Aila Zennaro',gender:'Girls',section:'Q',position:4,nationality:'ITA',ranking:1200},{name:'Other Player',gender:'Boys',section:'MD',position:1},{name:'Alternate Player',gender:'Girls',section:'A',position:2},{name:'Withdrawn Player',gender:'Girls',section:'W',position:null}]};
test('one tournament object supplies the archived roster without external ITF calls or database scans',async()=>{
 let reads=0;const response=await itfAcceptanceListResponse({get:async key=>{reads++;assert.equal(key,`itf/acceptance-lists/current/${id}.json`);return {size:1000,json:async()=>document}}},id.toLowerCase());
 assert.equal(reads,1);assert.equal(response.status,200);assert.match(response.headers.get('Content-Type'),/text\/html/);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const html=await response.text();for(const text of ['Lista archiviata','Acquisita il','28/10/2026','Main Draw','Qualificazioni','Alternates','Ritirati','Aila Zennaro','1200'])assert.ok(html.includes(text),text);
});
test('missing archive, temporary failure and invalid tournament remain distinguishable',async()=>{
 assert.equal((await itfAcceptanceListResponse({get:async()=>null},id)).status,404);
 assert.equal((await itfAcceptanceListResponse(null,id)).status,503);
 assert.equal((await itfAcceptanceListResponse({get:async()=>{throw Error('network')}},id)).status,503);
 assert.equal((await itfAcceptanceListResponse({get:()=>assert.fail('must not read')},'../../secret')).status,400);
 assert.equal((await itfAcceptanceListResponse({get:async()=>({json:async()=>({...document,competitionId:'OTHER'})})},id)).status,503);
});
test('all stored names/countries/genders are escaped and missing dates/positions are never invented',async()=>{
 const doc={...document,acquiredAt:null,name:'<script>bad</script>',entries:[{name:'<img src=x>',gender:'<svg>',nationality:'<bad>',section:'MD',position:null,ranking:null}]};
 const html=await (await itfAcceptanceListResponse({get:async()=>({json:async()=>doc})},id)).text();assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.match(html,/Data di acquisizione non disponibile/);assert.match(html,/default-src 'none'|Ranking acquisito/);assert.ok(html.includes('—'));
});
test('ITF hero button points to the authenticated local archive for observed and catalogue tournaments',()=>{
 const source=fs.readFileSync(new URL('../../../v3.js',import.meta.url),'utf8'),ctx={URL,circuit:t=>t.circuit};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function tournamentAcceptanceUrl('),source.indexOf('function itfAcceptanceListUrl(')),ctx);
 for(const extra of [{},{catalogueOnly:true},{entryStatus:'official_draw',drawConfirmed:true}])assert.equal(ctx.tournamentAcceptanceUrl({circuit:'itf',competitionId:id,...extra}),'/app/api/tournament-acceptance-list?competitionId='+id);
 assert.equal(ctx.tournamentAcceptanceUrl({circuit:'itf',competitionId:'bad'}),'');assert.equal(ctx.tournamentAcceptanceUrl({circuit:'itf',competitionId:id,manualEvent:true}),'');
 const api=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8');assert.ok(api.indexOf("apiPath==='/tournament-acceptance-list'")>api.indexOf("if(!user)return privateJson"));assert.match(api,/itfAcceptanceListResponse\(env\.ARCHIVE/);
});
test('real Worker route authenticates before reading the archive and needs no participant/opponent scan',async()=>{
 const {default:worker}=await import('../src/index.js'),{database}=await import('./search-sqlite-fixture.mjs');const d=database({identityMapping:true});let reads=0;
 try{
  const source=fs.readFileSync(new URL('../src/index.js',import.meta.url),'utf8'),email=source.match(/email:\s*['"]([^'"]+)['"]/)?.[1];assert.ok(email);
  const archive={get:async()=>{reads++;return {json:async()=>document}}};
  const url='https://courtwatch.example/app/api/tournament-acceptance-list?competitionId='+id;
  const unauthorized=await worker.fetch(new Request(url),{DB:d.db,ARCHIVE:archive});assert.equal(unauthorized.status,401);assert.equal(reads,0);
  const db={...d.db,prepare(sql){assert.doesNotMatch(sql,/\b(?:opponent_entry_profiles|match_participants)\b/i);return d.db.prepare(sql);}};
  const response=await worker.fetch(new Request(url,{headers:{'Cf-Access-Authenticated-User-Email':email}}),{DB:db,ARCHIVE:archive});assert.equal(response.status,200);assert.equal(reads,1);assert.match(await response.text(),/Aila Zennaro/);
 }finally{d.close();}
});
