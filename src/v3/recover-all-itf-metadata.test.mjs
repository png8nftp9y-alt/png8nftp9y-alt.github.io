import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverMetadata} from './recover-all-itf-metadata.mjs';
import {acquire} from './recover-all-itf-metadata.mjs';
test('unpublished historical factsheets do not prevent later available fields from being acquired',async()=>{
 const targets=Array.from({length:8},(_,i)=>({competitionId:'J-'+i}));
 const r=await recoverMetadata(targets,{},async t=>t.competitionId==='J-7'?{venueName:'Official Club',address:'Official Address',qualificationStartDate:'2026-10-17'}:{_factsheetStatus:'not_public',_factsheetSourceUrl:'https://www.itftennis.com/historic'},{maxConsecutiveFailures:5});
 assert.equal(r.processed,8);assert.equal(r.acquired,1);assert.equal(r.stoppedReason,'');assert.equal(r.failures.length,0);assert.equal(r.unavailable.length,7);assert.equal(r.remaining.length,7);
});
test('progress/checkpoints preserve acquired fields and stop repeated useless reads',async()=>{
 const targets=Array.from({length:12},(_,i)=>({competitionId:'J-'+i})),events=[],saved=[],calls=[];
 const r=await recoverMetadata(targets,{},async t=>{calls.push(t.competitionId);if(t.competitionId==='J-0')return{venueName:'Official Club'};throw Error('timeout');},{maxConsecutiveFailures:5,onProgress:p=>events.push(p),onCheckpoint:p=>saved.push(JSON.parse(JSON.stringify(p)))});
 assert.equal(calls.length,6);assert.equal(r.processed,6);assert.equal(r.checked,12);assert.equal(r.stoppedReason,'consecutive_unproductive_reads');assert.equal(r.metadata['J-0'].venueName,'Official Club');assert.equal(r.remaining.length,12);assert.equal(saved.at(-1).metadata['J-0'].venueName,'Official Club');assert.equal(events.filter(x=>x.phase==='start').length,6);assert.equal(events.filter(x=>x.phase==='finish').length,6);
});
test('dedicated factsheet endpoint and HTTP failures are observable',async()=>{
 const keys=['ITF_FACTSHEET_ACQUISITION_URL','ITF_FACTSHEET_ACQUIRER_TOKEN'],old=keys.map(k=>process.env[k]);
 try{
  process.env[keys[0]]='https://acquirer.example/v1/factsheet';process.env[keys[1]]='fixture';
  const r=await recoverMetadata([{competitionId:'J-TEST',sourceUrl:'https://www.itftennis.com/example'}],{},t=>acquire(t,async url=>{assert.equal(url,process.env[keys[0]]);return {ok:false,status:400};}));
  assert.equal(r.failures[0].error,'factsheet_http_400');assert.equal(r.remaining.length,1);
 }finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}
});
test('recovery skips complete metadata, deduplicates IDs and retains valid partial results',async()=>{
 const targets=[{competitionId:'COMPLETE'},{competitionId:'NEW'},{competitionId:'NEW'},{competitionId:'BLOCKED'}],calls=[];
 const result=await recoverMetadata(targets,{COMPLETE:{venueName:'Club',address:'Address',qualificationStartDate:'2026-10-03'}},async t=>{calls.push(t.competitionId);if(t.competitionId==='BLOCKED')throw Error('blocked');return{venueName:'Official Club',address:'Official Address',qualificationStartDate:'2026-10-04'};});
 assert.deepEqual(new Set(calls),new Set(['NEW','BLOCKED']));assert.equal(result.checked,3);assert.equal(result.acquired,1);assert.equal(result.metadata.NEW.qualificationStartDate,'2026-10-04');assert.deepEqual(result.remaining,[{competitionId:'BLOCKED',missing:['venueName','qualificationStartDate']}]);
});
test('invalid qualifying dates stay missing and existing official club survives',async()=>{
 const result=await recoverMetadata([{competitionId:'PARTIAL'}],{PARTIAL:{venueName:'Existing Club'}},async()=>({address:'Address',qualificationStartDate:'unknown'}));
 assert.equal(result.metadata.PARTIAL.venueName,'Existing Club');assert.deepEqual(result.remaining[0].missing,['qualificationStartDate']);
});

test('existing tournament archives contribute saved fields without player filtering',async()=>{
 const {storedMetadata}=await import('./recover-all-itf-metadata.mjs');
 const rows=storedMetadata({relations:[{competitionId:'J-TEST',venueName:'Club',qualificationStartDate:'2026-10-01'}],tournaments:{'J-OTHER':{address:'Address',qualificationStartDate:'not a date'}}});
 assert.equal(rows['J-TEST'].venueName,'Club');assert.equal(rows['J-OTHER'].address,'Address');assert.equal(rows['J-OTHER'].qualificationStartDate,undefined);
});


test('future scope excludes today, concluded events and already-started qualifying',async()=>{
 const {futureMetadataTargets,enrichTournamentMetadata}=await import('./recover-all-itf-metadata.mjs');
 const catalogue={tournaments:[
  {competitionId:'J-PAST',startDate:'2026-10-12'},
  {competitionId:'J-TODAY',startDate:'2026-10-13'},
  {competitionId:'J-QUAL',startDate:'2026-10-19'},
  {competitionId:'J-FUTURE',startDate:'2026-10-19'},
  {competitionId:'J-FUTURE',startDate:'2026-10-19'},
  {competitionId:'J-UNKNOWN'}
 ]};
 const saved={'J-QUAL':{qualificationStartDate:'2026-10-13'},'J-FUTURE':{qualificationStartDate:'2026-10-17',venueName:'Club',address:'Address'},'J-PAST':{venueName:'Archive'}};
 assert.deepEqual(futureMetadataTargets(catalogue,saved,'2026-10-13').map(t=>t.competitionId),['J-FUTURE']);
 const enriched=enrichTournamentMetadata(catalogue,saved);
 assert.equal(enriched.tournaments[0].venueName,'Archive');
 assert.equal(enriched.tournaments[3].qualificationStartDate,'2026-10-17');
 assert.equal(enriched.tournaments[3].address,'Address');
 assert.equal(catalogue.tournaments[3].address,undefined);
});

test('address required only in Italy; foreign complete records are reused',async()=>{
 const targets=[{competitionId:'J-FRA',hostNationCode:'FRA'},{competitionId:'J-ITA',sourceUrl:'https://www.itftennis.com/en/tournament/example/ita/2026/j-ita/'}],existing=Object.fromEntries(targets.map(t=>[t.competitionId,{venueName:'Club',qualificationStartDate:'2026-10-30'}])),calls=[];
 const result=await recoverMetadata(targets,existing,async t=>{calls.push(t.competitionId);return{};});
 assert.deepEqual(calls,['J-ITA']);assert.deepEqual(result.remaining,[{competitionId:'J-ITA',missing:['address']}]);
});
