import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {mergeFitpRegistrationHistory,reuseStartedFitpSnapshot,validateFitpParticipantResponse} from './fitp-history-continuity.mjs';
const players=[{id:'aila-zennaro'}],past={playerId:'aila-zennaro',competitionId:'brallo',circuit:'fitp',tournamentName:'Brallo',startDate:'2026-08-02',endDate:'2026-08-08',status:'detected'};
const merge=o=>mergeFitpRegistrationHistory({players,today:'2026-11-26',...o});
test('empty successful refresh retains only confirmed past registrations, with no duplicate',()=>{assert.equal(merge({previous:[past],current:[]}).length,1);assert.equal(merge({previous:[past],recovered:[past],current:[past]}).length,1);assert.equal(merge({previous:[{...past,startDate:'2026-12-01',endDate:'2026-12-02'}]}).length,0);});
test('explicit withdrawal, cancellation, removed player and foreign circuit are never revived',()=>{assert.equal(merge({previous:[past],current:[{...past,status:'withdrawn'}]})[0].status,'detected');for(const e of [{...past,status:'withdrawn'},{...past,cancelled:true},{...past,playerId:'removed'},{...past,circuit:'itf'}])assert.equal(merge({previous:[e]}).length,0);});
test('started registration stays fixed; new future registrations remain',()=>{const result=merge({previous:[past],current:[{...past,location:'updated'},{...past,competitionId:'next',endDate:'2026-12-01'}]});assert.equal(result.length,2);assert.equal(result[0].location,undefined);});
test('concluded participant snapshot is reused even with an empty venue/address',()=>{assert.equal(reuseStartedFitpSnapshot(past,{participants:[{}],address:''},'2026-11-26'),true);assert.equal(reuseStartedFitpSnapshot({...past,startDate:'2026-12-01',endDate:'2026-12-02'},{},'2026-11-26'),false);assert.equal(reuseStartedFitpSnapshot(past,null,'2026-11-26'),false);});
test('recovery contains the exact 44 original official historical registrations',()=>{const seed=JSON.parse(fs.readFileSync(new URL('../../history/fitp-confirmed-history-recovery.json',import.meta.url)));assert.equal(seed.entries.length,44);assert.ok(seed.entries.every(e=>e.matchMethod==='membership_card'&&e.endDate<'2026-11-25'));assert.ok(seed.entries.some(e=>e.playerId==='aila-zennaro'&&e.competitionId==='8E872D3D-3E4E-4014-9606-ACADE6000B3F'));});

test('recovery refuses a changed membership card for the same configured player ID',()=>{assert.equal(mergeFitpRegistrationHistory({current:[],recovered:[{...past,membershipCard:'111'}],players:[{id:'aila-zennaro',membershipCard:'222'}],today:'2026-11-26'}).length,0);});

test('HTTP success with absent, malformed or wrong-competition detail cannot erase a cached participant list',()=>{for(const d of [null,{}, {CompetitionUid:'x'}, {CompetitionUid:'other',Tournaments:[]},{CompetitionUid:'x',Tournaments:[{Participants:{}}]}])assert.throws(()=>validateFitpParticipantResponse(d,'x'),/response_invalid/);assert.equal(validateFitpParticipantResponse({CompetitionUid:'x',Tournaments:[]},'x').Tournaments.length,0);});

test('registration updates stop on the start day and throughout ongoing tournaments',()=>{
 for(const start of ['2026-11-25','2026-11-26']){
  const ongoing={...past,startDate:start,endDate:'2026-11-29'};
  assert.equal(merge({previous:[ongoing],current:[]}).length,1);
  assert.equal(merge({previous:[ongoing],current:[{...ongoing,status:'withdrawn',draws:['changed']} ]})[0].status,'detected');
  assert.equal(reuseStartedFitpSnapshot(ongoing,{address:''},'2026-11-26'),true);
 }
 const future={...past,startDate:'2026-11-27',endDate:'2026-11-29'};
 assert.equal(merge({previous:[future],current:[]}).length,0);
 assert.equal(merge({previous:[future],current:[{...future,status:'withdrawn'}]})[0].status,'withdrawn');
});
