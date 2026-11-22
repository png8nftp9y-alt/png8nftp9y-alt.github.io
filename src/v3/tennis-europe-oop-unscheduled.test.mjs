import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inventoryOopPage,auditOopCompleteness,recoverOopResults} from './tennis-europe-oop-completeness.mjs';
const tournament={competitionId:'2BF870B2-F147-411A-9BF7-C68DD148696C',startDate:'2026-11-21',endDate:'2026-11-29'};
const html=readFileSync(new URL('./fixtures/te-soul-cup-20261123-not-scheduled.html',import.meta.url),'utf8');
const page=()=>inventoryOopPage(html,tournament.competitionId,'20261123');
const audit=(p,matches=[],asOf='2026-11-22')=>auditOopCompleteness({tournament,pages:[p],matches,asOf});
test('real Soul Cup page explicitly inventories six unscheduled pairings without fabricating agenda slots',()=>{
 const p=page();assert.equal(p.cards.length,35);
 const pending=p.cards.filter(c=>c.scheduleStatus==='official_not_scheduled');assert.equal(pending.length,6);
 assert.deepEqual(pending[0].players.map(p=>p.name),['Aras KIRCA','Amirkhan KUANYSHBEKOV']);
 const report=audit({...p,cards:pending});assert.equal(report.status,'complete');assert.equal(report.resolutions.length,6);
 assert.ok(report.resolutions.every(r=>r.kind==='official_pairing_not_scheduled'&&r.schedulePending&&r.players.length===2&&!r.court&&!r.time&&!r.courtMatchNumber));
 const matches=[];assert.equal(recoverOopResults({tournament,pages:[{...p,cards:pending}],matches}).length,0);assert.equal(matches.length,0);
 // Every scheduled card still requires acquisition independently.
 assert.equal(audit(p).issues.length,29);
});
test('the scheduled section after Not scheduled never inherits the unscheduled disposition',()=>{
 const p=page(),pending=p.cards.filter(c=>c.scheduleStatus==='official_not_scheduled');
 const card=pending[0].evidenceHtml.split('<li class="match-group__item">')[0];
 const source='<h5 class="match-group__header">Not scheduled</h5>'+card+'<h5 class="match-group__header">Court 1</h5>'+card;
 const cards=inventoryOopPage(source,tournament.competitionId,'20261123').cards;
 assert.equal(cards.length,2);assert.equal(cards[0].scheduleStatus,'official_not_scheduled');assert.equal(cards[1].scheduleStatus,'');assert.equal(audit({cards,explicitEmpty:false,date:'20261123'}).issues.length,1);
});
test('results, winners, retirements, missing participants, past dates and missing native group still fail',()=>{
 const p=page(),card=p.cards.find(c=>c.scheduleStatus==='official_not_scheduled');
 for(const patch of [{score:'6-3 6-2'},{winnerIds:['192']},{retired:true},{players:card.players.slice(0,1)},{players:[card.players[0],card.players[0]]},{scheduleStatus:''}])assert.equal(audit({...p,cards:[{...card,...patch}]}).status,'incomplete');
 assert.equal(audit({...p,cards:[card]},[],'2026-11-24').status,'incomplete');
 assert.equal(audit({...p,cards:[card]},[],'2026-11-23').status,'complete');
});
