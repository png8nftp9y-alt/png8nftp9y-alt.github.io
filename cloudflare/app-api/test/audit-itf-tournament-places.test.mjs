import test from 'node:test';import assert from 'node:assert/strict';
import {auditPlaces} from '../scripts/audit-itf-tournament-places.mjs';
import {createReadOnlyD1Client} from '../lib/read-only-d1-client.mjs';
test('D1_TEST_READ_ONLY_TRANSPORT / D1_TEST_MUTATIONS_REJECTED: audit client permits reads only',async()=>{
 let calls=0;const {query}=createReadOnlyD1Client(async()=>{calls++;return[];});
 await query("SELECT id FROM tournaments WHERE circuit='itf'");
 await assert.rejects(query('DELETE FROM tournaments'));assert.equal(calls,1);
});
test('all periods are audited by exact ID, missing values remain explicit, stored gaps differ from effective gaps',()=>{
 const row=(id,start,end,venue='')=>({source_tournament_id:id,payload:JSON.stringify({circuit:'itf',location:'City, Country',startDate:start,endDate:end,venueName:venue})});
 const rows=[row('PAST','2026-01-01','2026-01-07'),row('NOW','2026-10-12','2026-10-18','Club'),row('FUTURE','2027-01-01','2027-01-07')];
 const result=auditPlaces(rows,new Map([['itf|PAST',{venueName:'Official Club'}]]),'2026-10-17');
 assert.equal(result.total,3);assert.equal(result.writes,0);assert.equal(result.effectiveComplete,2);
 assert.deepEqual(result.restoredByPresentation,['PAST']);assert.equal(result.missing[0].competitionId,'FUTURE');
 assert.equal(result.counts.past.storedIncomplete,1);assert.equal(result.counts.past.effectiveIncomplete,0);assert.equal(result.counts.future.effectiveIncomplete,1);
});
