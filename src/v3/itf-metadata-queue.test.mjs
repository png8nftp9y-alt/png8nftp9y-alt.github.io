import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileMetadataQueue,selectMetadataBatch,applyMetadataBatch,metadataQueueStatus} from './itf-metadata-queue.mjs';
import {renderMetadataQueue} from '../../cloudflare/app-api/lib/admin-itf-metadata.mjs';
const t=id=>({competitionId:id,startDate:'2026-11-01',endDate:'2026-11-07',tournamentName:'Example',sourceUrl:'https://www.itftennis.com/en/tournament/example/'}),cat=ids=>({tournaments:ids.map(t)}),now='2026-10-13T02:00:00Z',today='2026-10-13';
test('only genuinely new discoveries enter ordinary; rediscovery never requeues completed IDs',()=>{
 let s=reconcileMetadataQueue(null,cat(['J-OLD','J-NEW']),{},today,now,cat(['J-OLD']));assert.deepEqual(s.newIds,['J-NEW']);assert.equal(s.tournaments['J-OLD'].status,'extraordinary');assert.equal(s.tournaments['J-NEW'].status,'ordinary');
 s=reconcileMetadataQueue(s,cat(['J-NEW']),{'J-NEW':{venueName:'Club',address:'Street',qualificationStartDate:'2026-10-30'}},today,now);assert.equal(s.tournaments['J-NEW'].status,'complete');assert.deepEqual(s.newIds,[]);assert.equal(selectMetadataBatch(s,'ordinary').length,0);
 s=reconcileMetadataQueue(s,cat(['J-OLD','J-NEW']),{},today,now);assert.deepEqual(s.newIds,[]);
});
test('partial results leave ordinary once attempted, retain missing fields and individual check time',()=>{
 let s=reconcileMetadataQueue(null,cat(['J-NEW']),{},today,now,cat([]));s=applyMetadataBatch(s,{attempts:[{competitionId:'J-NEW',checkedAt:now,reason:'incapsula_blocked',error:'challenge'}]},now);s=reconcileMetadataQueue(s,cat(['J-NEW']),{'J-NEW':{venueName:'Club'}},today,now);
 assert.equal(s.tournaments['J-NEW'].status,'extraordinary');assert.deepEqual(s.tournaments['J-NEW'].missing,['qualificationStartDate']);assert.equal(s.tournaments['J-NEW'].checkedAt,now);assert.equal(metadataQueueStatus(s).extraordinary.missingFields,1);
});
test('eight per batch; rotation prevents unpublished factsheets starving later tournaments',()=>{
 let s=reconcileMetadataQueue(null,cat(Array.from({length:20},(_,i)=>'J-'+i)),{},today,now);const batch=selectMetadataBatch(s,'extraordinary');assert.equal(batch.length,8);s=applyMetadataBatch(s,{attempts:batch.map(t=>({competitionId:t.competitionId,checkedAt:now,reason:'factsheet_not_public'}))},now);assert.ok(selectMetadataBatch(s,'extraordinary').every(t=>!batch.some(b=>b.competitionId===t.competitionId)));
});
test('qualifications already started exit recovery; past tournaments never enter either queue',()=>{
 let s=reconcileMetadataQueue(null,cat(['J-X']),{},today,now);s=reconcileMetadataQueue(s,cat(['J-X']),{'J-X':{qualificationStartDate:today}},today,now);assert.equal(s.tournaments['J-X'].status,'out_of_scope');assert.equal(metadataQueueStatus(s).extraordinary.total,0);assert.equal(Object.keys(reconcileMetadataQueue(null,{tournaments:[{...t('J-PAST'),startDate:'2026-10-01'}]}, {},today,now).tournaments).length,0);
});
test('unattempted ordinary IDs survive a time budget; concurrent newly discovered IDs survive publication',()=>{
 let s=reconcileMetadataQueue(null,cat(['J-A','J-B']),{},today,now,cat([]));s=applyMetadataBatch(s,{attempts:[{competitionId:'J-A',checkedAt:now}]},now);assert.equal(s.tournaments['J-B'].status,'ordinary');s=reconcileMetadataQueue(s,cat(['J-A','J-B','J-C']),{},today,now);assert.equal(s.tournaments['J-C'].status,'ordinary');assert.equal(s.tournaments['J-A'].status,'extraordinary');
});
test('metadata diagnostic escapes tournament names/errors and matches draw table columns',()=>{
 const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');let s=reconcileMetadataQueue(null,cat(['J-X']),{},today,now);s.tournaments['J-X'].tournamentName='<script>';const html=renderMetadataQueue(metadataQueueStatus(s),esc,()=> 'ora');assert.ok(html.includes('&lt;script>'));assert.ok(!html.includes('<script>'));for(const h of ['Presi','Mancanti','Perché mancano','Controllo','Ordinario','Straordinario'])assert.ok(html.includes(h));
});

