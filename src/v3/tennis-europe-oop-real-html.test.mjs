import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {inventoryOopPage,recoverOopResults,auditOopCompleteness,isVerifiedOopResult} from './tennis-europe-oop-completeness.mjs';
const dir=new URL('./fixtures/oop-real-cards/',import.meta.url);
const fixtures=readdirSync(dir).map(name=>({name,...JSON.parse(readFileSync(new URL(name,dir),'utf8'))}));
// Exact HTML excerpts retained by failed run 41633066349, not reconstructed cards.
test('real Krakow nested rows: all ten Not scheduled results retain native winners and are acquired once',()=>{
 const raw=fixtures.filter(f=>f.name.startsWith('krakow-'));
 assert.equal(raw.length,10);
 const pages=raw.map(f=>inventoryOopPage(f.evidenceHtml,f.competitionId,f.date));
 for(let i=0;i<raw.length;i++){
  assert.equal(pages[i].cards.length,1);
  assert.equal(pages[i].cards[0].sourceHash,raw[i].sourceHash);
  assert.equal(pages[i].cards[0].winnerIds.length,1);
  assert.equal(pages[i].cards[0].score,raw[i].score);
 }
 const tournament={competitionId:raw[0].competitionId,startDate:'2026-08-22',endDate:'2026-08-30'},matches=[];
 assert.equal(recoverOopResults({tournament,pages,matches}).length,10);
 assert.ok(matches.every(isVerifiedOopResult));
 assert.ok(matches.every(m=>m.court===''&&m.time===''&&m.courtMatchNumber===null));
 assert.equal(auditOopCompleteness({tournament,pages,matches}).status,'complete');
 assert.equal(recoverOopResults({tournament,pages,matches}).length,0);
});
test('exact real-source resolutions recover JC with native ID and retain the two W/O without invented opponents',()=>{
 const raw=fixtures.filter(f=>!f.name.startsWith('krakow-'));assert.equal(raw.length,3);
 for(const f of raw){
  const pages=[inventoryOopPage(f.evidenceHtml,f.competitionId,f.date)],tournament={competitionId:f.competitionId},matches=[];
  if(f.name.startsWith('jc-')){
   assert.equal(recoverOopResults({tournament,pages,matches}).length,1);
   assert.equal(matches[0].winnerPlayerId,'16');assert.equal(matches[0].players[0].name,'Richard MRAZEK');
   assert.equal(matches[0].score,'6-2 7-6');assert.equal(matches[0].userResolution.confirmedBy,'user');
  }else{
   assert.equal(pages[0].cards[0].players.length,1);
   assert.equal(recoverOopResults({tournament,pages,matches}).length,0);
   assert.equal(auditOopCompleteness({tournament,pages,matches}).resolutions[0].score,'W/O');
  }
  assert.equal(auditOopCompleteness({tournament,pages,matches}).status,'complete');
  const changed=[inventoryOopPage(f.evidenceHtml+'<!-- changed -->',f.competitionId,f.date)];
  assert.equal(auditOopCompleteness({tournament,pages:changed,matches:[]}).issues[0].reason,'incomplete_native_participants');
 }
});
