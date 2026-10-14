import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fitpSubscriptionDates,mergeFitpSubscriptionDates} from './fitp-subscription-dates.mjs';
const root=new URL('../../',import.meta.url),ui=readFileSync(new URL('v3.js',root),'utf8');

test('PUC timestamps retain their source day, deduplicate and reject invalid/missing dates',()=>{
 assert.deepEqual(fitpSubscriptionDates({subscriptionDates:['2026-09-16T08:33:22.397','2026-09-16T23:30:00-03:00','2026-09-17'],SubscriptionDate:'18/09/2026 10:00'}),['2026-09-16','2026-09-17','2026-09-18']);
 assert.deepEqual(fitpSubscriptionDates({subscriptionDate:'2026-02-31',SubscriptionDate:'1900-01-01',startDate:'2026-10-16',lastSeen:'2026-10-01'}),[]);
 assert.deepEqual(mergeFitpSubscriptionDates({subscriptionDates:['2026-09-16']},{subscriptionDate:'2026-09-17T10:00:00'}),['2026-09-16','2026-09-17']);
});

test('calendar entry and player tournament retain FITP registration dates without adding them to other circuits',()=>{
 const source=readFileSync(new URL('src/v3/entries-engine.mjs',root),'utf8'),context={fitpSubscriptionDates,slug:v=>v,NOW:'2026-10-14'};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function entry(row)'),source.indexOf('function ageHours(')),context);
 const entry=context.entry({circuit:'fitp',playerId:'one',competitionId:'T',subscriptionDates:['2026-09-16T08:33:22.397']});
 assert.deepEqual(Array.from(entry.subscriptionDates),['2026-09-16']);
 assert.deepEqual(Array.from(context.toTournament(entry).subscriptionDates),['2026-09-16']);
 assert.equal(context.entry({circuit:'itf',subscriptionDates:['2026-09-16']}).subscriptionDates,undefined);
});

test('native opponent-entry profiles merge separate singles/doubles registration days',()=>{
 const source=readFileSync(new URL('cloudflare/app-api/scripts/generate-opponent-entry-seed.mjs',root),'utf8');
 const context={profiles:new Map(),clean:v=>String(v||'').trim(),norm:v=>String(v||'').toLowerCase(),mergeFitpSubscriptionDates};vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function add('),source.indexOf('for(const snapshot')),context);
 context.add('fitp','123','Test Player',{competitionId:'T',draw:'singles',subscriptionDates:['2026-09-16']});
 context.add('fitp','123','Test Player',{competitionId:'T',draw:'doubles',subscriptionDates:['2026-09-17']});
 const tournaments=context.profiles.get('fitp|123').tournaments;
 assert.equal(tournaments.size,1);assert.deepEqual(Array.from(tournaments.get('T').subscriptionDates),['2026-09-16','2026-09-17']);
});

function render(circuit){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,innerHTML:'',classList:{add(){},remove(){}},querySelectorAll:()=>[]});return nodes.get(id)};
 const tournament={id:'T',circuit,name:'Test Tournament',startDate:'2026-10-16',endDate:'2026-10-18',playerIds:['one','two'],people:[{playerId:'one',playerName:'First Player',subscriptionDates:['2026-09-16']},{playerId:'two',playerName:'Second Player',subscriptionDates:['2026-09-17','2026-09-18']}]};
 const context={$:node,groups:()=>[tournament],tournamentKey:t=>t.id,tournamentPageKey:'T',openTournamentPlayerKeys:new Set(),saveUiState(){},circuit:t=>t.circuit,Map,Set,state:{data:{matches:[],players:[]}},readablePerson:v=>v,readableText:v=>v,esc:v=>String(v||''),participantDesignation:()=>'',participantDesignationHtml:()=>'',nationalityHtml:()=>'',monitoredNationality:()=>'',teRankHtml:()=>'',matchHistorySectionsHtml:()=>'',tournamentOfficialUrl:()=>'',tournamentAcceptanceUrl:()=>'',tournamentPlace:()=>'',tournamentMapsUrl:()=>'',tournamentDrawLinks:()=>'',tournamentSurfaceLabel:()=>'',bindParticipantNavigation(){},displayDate:v=>String(v||'').split('-').reverse().join('-')};
 vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function fitpTournamentSubscriptionHtml('),ui.indexOf('const renderProfileWithoutStats')),context);context.renderTournament('T');return node('profileContent').innerHTML;
}
test('real tournament renderer shows each FITP player date, retains multiple dates and leaves ITF/Europe unchanged',()=>{
 const html=render('fitp');assert.match(html,/First Player[\s\S]*<\/button><span>Iscritto · <span class="fitpSubscriptionDate">[\s\S]*16-09-2026/);assert.match(html,/Second Player[\s\S]*<\/button><span>Iscritto · <span class="fitpSubscriptionDate">[\s\S]*17-09-2026[\s\S]*18-09-2026/);
 for(const circuit of ['itf','tennis-europe'])assert.ok(!render(circuit).includes('fitpSubscriptionDate'));
});
test('missing registration date is stated explicitly, never replaced by tournament/observation dates',()=>{
 const context={circuit:t=>t.circuit,esc:v=>v,displayDate:v=>v};vm.createContext(context);vm.runInContext(ui.slice(ui.indexOf('function fitpTournamentSubscriptionHtml('),ui.indexOf('function renderTournament(')),context);
 assert.match(context.fitpTournamentSubscriptionHtml({circuit:'fitp',startDate:'2026-10-16',lastSeen:'2026-10-14'}),/Data iscrizione non disponibile/);
});