test('user-resolved Egyptian team finals stay resolved across discovery and in-flight publication',()=>{
 const ids=['J-GC-EGY-07A-2026','J-GC-EGY-03A-2026'];let s=reconcileMetadataQueue(null,cat(ids),{},today,now);
 assert.equal(metadataQueueStatus(s).extraordinary.total,0);assert.equal(metadataQueueStatus(s).coverage.resolved,2);assert.equal(metadataQueueStatus(s).coverage.userResolved,2);
 s=applyMetadataBatch(s,{attempts:ids.map(competitionId=>({competitionId,checkedAt:now,reason:'factsheet_not_public'}))},now);
 s=reconcileMetadataQueue(s,cat(ids),{},today,now,cat([]));
 for(const id of ids){assert.equal(s.tournaments[id].status,'user_resolved');assert.equal(s.tournaments[id].resolvedByUser,true);assert.equal(s.tournaments[id].missing.length,2);}
 assert.equal(selectMetadataBatch(s,'ordinary').length,0);assert.equal(selectMetadataBatch(s,'extraordinary').length,0);
});

test('foreign address-only gaps complete; Italian gaps stay queued across publication',()=>{
 const catalogue={tournaments:[{...t('J-FOREIGN'),hostNationCode:'FRA'},{...t('J-ITALIAN'),hostNationCode:'ITA'}]},saved=Object.fromEntries(catalogue.tournaments.map(t=>[t.competitionId,{venueName:'Club',qualificationStartDate:'2026-10-30'}]));
 let state=reconcileMetadataQueue(null,catalogue,{},today,now);
 state=reconcileMetadataQueue(state,catalogue,saved,today,now);
 assert.equal(state.tournaments['J-FOREIGN'].status,'complete');assert.deepEqual(state.tournaments['J-FOREIGN'].missing,[]);
 assert.deepEqual(state.tournaments['J-ITALIAN'].missing,['address']);assert.deepEqual(selectMetadataBatch(state,'extraordinary').map(t=>t.competitionId),['J-ITALIAN']);
 state=applyMetadataBatch(state,{attempts:[{competitionId:'J-FOREIGN',checkedAt:now}]},now);state=reconcileMetadataQueue(state,catalogue,saved,today,now);
 assert.equal(state.tournaments['J-FOREIGN'].status,'complete');assert.equal(metadataQueueStatus(state).extraordinary.missingFields,1);
});

