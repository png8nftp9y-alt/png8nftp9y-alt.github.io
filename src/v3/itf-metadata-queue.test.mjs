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
 assert.equal(s.tournaments['J-NEW'].status,'extraordinary');assert.deepEqual(s.tournaments['J-NEW'].missing,['address','qualificationStartDate']);assert.equal(s.tournaments['J-NEW'].checkedAt,now);assert.equal(metadataQueueStatus(s).extraordinary.missingFields,2);
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
