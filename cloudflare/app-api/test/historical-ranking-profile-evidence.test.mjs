import test from 'node:test';import assert from 'node:assert/strict';
import {historicalProfileCandidate,historicalRankingProfiles} from '../lib/historical-ranking-profile-evidence.mjs';
import {applyArchiveEvidence} from '../scripts/repair-archived-player-profiles.mjs';
const id='12345678-1234-1234-1234-123456789abc',other='22345678-1234-1234-1234-123456789abc';
const source={circuit:'tennis-europe',source_table:'observed_players',source_key:'acceptance|old',display_name:'Example Person',nationality:'FRA',birth_year:null,official_id:'',payload:JSON.stringify({nationality:'FRA',displayName:'Example Person'})};
const record={profile_id:id,display_name:'Person Example',nationality:'FRA',ranking_date:'2026-01-05',source_url:'https://te.tournamentsoftware.com/ranking/category.aspx?category=123&id=ranking-id'};
const page={url:'https://te.tournamentsoftware.com/player-profile/'+id,text:'<img class="profile-head__nat" src="https://static.tournamentsoftware.com/content/images/flags/TUN.svg"><h2 class="media__title--large">Example Person</h2>'};
const directoryPage=(url,p=page)=>new URL(url).pathname==='/find/player/DoSearch'?{url,text:new URL(url).searchParams.get('Page')==='1'?'<h5><a href="/player-profile/'+id+'">Example Person</a></h5>':''}:p;
test('historical federation on exact official GUID survives current nationality change',async()=>{
 const result=await historicalRankingProfiles([source],async()=>[record],async url=>directoryPage(url));const e=result.resolved.get('observed_players|acceptance|old');assert.equal(e.officialId,id);assert.equal(e.nationality,'TUN');assert.equal(e.historicalNationality,'FRA');
});
test('homonyms, missing federation, foreign evidence and unknown birth compatibility cannot be guessed',()=>{
 assert.equal(historicalProfileCandidate(source,[record,{...record,profile_id:other}]),null);
 assert.equal(historicalProfileCandidate({...source,nationality:''},[record]),null);
 assert.equal(historicalProfileCandidate(source,[{...record,source_url:'https://example.com/ranking/category.aspx?id=x&category=1'}]),null);
 assert.equal(historicalProfileCandidate({...source,birth_year:2012},[record]),null);
});
test('failed profile, wrong redirect or mismatched name does not certify a recovery',async()=>{
 for(const p of [{...page,url:'https://example.com/player-profile/'+id},{...page,text:page.text.replace('Example Person','Other Person')}]){const r=await historicalRankingProfiles([source],async()=>[record],async url=>directoryPage(url,p));assert.equal(r.resolved.size,0)}
});
test('D1_TEST_INITIAL_IMPORT D1_TEST_IDENTICAL_ZERO_WRITES D1_TEST_REAL_DELTAS_ONLY D1_TEST_INCOMPLETE_SOURCE_GUARD: historical recovery retains source key and guarded readback, unchanged replay writes zero',async()=>{
 const recovered=await historicalRankingProfiles([source],async()=>[record],async url=>directoryPage(url)),evidence=recovered.resolved.get('observed_players|acceptance|old');let current={...source},writes=0;
 const q=async sql=>{if(sql.startsWith('UPDATE')){writes++;current={...current,official_id:id,payload:JSON.stringify({...JSON.parse(source.payload),...evidence})};return[]}if(sql.startsWith('SELECT'))return[current];throw Error(sql)};
 const catalog={resolve:r=>r.official_id?null:evidence};const first=await applyArchiveEvidence(q,[current],catalog);assert.equal(first.repaired,1);assert.equal(current.source_key,source.source_key);assert.equal(JSON.parse(current.payload).historicalNationality,'FRA');const again=await applyArchiveEvidence(q,[current],catalog);assert.equal(again.repaired,0);assert.equal(writes,1);
 const failed=await applyArchiveEvidence(async()=>[],[source],{resolve:()=>null});assert.equal(failed.repaired,0);
});

test('a historical ranking does not select the ranked profile over an unranked official homonym',async()=>{const get=async url=>new URL(url).pathname==='/find/player/DoSearch'?{url,text:new URL(url).searchParams.get('Page')==='1'?'<h5><a href="/player-profile/'+id+'">Example Person</a></h5><h5><a href="/player-profile/'+other+'">Example Person</a></h5>':''}:{...page,url};const r=await historicalRankingProfiles([source],async()=>[record],get);assert.equal(r.resolved.size,0)});
