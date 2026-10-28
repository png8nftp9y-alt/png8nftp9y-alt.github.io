import './tennis-europe-monrad.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseDrawWalkovers,recoverDrawWalkovers,discoverDraws,isRecoveredDrawWalkover,drawMatchKey} from './tennis-europe-draw-walkovers.mjs';
const id='079DE5F9-FF49-47F1-A29D-92AB44CDD455',url='https://te.tournamentsoftware.com/tournament/'+id+'/draw/7';
const html=await fs.readFile(new URL('./fixtures/te-avvenire-bd14-walkovers.html',import.meta.url),'utf8');
const options={html,event:'BD14 - Boys Doubles 14 Main Draw',competitionId:id,drawId:'7',endDate:'2026-06-06',sourceUrl:url};
const parsed=parseDrawWalkovers(options),last=parsed.matches.find(m=>m.round==='Final');
test('real Avvenire bracket: all seven W/O found, intermediate dates preserved, undated final uses tournament end',()=>{
 assert.equal(parsed.walkovers,7);assert.equal(parsed.matches.length,6);assert.equal(parsed.pending.length,1);assert.deepEqual(parsed.issues,[]);
 assert.equal(last.date,'2026-06-06');assert.equal(last.dateSource,'tournament_end_date_final_policy');assert.deepEqual(last.winnerPlayerIds,['2','73']);assert(last.players.some(p=>p.name==='Richard MITCHELL'));
 assert.equal(parsed.matches.find(m=>m.round==='Quarter final').date,'2026-06-05');assert(parsed.matches.every(isRecoveredDrawWalkover));
});
test('missing tournament start stays pending; explicit final date takes precedence',()=>{
 assert.equal(parsed.pending[0].round,'Round of 32');assert.equal(parsed.pending[0].date,'');assert.equal(parsed.pending[0].reason,'tournament_start_date_missing');
 const withDate=html.replace(/(<span class="tag--warning tag match__message">Walkover<\/span>[\s\S]*?)(<\/swiper-slide>\s*<\/div>\s*$)/,'$1<div class="match__footer">Fri 05/06/2026</div>$2');
 const p=parseDrawWalkovers({...options,html:withDate});assert.equal(p.matches.find(m=>m.round==='Final').date,'2026-06-05');assert.equal(p.matches.find(m=>m.round==='Final').dateSource,'official_draw_date');
});
test('undated first round uses tournament start; a middle round uses its own preceding dated match plus one day',()=>{
 const full=parseDrawWalkovers({...options,startDate:'2026-05-30'});assert.equal(full.matches.length,7);assert.equal(full.pending.length,0);
 const first=full.matches.find(m=>m.players.some(p=>p.name==='Max KARKKAINEN'));assert.equal(first.date,'2026-05-30');assert.equal(first.dateSource,'tournament_start_date_first_round_policy');assert(isRecoveredDrawWalkover(first));
 const quarter=[...html.matchAll(/<swiper-slide\b[^>]*>([\s\S]*?)<\/swiper-slide>/gi)][2][0];
 const undated=html.replace(quarter,quarter.replace(/<div class="match__footer">[\s\S]*$/,'</swiper-slide>'));
 const middle=parseDrawWalkovers({...options,html:undated,startDate:'2026-05-30'}).matches.find(m=>m.round==='Quarter final');
 assert.equal(middle.date,'2026-06-05');assert.equal(middle.dateSource,'previous_match_plus_one_day');assert.equal(middle.previousMatchDate,'2026-06-04');assert(middle.previousMatchIds.length);assert(isRecoveredDrawWalkover(middle));
});
test('preceding match must be the same team and draw; inferred date cannot exceed tournament end',()=>{
 const slides=[...html.matchAll(/<swiper-slide\b[^>]*>([\s\S]*?)<\/swiper-slide>/gi)].map(m=>m[1]);
 const board='<div class="js-bracket">'+['Round of 32','Round of 16','Quarter final','Semi final','Final'].map(r=>`<div class="js-subheading">${r}</div>`).join('')+slides.map((s,i)=>'<swiper-slide>'+(i===2?s.replace(/<div class="match__footer">[\s\S]*$/,''):'')+'</swiper-slide>').join('')+'</div>';
 const player=parsed.matches.find(m=>m.round==='Quarter final').players;
 const previous={...parsed.matches.find(m=>m.round==='Round of 16'&&m.players.some(p=>p.name===player[0].name)),date:'2026-06-04'};
 const p=parseDrawWalkovers({...options,html:board,startDate:'2026-05-30',knownMatches:[previous]});assert.equal(p.matches[0].date,'2026-06-05');
 assert.equal(parseDrawWalkovers({...options,html:board,startDate:'2026-05-30',knownMatches:[{...previous,drawId:'99'}]}).pending.length,1);
 assert.equal(parseDrawWalkovers({...options,html:board,startDate:'2026-05-30',knownMatches:[{...previous,date:'2026-06-06'}]}).pending.length,1);
 assert.equal(parseDrawWalkovers({...options,html:board,startDate:'2026-05-30',knownMatches:[{...previous,players:previous.players.map(p=>({...p,name:'Other '+p.name}))}]}).pending.length,1);
});
test('wrong date, unsupported layout, missing winner and BYE are never certified recoveries',()=>{
 assert(parseDrawWalkovers({...options,html:'<div>Walkover</div>'}).issues.length);
 const p=parseDrawWalkovers({...options,html:html.replaceAll('has-won','')});assert.equal(p.matches.length,0);assert(p.issues.length);
 assert(!isRecoveredDrawWalkover({...last,sourceUrl:'https://evil.example/draw/7'}));assert(!isRecoveredDrawWalkover({...last,date:'2026-02-30'}));assert(!isRecoveredDrawWalkover({...last,round:'Semi final'}));assert(!isRecoveredDrawWalkover({...last,winnerPlayerIds:['nobody']}));
 const bye=html.replaceAll('Richard MITCHELL [1, DA]','Bye');assert(parseDrawWalkovers({...options,html:bye}).issues.length);
});
test('discovery validates host and tournament and collapses legacy/canonical URLs',()=>{
 const links=discoverDraws(`<a href="${url}">BD14</a><a href="https://te.tournamentsoftware.com/sport/draw.aspx?id=${id}&amp;draw=7">BD14</a><a href="https://evil.example/tournament/${id}/draw/8">Bad</a><a href="/tournament/OTHER/draw/9">Bad</a>`,id);assert.equal(links.length,1);assert.equal(links[0].number,'7');
});
const tournament={competitionId:id,tournamentName:'Avvenire',endDate:'2026-06-06'};
const get=async(u,headers)=>u.endsWith('/draws')?`<a href="${url}">BD14 - Boys Doubles 14 Main Draw</a>`:u===url?`<span>BD14 - Boys Doubles 14 Main Draw</span><form action="/tournament/${id}/Draw/7/GetDrawContent"></form>`:(assert.equal(headers?.['x-requested-with'],'XMLHttpRequest'),html);
test('replay and OOP rows with different draw-local IDs do not duplicate; phase remains distinct',async()=>{
 const stored=parsed.matches.filter(m=>m!==last).map((m,i)=>({...m,id:'oop'+i,players:m.players.map(p=>({...p,id:'local-'+p.id})),teams:m.teams.map(t=>t.map(id=>'local-'+id)),winnerPlayerIds:m.winnerPlayerIds.map(id=>'local-'+id)}));
 const r=await recoverDrawWalkovers({tournament,matches:stored,get});assert.equal(r.cases.filter(c=>c.disposition==='recovered').length,1);assert.equal(stored.length,6);assert.equal(r.pending.length,1);
 const again=await recoverDrawWalkovers({tournament,matches:stored,get});assert.equal(again.cases.filter(c=>c.disposition==='recovered').length,0);assert.equal(stored.length,6);
 assert.notEqual(drawMatchKey(last),drawMatchKey({...last,event:'BD14 Bonus Draw'}));
});
test('existing scheduled OOP gets the W/O result with its own IDs/date; conflicting completed result stays flagged',async()=>{
 const m={...last,id:'scheduled-oop',status:'scheduled',score:'',date:'2026-06-05',winnerTeamIndex:-1,winnerPlayerIds:[]};const rows=[m];
 const report=await recoverDrawWalkovers({tournament,matches:rows,get});assert.equal(m.status,'completed');assert.equal(m.score,'W/O');assert.equal(m.date,'2026-06-05');assert(report.cases.some(c=>c.disposition==='updated_oop_result_from_draw'));
 const conflict={...last,id:'conflict',score:'6-0 6-0',winnerTeamIndex:1};const again=await recoverDrawWalkovers({tournament,matches:[conflict],get});assert.equal(conflict.score,'6-0 6-0');assert(again.issues.some(i=>i.reason==='walkover_completed_result_conflict'));
});
test('manual record remains authoritative and is not inserted again',async()=>{
 const manual={matchId:'manual',competitionId:id,event:last.event,round:'Finale',playerName:last.players[0].name,partner:last.players[1].name,opponentOptions:last.players.slice(2).map(p=>p.name),date:'2026-06-06'};
 const rows=parsed.matches.filter(m=>m!==last);const r=await recoverDrawWalkovers({tournament,matches:rows,get,manualMatches:[manual]});assert.equal(rows.length,5);assert(r.cases.some(c=>c.disposition==='already_in_manual_override'&&c.matchId==='manual'));
});
test('failed official content is reported while existing OOP stays intact',async()=>{
 const rows=[last];const r=await recoverDrawWalkovers({tournament,matches:rows,get:async()=>{throw Error('503')}});assert.equal(rows.length,1);assert.equal(r.status,'needs_attention');assert(r.issues.length);
});
test('real Kufstein final remains the existing Grimoldi manual record',async()=>{
 const competitionId='72B85BEB-F56D-48F3-AA67-88C1F293C970',u='https://te.tournamentsoftware.com/tournament/'+competitionId+'/draw/2';
 const document=await fs.readFile(new URL('./fixtures/te-kufstein-bonus-final-walkover.html',import.meta.url),'utf8');
 const p=parseDrawWalkovers({html:document,event:'BS12 - Boys Singles 12 Bonus Draw',competitionId,drawId:'2',endDate:'2026-07-25',sourceUrl:u});
 assert.equal(p.matches.length,1);assert.deepEqual(p.issues,[]);assert.equal(p.matches[0].date,'2026-07-25');assert.deepEqual(p.matches[0].winnerPlayerIds,['106']);
 const rows=[],manual={matchId:'te-manual-kufstein-2026-bonus-final',competitionId,event:'BS12 - Boys Singles 12 Bonus Draw',round:'Finale',playerName:'Edoardo Grimoldi',opponent:'Lucca Becerra',date:'2026-07-25'};
 const read=async target=>target.endsWith('/draws')?`<a href="${u}">BS12 - Boys Singles 12 Bonus Draw</a>`:target===u?`<span>BS12 - Boys Singles 12 Bonus Draw</span><form action="/tournament/${competitionId}/Draw/2/GetDrawContent"></form>`:document;
 const audit=await recoverDrawWalkovers({tournament:{competitionId,endDate:'2026-07-25'},matches:rows,get:read,manualMatches:[manual]});assert.equal(rows.length,0);assert.equal(audit.cases[0].disposition,'already_in_manual_override');
});