const june={tournaments:[{...t('J-JUNE'),startDate:'2027-06-01',endDate:'2027-06-06',hostNationCode:'INA'}]};
const club={'J-JUNE':{venueName:'Official Club'}};
function juneState(now,checkedAt){let s=reconcileMetadataQueue(null,june,club,now.slice(0,10),now);if(checkedAt)s=applyMetadataBatch(s,{attempts:[{competitionId:'J-JUNE',checkedAt}]},now);return reconcileMetadataQueue(s,june,club,now.slice(0,10),now);}
test('distant partial tournaments wait one week without losing acquired metadata or looping',()=>{
 const s=juneState('2026-10-24T14:00:00Z','2026-10-24T13:00:00Z'),row=s.tournaments['J-JUNE'];
 assert.equal(row.retryCadence,'weekly');assert.equal(row.nextCheckAt,'2026-10-31T00:00:00.000Z');assert.equal(row.alert,false);
 assert.deepEqual(row.acquired,['venueName']);assert.deepEqual(row.missing,['qualificationStartDate']);
 assert.equal(selectMetadataBatch(s,'extraordinary').length,0);assert.equal(metadataQueueStatus(s).extraordinary.total,1);
 const due=juneState('2026-10-31T05:17:00Z','2026-10-24T13:00:00Z');assert.equal(selectMetadataBatch(due,'extraordinary').length,1);
});
test('daily phase starts March 1 even when the weekly deadline would be later',()=>{
 const feb=juneState('2027-02-28T05:17:00Z','2027-02-27T05:20:00Z');assert.equal(feb.tournaments['J-JUNE'].nextCheckAt,'2027-03-01T00:00:00.000Z');
 const march=juneState('2027-03-01T05:17:00Z','2027-02-27T05:20:00Z');assert.equal(march.tournaments['J-JUNE'].retryCadence,'daily');assert.equal(selectMetadataBatch(march,'extraordinary').length,1);
 const done=juneState('2027-03-01T05:20:00Z','2027-03-01T05:19:00Z');assert.equal(selectMetadataBatch(done,'extraordinary').length,0);
 const tomorrow=juneState('2027-03-02T05:17:00Z','2027-03-01T05:19:00Z');assert.equal(selectMetadataBatch(tomorrow,'extraordinary').length,1);
});
test('April alert includes missing fields and disappears when acquired or out of scope',()=>{
 const march=juneState('2027-03-31T12:00:00Z','2027-03-31T11:00:00Z');assert.equal(metadataQueueStatus(march).alerts.total,0);
 let april=juneState('2027-04-01T05:17:00Z','2027-03-31T11:00:00Z');assert.equal(metadataQueueStatus(april).alerts.total,1);
 const html=renderMetadataQueue(metadataQueueStatus(april),String,()=> 'ora');assert.ok(html.includes('ATTENZIONE'));assert.ok(html.includes('Prossimo tentativo'));assert.ok(html.includes('Data qualificazioni'));
 const complete=reconcileMetadataQueue(april,june,{'J-JUNE':{venueName:'Official Club',qualificationStartDate:'2027-05-30'}},'2027-04-01','2027-04-01T06:00:00Z');assert.equal(metadataQueueStatus(complete).alerts.total,0);assert.equal(complete.tournaments['J-JUNE'].nextCheckAt,undefined);
 const past=reconcileMetadataQueue(april,june,club,'2027-06-02','2027-06-02T06:00:00Z');assert.equal(metadataQueueStatus(past).alerts.total,0);assert.equal(past.tournaments['J-JUNE'].status,'out_of_scope');
});
test('new discoveries get an immediate first attempt; completed and user-resolved never retry',()=>{
 const s=reconcileMetadataQueue(null,june,club,'2026-10-24','2026-10-24T12:00:00Z',{tournaments:[]});assert.equal(selectMetadataBatch(s,'ordinary').length,1);
 const done=applyMetadataBatch(s,{attempts:[{competitionId:'J-JUNE',checkedAt:'2026-10-24T12:00:00Z'}]},'2026-10-24T12:01:00Z');assert.equal(selectMetadataBatch(done,'extraordinary').length,0);
});
test('month-end boundaries clamp to the last valid day',async()=>{
 const {metadataRetrySchedule}=await import('./itf-metadata-queue.mjs');const s=metadataRetrySchedule({status:'extraordinary',startDate:'2027-05-31',checkedAt:'2027-02-27T12:00:00Z'},'2027-02-27T13:00:00Z');assert.equal(s.nextCheckAt,'2027-02-28T00:00:00.000Z');assert.equal(s.alertAt,'2027-03-31T00:00:00.000Z');
});
