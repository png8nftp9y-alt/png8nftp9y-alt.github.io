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

import {readItfAuditRows,runPlacesAudit,ITF_PLACES_PAGE_SQL} from '../scripts/audit-itf-tournament-places.mjs';
import {database} from './search-sqlite-fixture.mjs';
const internal=()=>Error('diagnostic_d1_request_failed:http_500:codes_7500');
const placeRow=id=>({id,source_tournament_id:id,payload:JSON.stringify({name:'Tournament '+id,location:'City',venueName:'Club',startDate:'2026-10-01',endDate:'2026-10-07'})});

test('7500 repeats only its current read page, keeps the cursor and does not duplicate previous rows',async()=>{
 const calls=[],delays=[],stats={requests:0,retries:0,pages:0,rows:0,cursor:''};let failed=false;
 const client=createReadOnlyD1Client(async(sql,params)=>{calls.push([sql,params]);if(params[0]==='a'&&!failed){failed=true;throw internal();}return params[0]===''?[placeRow('a')]:params[0]==='a'?[placeRow('b')]:[];});
 const rows=await readItfAuditRows(client.query,{wait:async ms=>delays.push(ms),stats});
 assert.deepEqual(rows.map(r=>r.id),['a','b']);assert.deepEqual(calls.map(c=>c[1][0]),['','a','a','b']);assert.deepEqual(delays,[200]);assert.equal(stats.retries,1);assert.equal(stats.rows,2);assert(calls.every(c=>c[0]===ITF_PLACES_PAGE_SQL));
});
test('persistent 7500 stops after three requests; other errors are never retried',async()=>{
 let calls=0;const delays=[];await assert.rejects(readItfAuditRows(async()=>{calls++;throw internal();},{wait:async ms=>delays.push(ms)}),/codes_7500/);assert.equal(calls,3);assert.deepEqual(delays,[200,600]);
 for(const message of ['diagnostic_d1_request_failed:http_403:codes_7500','diagnostic_d1_request_failed:http_429:codes_none','diagnostic_d1_network_failed:request_timeout:stage_query','invalid SQL']){calls=0;await assert.rejects(readItfAuditRows(async()=>{calls++;throw Error(message);},{wait:async()=>{throw Error('must not wait')}}),error=>error.message===message);assert.equal(calls,1);}
});
test('unavailable D1 saves an incomplete error artifact and still fails, without certifying an empty result',async()=>{
 const saved=[];let calls=0;
 await assert.rejects(runPlacesAudit({openClient:async()=>createReadOnlyD1Client(async()=>{calls++;throw internal();}),wait:async()=>{},writeReport:async report=>saved.push(report),readJson:async()=>{throw Error('must not read catalogues')}}),/codes_7500/);
 assert.equal(calls,3);assert.equal(saved.length,1);assert.equal(saved[0].complete,false);assert.equal(saved[0].status,'unavailable');assert.equal(saved[0].writes,0);assert.equal(saved[0].stage,'read_itf_tournaments');assert.equal(saved[0].read.rows,0);assert.equal(saved[0].error,internal().message);
 const errors=[];await assert.rejects(runPlacesAudit({openClient:async()=>{throw Error('secret private credential');},writeReport:async report=>errors.push(report)}));assert.equal(errors[0].error,'itf_places_audit_failed');
});
test('invalid pagination, empty D1 and incomplete public catalogues cannot produce a complete report',async()=>{
 for(const batch of [[],[placeRow('b'),placeRow('a')],[placeRow('a'),placeRow('a')],Array.from({length:101},(_,i)=>placeRow(String(i)))])await assert.rejects(readItfAuditRows(async()=>batch),/empty_source|invalid_page/);
 const saved=[];let n=0;
 await assert.rejects(runPlacesAudit({openClient:async()=>createReadOnlyD1Client(async()=>n++?[]:[placeRow('a')]),readJson:async path=>{if(path.includes('history/'))throw Error('missing');return {tournaments:[]};},writeReport:async report=>saved.push(report)}),/incomplete_sources/);assert.equal(saved[0].complete,false);
});
test('SQLite projection preserves the complete audit across all pages, omits unrelated large payloads and writes zero',async()=>{
 const d=database();try{
  for(let i=0;i<205;i++){const id='t'+String(i).padStart(3,'0'),payload={...JSON.parse(placeRow(id).payload),clubName:'Alternative club',qualificationStartDate:'2026-09-30',hostNationCode:'ITA',unrelatedLargeField:'x'.repeat(2000)};d.execute('INSERT INTO tournaments VALUES(?,?,?,?,?,?)',[id,'itf','SOURCE-'+id,payload.startDate,payload.endDate,JSON.stringify(payload)]);}
  const before=d.writes(),full=d.execute("SELECT id,source_tournament_id,payload FROM tournaments WHERE circuit='itf' ORDER BY id"),calls=[];
  const client=createReadOnlyD1Client(async(sql,params)=>{calls.push(params);return d.execute(sql,params);}),projected=await readItfAuditRows(client.query);
  assert.equal(projected.length,205);assert.equal(calls.length,4);assert(projected.every(r=>!r.payload.includes('unrelatedLargeField')));assert(JSON.stringify(projected).length<JSON.stringify(full).length/5);
  const a=auditPlaces(full,new Map(),'2026-10-17'),b=auditPlaces(projected,new Map(),'2026-10-17');delete a.generatedAt;delete b.generatedAt;assert.deepEqual(b,a);assert.equal(d.writes(),before);
  const saved=[],result=await runPlacesAudit({openClient:async()=>client,readJson:async()=>({tournaments:[]}),writeReport:async report=>saved.push(report),today:'2026-10-17'});assert.equal(result.total,205);assert.equal(result.complete,true);assert.equal(saved.length,1);assert.equal(result.writes,0);
 }finally{d.close();}
});