// Date fallback for an undated knockout W/O after a BYE, using a later match.
const nextPlayer=(n,name)=>`<a data-player-id="${n}" data-nationality-id="ITA" href="/sport/player.aspx?id=${id}&amp;player=${n}"><span class="nav-link__value">${name}</span></a>`;
const nextCard=(a,b,date='',walkover=true)=>`<div class="match"><div class="match__row has-won">${a.map(p=>nextPlayer(...p)).join('')}</div><div class="match__row">${b.map(p=>nextPlayer(...p)).join('')}</div>${walkover?'<span>Walkover</span>':''}<div class="match__footer">${date}</div></div>`;
const nextRounds=['Round of 64','Round of 32','Round of 16','Quarter final','Semi final','Final'];
const nextBoard=(columns)=>'<div class="js-bracket">'+nextRounds.map(r=>'<div class="js-subheading">'+r+'</div>').join('')+nextRounds.map((_,i)=>'<swiper-slide>'+(columns[i]||'')+'</swiper-slide>').join('')+'</div>';
const nextOptions={competitionId:id,drawId:'7',sourceUrl:url,event:'BS14 - Boys Singles 14 Main Draw',startDate:'2026-06-01',endDate:'2026-06-10'};
const nextCurrent=nextCard([['1','Alpha ONE']],[['2','Beta TWO']]);
const nextReference={id:'next-official',competitionId:id,drawId:'7',drawUrl:url,event:nextOptions.event,round:'Round of 16',date:'20260606',players:[{id:'1',name:'Alpha ONE'},{id:'3',name:'Gamma THREE'}],teams:[['1'],['3']]};
const nextParse=(knownMatches=[],patch={},columns={1:nextCurrent})=>parseDrawWalkovers({...nextOptions,...patch,knownMatches,html:nextBoard(columns)});
test('after BYE: undated knockout W/O uses following match minus one day, including compact OOP dates',()=>{
 const p=nextParse([nextReference]);assert.equal(p.pending.length,0);assert.equal(p.matches[0].date,'2026-06-05');assert.equal(p.matches[0].dateSource,'next_match_minus_one_day');assert.equal(p.matches[0].nextMatchDate,'2026-06-06');assert.deepEqual(p.matches[0].nextMatchIds,['next-official']);assert(isRecoveredDrawWalkover(p.matches[0]));
});
test('a later dated match in the draw itself supplies the fallback',()=>{
 const p=nextParse([],{}, {1:nextCurrent,2:nextCard([['1','Alpha ONE']],[['3','Gamma THREE']],'Sat 06/06/2026',false)});assert.equal(p.matches[0].date,'2026-06-05');assert.equal(p.matches[0].dateSource,'next_match_minus_one_day');
});
test('official date and preceding plus one retain precedence over following minus one',()=>{
 const official=nextParse([nextReference],{}, {1:nextCard([['1','Alpha ONE']],[['2','Beta TWO']],'Thu 04/06/2026')}).matches[0];assert.equal(official.date,'2026-06-04');assert.equal(official.dateSource,'official_draw_date');
 const preceding={...nextReference,id:'previous',round:'Round of 64',date:'2026-06-02'};const m=nextParse([preceding,nextReference]).matches[0];assert.equal(m.date,'2026-06-03');assert.equal(m.dateSource,'previous_match_plus_one_day');
});
test('following reference must belong to same tournament, draw, event phase and full team',()=>{
 for(const patch of [{competitionId:'OTHER'},{drawId:'99'},{event:'BS14 - Boys Singles 14 Bonus Draw'},{event:'GS14 - Girls Singles 14 Main Draw'},{round:'Round of 32'},{date:''},{id:''},{players:nextReference.players.map(p=>({...p,name:'Other '+p.name}))}]){const p=nextParse([{...nextReference,...patch}]);assert.equal(p.matches.length,0);assert.equal(p.pending.length,1);}
});
test('closest later round is selected; both team references keep date before both',()=>{
 const farther={...nextReference,id:'farther',round:'Quarter final',date:'2026-06-04'};assert.equal(nextParse([farther,nextReference]).matches[0].date,'2026-06-05');
 const other={...nextReference,id:'other-team',date:'2026-06-05',players:[{id:'2',name:'Beta TWO'},{id:'4',name:'Delta FOUR'}],teams:[['2'],['4']]};const m=nextParse([nextReference,other]).matches[0];assert.equal(m.date,'2026-06-04');assert.deepEqual(m.nextMatchIds,['other-team']);
});
test('date stays inside tournament bounds and an invalid preceding date is not hidden',()=>{
 for(const date of ['2026-06-01','2026-06-12'])assert.equal(nextParse([{...nextReference,date}]).matches.length,0);
 const previous={...nextReference,id:'previous',round:'Round of 64',date:'2026-06-10'};assert.equal(nextParse([previous,nextReference]).matches.length,0);
});
test('following fallback handles month changes and rejects forged evidence',()=>{
 const m=nextParse([{...nextReference,date:'2026-07-01'}],{startDate:'2026-06-20',endDate:'2026-07-05'}).matches[0];assert.equal(m.date,'2026-06-30');assert(isRecoveredDrawWalkover(m));assert(!isRecoveredDrawWalkover({...m,date:'2026-06-29'}));assert(!isRecoveredDrawWalkover({...m,nextMatchIds:[]}));assert(!isRecoveredDrawWalkover({...m,round:'Final'}));
});
test('consecutive undated W/O resolve backwards from the following dated match',()=>{
 const p=nextParse([{...nextReference,round:'Quarter final',date:'2026-06-08'}],{}, {1:nextCurrent,2:nextCard([['1','Alpha ONE']],[['3','Gamma THREE']])});assert.equal(p.pending.length,0);assert.equal(p.matches.find(m=>m.round==='Round of 16').date,'2026-06-07');assert.equal(p.matches.find(m=>m.round==='Round of 32').date,'2026-06-06');assert(p.matches.every(isRecoveredDrawWalkover));
});
test('new fallback leaves KO opening/final and existing undated group day-three policies unchanged',()=>{
 const first=nextParse([nextReference],{}, {0:nextCurrent}).matches[0];assert.equal(first.date,'2026-06-01');assert.equal(first.dateSource,'tournament_start_date_first_round_policy');const last=nextParse([nextReference],{}, {5:nextCurrent}).matches[0];assert.equal(last.date,'2026-06-10');assert.equal(last.dateSource,'tournament_end_date_final_policy');
});
test('doubles require the complete same pair, including local ID aliases',()=>{
 const cols={1:nextCard([['1','Alpha ONE'],['10','Partner TEN']],[['2','Beta TWO'],['20','Partner TWENTY']])};
 const reference={...nextReference,event:'BD14 - Boys Doubles 14 Main Draw',players:[{id:'local1',name:'Alpha ONE'},{id:'local10',name:'Partner TEN'},{id:'x',name:'Other X'},{id:'y',name:'Other Y'}],teams:[['local1','local10'],['x','y']]};
 const p=nextParse([reference],{event:reference.event},cols);assert.equal(p.matches[0].date,'2026-06-05');assert(isRecoveredDrawWalkover(p.matches[0]));reference.players[1].name='Different partner';assert.equal(nextParse([reference],{event:reference.event},cols).matches.length,0);
});
// Actual pending/OOP records from merge 40420542128; HTML below is synthetic.
const archivedNextExamples=[{"pending": {"id": "te-draw|0167A661-3A38-42C9-9CB6-379DB099269A|3|22a60a28618d2515e972ea5b", "competitionId": "0167A661-3A38-42C9-9CB6-379DB099269A", "drawId": "3", "event": "GS16 - Girls Singles 16 Main Draw", "round": "Round of 32", "drawRoundIndex": 1, "sourceUrl": "https://te.tournamentsoftware.com/tournament/0167A661-3A38-42C9-9CB6-379DB099269A/draw/3", "players": [{"id": "80", "name": "Ioanna TSEPETONIDOU", "nationality": "GRE", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=0167a661-3a38-42c9-9cb6-379db099269a&player=80"}, {"id": "26", "name": "Anastasia MARINOU", "nationality": "GRE", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=0167a661-3a38-42c9-9cb6-379db099269a&player=26"}], "date": "", "dateSource": "", "tournamentStartDate": "2026-03-07", "tournamentEndDate": "2026-03-15", "time": "", "court": "", "courtMatchNumber": null, "courtMatchNumberSource": "", "notBefore": false, "afterRest": false, "followedBy": false, "scheduleQualifier": "", "teams": [["80"], ["26"]], "winnerTeamIndex": 1, "winnerPlayerIds": ["26"], "winnerPlayerId": "26", "status": "completed", "score": "W/O", "drawUrl": "https://te.tournamentsoftware.com/tournament/0167A661-3A38-42C9-9CB6-379DB099269A/draw/3", "sourceKind": "official_draw_walkover", "reason": "previous_match_date_missing_or_out_of_range", "tournamentName": "EXALCO CUP"}, "following": {"id": "te|0167A661-3A38-42C9-9CB6-379DB099269A|20260312|GS16 - Girls Singles 16 Main Draw|Round of 16|26-47", "competitionId": "0167A661-3A38-42C9-9CB6-379DB099269A", "date": "20260312", "time": "13:00", "notBefore": true, "afterRest": false, "followedBy": false, "scheduleQualifier": "Not before", "court": "Court 7", "courtMatchNumber": 3, "courtMatchNumberSource": "official_schedule_subheader", "event": "GS16 - Girls Singles 16 Main Draw", "drawUrl": "https://te.tournamentsoftware.com/sport/draw.aspx?id=0167a661-3a38-42c9-9cb6-379db099269a&draw=3", "round": "Round of 16", "players": [{"id": "26", "name": "Anastasia MARINOU", "nationality": "GRE", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=0167a661-3a38-42c9-9cb6-379db099269a&player=26"}, {"id": "47", "name": "Anjel HOXHA", "nationality": "ALB", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=0167a661-3a38-42c9-9cb6-379db099269a&player=47"}], "teams": [["26"], ["47"]], "winnerTeamIndex": 1, "winnerPlayerIds": ["47"], "winnerPlayerId": "47", "score": "1-6 3-6", "status": "completed", "sourceUrl": "https://te.tournamentsoftware.com/tournament/0167A661-3A38-42C9-9CB6-379DB099269A/matches/20260312"}, "expected": "2026-03-11"}, {"pending": {"id": "te-draw|17E82D9E-AA48-489F-A03B-5D6E9870E846|6|52a10629e43e6c859264e5df", "competitionId": "17E82D9E-AA48-489F-A03B-5D6E9870E846", "drawId": "6", "event": "GD14 - Girls Doubles 14 Main Draw", "round": "Quarter final", "drawRoundIndex": 1, "sourceUrl": "https://te.tournamentsoftware.com/tournament/17E82D9E-AA48-489F-A03B-5D6E9870E846/draw/6", "players": [{"id": "68", "name": "Natalia COJOCARI", "nationality": "ROM", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=17e82d9e-aa48-489f-a03b-5d6e9870e846&player=68"}, {"id": "82", "name": "Elizabeth FELUX", "nationality": "CZE", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=17e82d9e-aa48-489f-a03b-5d6e9870e846&player=82"}, {"id": "23", "name": "Mavie MAIERHOFER", "nationality": "AUT", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=17e82d9e-aa48-489f-a03b-5d6e9870e846&player=23"}, {"id": "71", "name": "Viktorija MILETIC", "nationality": "AUT", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=17e82d9e-aa48-489f-a03b-5d6e9870e846&player=71"}], "date": "", "dateSource": "", "tournamentStartDate": "2026-06-21", "tournamentEndDate": "2026-06-28", "time": "", "court": "", "courtMatchNumber": null, "courtMatchNumberSource": "", "notBefore": false, "afterRest": false, "followedBy": false, "scheduleQualifier": "", "teams": [["68", "82"], ["23", "71"]], "winnerTeamIndex": 1, "winnerPlayerIds": ["23", "71"], "winnerPlayerId": "", "status": "completed", "score": "W/O", "drawUrl": "https://te.tournamentsoftware.com/tournament/17E82D9E-AA48-489F-A03B-5D6E9870E846/draw/6", "sourceKind": "official_draw_walkover", "reason": "previous_match_date_missing_or_out_of_range", "tournamentName": "Werfring Open"}, "following": {"id": "te|17E82D9E-AA48-489F-A03B-5D6E9870E846|20260626|GD14 - Girls Doubles 14 Main Draw|Semi final|67-59-23-71", "competitionId": "17E82D9E-AA48-489F-A03B-5D6E9870E846", "date": "20260626", "time": "12:00", "notBefore": true, "afterRest": true, "followedBy": false, "scheduleQualifier": "Not before", "court": "Court 2", "courtMatchNumber": 3, "courtMatchNumberSource": "official_schedule_subheader", "event": "GD14 - Girls Doubles 14 Main Draw", "drawUrl": "https://te.tournamentsoftware.com/sport/draw.aspx?id=17e82d9e-aa48-489f-a03b-5d6e9870e846&draw=6", "round": "Semi final", "players": [{"id": "67", "name": "Lina JACOB", "nationality": "AUT", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=17e82d9e-aa48-489f-a03b-5d6e9870e846&player=67"}, {"id": "59", "name": "Nele KOFLER", "nationality": "GER", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=17e82d9e-aa48-489f-a03b-5d6e9870e846&player=59"}, {"id": "23", "name": "Mavie MAIERHOFER", "nationality": "AUT", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=17e82d9e-aa48-489f-a03b-5d6e9870e846&player=23"}, {"id": "71", "name": "Viktorija MILETIC", "nationality": "AUT", "designation": "", "seed": null, "entryType": "", "href": "/sport/player.aspx?id=17e82d9e-aa48-489f-a03b-5d6e9870e846&player=71"}], "teams": [["67", "59"], ["23", "71"]], "winnerTeamIndex": 1, "winnerPlayerIds": ["23", "71"], "winnerPlayerId": "", "score": "1-6 2-6", "status": "completed", "sourceUrl": "https://te.tournamentsoftware.com/tournament/17E82D9E-AA48-489F-A03B-5D6E9870E846/matches/20260626"}, "expected": "2026-06-25"}];

test('real EXALCO singles and Werfring doubles records resolve with archived next match dates',()=>{
 for(const {pending:m,following,expected} of archivedNextExamples){
  const byId=new Map(m.players.map(p=>[p.id,p.name])),a=m.teams[0].map(id=>[id,byId.get(id)]),b=m.teams[1].map(id=>[id,byId.get(id)]);
  // Orient the synthetic card to the verified winner; date inference is independent of row order.
  const body=nextCard(m.winnerTeamIndex===0?a:b,m.winnerTeamIndex===0?b:a),rounds=['Earlier round',m.round,following.round,'Final'];
  const board='<div class="js-bracket">'+rounds.map(r=>'<div class="js-subheading">'+r+'</div>').join('')+rounds.map((_,i)=>'<swiper-slide>'+(i===1?body:'')+'</swiper-slide>').join('')+'</div>';
  const p=parseDrawWalkovers({html:board,event:m.event,competitionId:m.competitionId,drawId:m.drawId,sourceUrl:m.sourceUrl,startDate:m.tournamentStartDate,endDate:m.tournamentEndDate,knownMatches:[following]});assert.equal(p.pending.length,0);assert.equal(p.matches[0].date,expected);assert(isRecoveredDrawWalkover(p.matches[0]));
 }
});

const confirmedDateCases=[
 {competitionId:'368A617A-1B0A-4133-A14C-F19A25991E97',drawId:'2',event:'BS14 - Boys Singles 14 Qualifying',round:'Qualification round of 16',a:[['1','Patryk ZUREK']],b:[['2','Hubert RYBICKI']],startDate:'2026-05-23',endDate:'2026-05-30',date:'2026-05-25'},
 {competitionId:'F065F194-9CF9-46A7-92C9-E97A47ECA6EA',drawId:'6',event:'GD14 - Girls Doubles 14 Main Draw',round:'Semi final',a:[['1','Eva IANCU'],['2','Mara Elena MARINCEAN']],b:[['3','Mara-Andreia DIACONU'],['4','Sofia Ioana STOICA']],startDate:'2026-02-14',endDate:'2026-02-22',date:'2026-02-18'}
];
function confirmedDateOptions(c,body=nextCard(c.a,c.b)){
 const sourceUrl='https://te.tournamentsoftware.com/tournament/'+c.competitionId+'/draw/'+c.drawId;
 return{...c,sourceUrl,html:'<div class="js-bracket"><div class="js-subheading">Earlier round</div><div class="js-subheading">'+c.round+'</div><swiper-slide></swiper-slide><swiper-slide>'+body+'</swiper-slide></div>'};
}
test('Varitex and Romania W/O use only the dates explicitly supplied by the user',()=>{
 for(const c of confirmedDateCases){const p=parseDrawWalkovers(confirmedDateOptions(c));assert.equal(p.pending.length,0);assert.equal(p.matches[0].date,c.date);assert.equal(p.matches[0].dateSource,'user_confirmed_walkover_date');assert.equal(p.matches[0].score,'W/O');assert(isRecoveredDrawWalkover(p.matches[0]));assert(!isRecoveredDrawWalkover({...p.matches[0],date:'2026-01-01'}));}
});
test('user dates do not leak to a different tournament, draw, round or doubles pairing',()=>{
 const c=confirmedDateCases[1];for(const patch of [{competitionId:id},{drawId:'99'},{round:'Quarter final'},{a:[c.a[0],c.b[0]],b:[c.a[1],c.b[1]]}]){const x={...c,...patch};assert.equal(parseDrawWalkovers(confirmedDateOptions(x)).matches.length,0);}
});
test('an official date takes precedence over user fallback, and dates outside tournament bounds are rejected',()=>{
 const c=confirmedDateCases[0],official=parseDrawWalkovers(confirmedDateOptions(c,nextCard(c.a,c.b,'Sun 24/05/2026'))).matches[0];assert.equal(official.date,'2026-05-24');assert.equal(official.dateSource,'official_draw_date');assert.equal(parseDrawWalkovers(confirmedDateOptions({...c,startDate:'2026-05-26'})).matches.length,0);
});
test('repeating recovery with a user date inserts no duplicate match',async()=>{
 const c=confirmedDateCases[1],o=confirmedDateOptions(c),matches=[],get=async u=>u.endsWith('/draws')?'<a href="'+o.sourceUrl+'">'+c.event+'</a>':o.html;
 const first=await recoverDrawWalkovers({tournament:c,matches,get});assert.equal(first.pending.length,0);assert.equal(matches.length,1);assert.equal(matches[0].date,c.date);const second=await recoverDrawWalkovers({tournament:c,matches,get});assert.equal(matches.length,1);assert.equal(second.cases[0].disposition,'already_in_oop');
});
