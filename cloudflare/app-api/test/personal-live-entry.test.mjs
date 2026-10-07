import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {personalLiveEntry,mergePersonalLiveTournaments} from '../lib/personal-live-entry.mjs';
test('all personal TE and ITF additions use the same live MD/Q/A acceptance labels',()=>{
 for(const circuit of ['tennis-europe','itf'])for(const code of ['MD','Q','A']){
  const t=personalLiveEntry({circuit,acceptanceCode:code,acceptancePosition:7});
  assert.equal(t.calendarListLabel,code+'-7');assert.equal(t.acceptancePosition,7);
 }
});
test('each snapshot updates labels immediately and preserves matches/tournament identity without writes',()=>{
 const old={playerId:'cw-person',competitionId:'T',circuit:'tennis-europe',calendarListLabel:'A-12',acceptancePosition:12,matches:[{id:'m'}]},entry={competitionId:'T',circuit:'tennis-europe',acceptanceCode:'Q',acceptancePosition:3};
 const first=mergePersonalLiveTournaments([old],[entry],'cw-person');assert.equal(first.length,1);assert.equal(first[0].calendarListLabel,'Q-3');assert.equal(first[0].matches[0].id,'m');
 const second=mergePersonalLiveTournaments(first,[{...entry,acceptanceCode:'MD',acceptancePosition:2}],'cw-person');assert.equal(second[0].calendarListLabel,'MD-2');
 const absent=mergePersonalLiveTournaments(second,[{...entry,acceptanceCode:'Q',acceptancePosition:null}],'cw-person');assert.equal(absent[0].calendarListLabel,'Q');assert.equal(absent[0].acceptancePosition,null);
 assert.equal(mergePersonalLiveTournaments(absent,[{...entry,acceptanceCode:'',acceptancePosition:null}],'cw-person')[0].calendarListLabel,'');
});
test('withdrawals remain withdrawn and unknown positions are never fabricated as zero',()=>{
 assert.equal(personalLiveEntry({circuit:'itf',acceptanceCode:'W',acceptancePosition:null}).status,'withdrawn');
 for(const position of [undefined,null,'',0,-1,'invalid'])assert.equal(personalLiveEntry({circuit:'itf',acceptanceCode:'MD',acceptancePosition:position}).calendarListLabel,'MD');
 assert.equal(personalLiveEntry({circuit:'fitp',entryStatus:'iscritto'}).calendarListLabel,undefined);
});
test('protected personal snapshot merges current labels and history cannot replace acceptance fields',()=>{
 const source=readFileSync(new URL('../src/index.js',import.meta.url),'utf8');
 assert.ok(source.includes('mergePersonalLiveTournaments(tournaments,entries.map('));
 assert.ok(source.includes('tournamentMap.set(key,{...t,...tournamentMap.get(key)})'));
});
