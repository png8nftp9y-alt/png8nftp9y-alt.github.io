import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {opponentEuropeProfile} from '../lib/opponent-europe-profile.mjs';
import {exactCurrentRankingRows} from '../lib/exact-current-ranking.mjs';
import {database} from './search-sqlite-fixture.mjs';
const dates={G14:'2026-10-20',G16:'2026-10-20',B14:'2026-10-20',B16:'2026-10-20'};
const build=options=>opponentEuropeProfile({year:2026,latestRankingDates:dates,...options});
test('current rank uses latest publication only; nationality survives an unranked player',()=>{
 const stale={category:'G14',ranking:99,ranking_date:'2026-10-13',nationality:'PAK'};
 const person={birthYear:2012,nationality:'PAK',sex:'F'};
 assert.equal(build({person,historyProfile:stale,rankings:[stale]}).ranking,null);
 assert.equal(build({person,historyProfile:stale,rankings:[stale]}).europeRankingStatus,'unranked');
 const current={...stale,ranking:37,ranking_date:dates.G14};
 assert.equal(build({person,rankings:[current]}).ranking,37);
 assert.equal(build({person}).nationality,'PAK');
 assert.equal(build({person,latestRankingDates:{}}).europeRankingStatus,'unknown');
});
test('U10/U12 and U14/U16 labels follow current age; old event cannot override birth year',()=>{
 for(const birthYear of [2014,2016])assert.equal(build({person:{birthYear}}).europeRankingStatus,'unranked-u12');
 for(const birthYear of [2010,2012,2013])assert.equal(build({person:{birthYear},event:'BS12'}).europeRankingStatus,'unranked');
 for(const event of ['BS12','GD10','Under 12','U12'])assert.equal(build({event}).europeRankingStatus,'unranked-u12');
 assert.equal(build({event:'GS16'}).europeRankingStatus,'unranked');
 assert.equal(build({person:{birthYear:2007}}).europeRankingStatus,'unknown');
 assert.equal(build({}).europeRankingStatus,'unknown');
 const ranked={category:'B14',ranking:1,ranking_date:dates.B14};
 assert.equal(build({person:{birthYear:2014},rankings:[ranked]}).ranking,null);
});
test('confirmed current nationality wins over old ranking affiliation',()=>{
 assert.equal(build({person:{nationality:'GBR'},historyProfile:{nationality:'ITA'}}).nationality,'GBR');
});
test('ranking full-name lookup handles upper-case stored names without writes',async()=>{
 const d=database({identityMapping:true});
 try{
  d.execute('INSERT INTO tennis_europe_ranking_history(profile_id,ranking_date,publication_id,week_label,category,ranking,display_name,normalized_name,nationality,source_url,captured_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',['native','2026-10-20','pub','week','B14',42,'Test Player','PLAYER TEST','PAK','https://example.test','2026-10-20']);
  const before=d.writes(),rows=await exactCurrentRankingRows(d.db,{name:'Test Player'});
  assert.equal(rows[0].ranking,42);assert.equal(rows[0].nationality,'PAK');assert.equal(d.writes(),before);
 }finally{d.close()}
});
const front=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
const slice=(start,end)=>front.slice(front.indexOf(start),front.indexOf(end,front.indexOf(start)));
test('all supported country codes have shipped flags, including ITF and Europe federation aliases',()=>{
 const ctx={Intl,Set,esc:String};vm.createContext(ctx);
 vm.runInContext(slice('const IOC_REGION =','const VERIFIED_NATIONALITY =')+'\nglobalThis.codes=ALL_COUNTRY_REGIONS;globalThis.flag=countryFlagCode;globalThis.html=nationalityHtml;',ctx);
 for(const [country,iso] of Object.entries(ctx.codes)){
  const code=ctx.flag(country),file=code==='mx'?'mx-flat':code;
  assert.equal(code,iso.toLowerCase(),country);
  assert.ok(existsSync(new URL('../../../flags/'+file+'.svg',import.meta.url)),country);
 }
 for(const [nation,iso] of [['PAK','pk'],['SRI','lk'],['TPE','tw'],['LIB','lb'],['RTF','ru'],['BTF','by'],['Egypt','eg'],['Svizzera','ch']]){
  assert.equal(ctx.flag(nation),iso);assert.ok(ctx.html(nation).includes('flags/'+iso+'.svg'));
 }
 assert.equal(ctx.html(''),'');
});
test('only opponent header renders requested absent-rank labels',()=>{
 const ctx={displayDate:x=>x};vm.createContext(ctx);
 vm.runInContext(slice('function opponentEuropeRankingText(','function renderOpponentHistory('),ctx);
 assert.equal(ctx.opponentEuropeRankingText({europeRankingStatus:'unranked-u12'}),'No ranking Europe U12');
 assert.equal(ctx.opponentEuropeRankingText({europeRankingStatus:'unranked'}),'No ranking Europe');
 assert.equal(ctx.opponentEuropeRankingText({europeRankingStatus:'unknown'}),'');
 assert.match(ctx.opponentEuropeRankingText({ranking:42,category:'B14',ranking_date:'2026-10-20'}),/n°42 TE U14/);
 assert.equal((front.match(/No ranking Europe U12/g)||[]).length,1);
});

test('nationality backfill uses exact canonical links, refuses conflicts and leaves confirmed countries alone',async()=>{
 const {enrichIdentityNationalities}=await import('../lib/identity-nationality.mjs');
 let calls=0;
 const db={prepare(sql){assert.match(sql,/canonical_id IN/);assert.ok(!sql.includes('name_key'));return{bind(...ids){calls++;assert.deepEqual(ids,['missing','conflict']);return{all:async()=>({results:[
  {canonical_id:'missing',circuit:'itf',nationality:'PAK'},
  {canonical_id:'conflict',circuit:'itf',nationality:'ITA'},
  {canonical_id:'conflict',circuit:'tennis-europe',nationality:'GBR'}
 ]})}}}}};
 const people=[{canonicalId:'known',nationality:'GBR'},{canonicalId:'missing'},{canonicalId:'conflict'}];
 await enrichIdentityNationalities(db,people);
 assert.equal(calls,1);assert.equal(people[0].nationality,'GBR');assert.equal(people[1].nationality,'PAK');assert.equal(people[2].nationality,'');
});
