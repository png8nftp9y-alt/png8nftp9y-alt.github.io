import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const context=vm.createContext({circuit:t=>t.circuit,iso:()=> '2026-11-19',Date,
 $:()=>null,opponentHistoryProjection:x=>x,esc:x=>String(x),readableText:x=>x,
 state:{data:{tournaments:[]}},tournamentOfficialUrl:()=>'',tournamentSurfaceLabel:()=>'',
 opponentTournamentStatusHtml:()=>'',opponentTournamentEventLinks:()=>'',opponentTournamentDateLabel:()=>'',
 opponentHistoryMatchSectionsHtml:()=>'',bindParticipantNavigation:()=>{}});
const extract=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
vm.runInContext(extract('function tournamentConcluded(', 'function playerTournamentEligible('),context);
vm.runInContext(extract('function opponentTournamentAcceptanceLabel(', 'function opponentHistoryKey('),context);
const future={circuit:'itf',name:'Saint Paul',startDate:'2026-11-23',endDate:'2026-11-29',entryStatus:'MD',acceptanceCode:'MD',acceptancePosition:12,matches:[]};
const label=t=>context.opponentTournamentAcceptanceLabel(t);
test('ITF and Europe preserve list positions, including label and entryPosition fallback; FITP has no acceptance caption',()=>{
 assert.equal(label(future),'MD-12');
 assert.equal(label({...future,circuit:'tennis-europe',acceptanceCode:'A',acceptancePosition:19}),'A-19');
 assert.equal(label({...future,acceptancePosition:null,entryPosition:7}),'MD-7');
 assert.equal(label({...future,acceptancePosition:null,calendarListLabel:'MD-9'}),'MD-9');
 assert.equal(label({...future,acceptancePosition:null}),'MD');
 assert.equal(label({...future,circuit:'fitp'}),'');
});
test('start date alone does not remove pending acceptance; official draw or acquired match does',()=>{
 const current={...future,startDate:'2026-11-19'};
 assert.equal(label(current),'MD-12');
 for(const proof of [{drawConfirmed:true},{calendarState:'draw_confirmed'},{entryStatus:'official_draw'},{matches:[{id:'official-match'}]}])assert.equal(label({...current,...proof}),'');
 for(const status of ['withdrawn','excluded','cancelled'])assert.equal(label({...future,entryStatus:status}),'');
 assert.equal(label({...future,endDate:'2026-11-18'}),'');
});
test('actual opponent renderer places acceptance beside the tournament name and emits no Iscritto paragraph',()=>{
 const body={setAttribute(){},innerHTML:'',insertAdjacentHTML(){}};
 context.$=id=>id==='opponentTournamentHistory'?body:null;
 context.renderOpponentHistory({tournaments:[future]});
 assert.match(body.innerHTML,/<h4>.*Saint Paul.*Acceptance list: MD-12.*<\/h4>/);
 assert.doesNotMatch(body.innerHTML,/opponentTournamentEntry|Iscritto/);
 context.renderOpponentHistory({tournaments:[{...future,circuit:'fitp'}]});
 assert.doesNotMatch(body.innerHTML,/Acceptance list|Iscritto/);
});
