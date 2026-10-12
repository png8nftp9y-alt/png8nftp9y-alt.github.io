import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverMetadata} from './recover-all-itf-metadata.mjs';
import {acquire} from './recover-all-itf-metadata.mjs';
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
 assert.deepEqual(new Set(calls),new Set(['NEW','BLOCKED']));assert.equal(result.checked,3);assert.equal(result.acquired,1);assert.equal(result.metadata.NEW.qualificationStartDate,'2026-10-04');assert.deepEqual(result.remaining,[{competitionId:'BLOCKED',missing:['venueName','address','qualificationStartDate']}]);
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
