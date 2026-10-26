import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {personalLiveEntry,mergePersonalLiveTournaments,mergePersonalHistoryTournament} from '../lib/personal-live-entry.mjs';
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
 assert.ok(source.includes("tournamentMap.set(key,mergePersonalHistoryTournament(t,tournamentMap.get(key)))"));
});
test('certified draw presence survives acceptance refresh, scoped to player circuit and tournament',()=>{
 const old={playerId:'one',competitionId:'T',circuit:'tennis-europe',calendarState:'draw_confirmed',entryStatus:'official_draw',calendarListLabel:''};
 const entries=[{competitionId:'T',circuit:'tennis-europe',acceptanceCode:'MD',acceptancePosition:2},{competitionId:'future',circuit:'tennis-europe',acceptanceCode:'Q',acceptancePosition:4},{competitionId:'T',circuit:'itf',acceptanceCode:'A',acceptancePosition:3}];
 const merged=mergePersonalLiveTournaments([old],entries,'one');assert.equal(merged[0].calendarListLabel,'');assert.equal(merged[0].calendarState,'draw_confirmed');assert.equal(merged[1].calendarListLabel,'Q-4');assert.equal(merged[2].calendarListLabel,'A-3');
 assert.equal(mergePersonalLiveTournaments([old],[entries[0]],'two')[1].calendarListLabel,'MD-2');
 assert.equal(personalLiveEntry({...entries[0],drawUrl:'https://example.org/draw'}).calendarListLabel,'MD-2');
});

test('FITP withdrawal behavior remains unchanged',()=>{
for(const circuit of ['fitp']){
 const prior={playerId:'one',circuit,competitionId:'T',calendarState:'draw_confirmed',entryStatus:'official_draw'};
 const withdrawn=mergePersonalLiveTournaments([prior],[{competitionId:'T',circuit,entryStatus:'withdrawn'}],'one')[0];
 assert.equal(withdrawn.entryStatus,'withdrawn');assert.equal(withdrawn.status,'withdrawn');
 assert.equal(mergePersonalHistoryTournament(prior,withdrawn).entryStatus,'withdrawn');
 assert.equal(personalLiveEntry({...prior,acceptanceCode:'W'}).entryStatus,'withdrawn');
}
});

test('Calandra W-7 acceptance cannot hide certified WC draw presence, in either merge order',()=>{
 for(const circuit of ['tennis-europe','itf']){
  const draw={playerId:'calandra',circuit,competitionId:'304541B6-24C6-45A9-806E-633242627228',calendarState:'draw_confirmed',entryStatus:'official_draw',designation:'WC'};
  const acceptance={...draw,calendarState:'pre_tournament_acceptance',entryStatus:'confirmed_on_acceptance_list',acceptanceCode:'W',acceptancePosition:7,acceptanceList:'Withdrawn',status:'withdrawn'};
  const results=[mergePersonalHistoryTournament(draw,acceptance),mergePersonalLiveTournaments([draw],[acceptance],'calandra')[0],personalLiveEntry({...acceptance,calendarState:'draw_confirmed'})];
  for(const row of results){assert.equal(row.entryStatus,'official_draw');assert.notEqual(row.status,'withdrawn');assert.equal(row.acceptanceList,'');assert.equal(row.acceptanceCode,'');assert.equal(row.calendarListLabel,'');assert.equal(row.designation,'WC');}
  assert.equal(personalLiveEntry(acceptance).status,'withdrawn');
 }
});
test('draw evidence never revives a cancelled tournament',()=>{
 for(const cancellation of [{cancelled:true},{canceled:true},{tournamentStatus:'cancelled'},{status:'cancelled'}]){
  const row=personalLiveEntry({circuit:'tennis-europe',calendarState:'draw_confirmed',entryStatus:'official_draw',...cancellation});assert.equal(row.status,'withdrawn');
 }
});
