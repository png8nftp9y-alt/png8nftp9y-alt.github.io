import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareResume,USER_EXCLUDED_DRAWS,SOURCE_RUN} from './resume-itf-resolved-parity.mjs';

function fixture(){
 const tournaments=Array.from({length:863},(_,i)=>({competitionId:i<2?USER_EXCLUDED_DRAWS[i].split('|')[0]:'tournament-'+i,classification:i<850?'complete':'cancelled_no_draws'}));
 const wanted=Array.from({length:4894},(_,i)=>{const [competitionId,event]=i<2?USER_EXCLUDED_DRAWS[i].split('|'):[tournaments[2+i%848].competitionId,'event-'+i];return{competitionId,event,drawKey:competitionId+'|'+event}});
 const scope={expectedResolved:863,completeTournaments:850,cancelledNoDraws:13,tournaments,wanted,missingR2:wanted.slice(0,2)};
 const documents=wanted.slice(2).map(x=>({...x,sha256:'a'.repeat(64),bytes:100,chunkCount:1,playerCount:2,matchCount:1,observedAt:'2026-10-07T12:00:00Z',acquisitionState:'complete'}));
 return{scope,selection:{documents}};
}
test('reuses exactly 4892 immutable source records and excludes only user-confirmed qualifications',()=>{
 const {scope,selection}=fixture(),before=JSON.stringify(selection),r=prepareResume(scope,selection);
 assert.equal(r.scope.wanted.length,4892);assert.equal(r.selection.documents.length,4892);
 assert.equal(JSON.stringify(selection),before);assert.strictEqual(r.selection.documents,selection.documents);
 assert.equal(r.scope.resumedFromRun,SOURCE_RUN);assert.equal(r.scope.userExcludedDraws.length,2);
 assert.equal(r.scope.fullPeriodCertified,false);assert.equal(r.scope.tournaments.length,863);
 assert.deepEqual(r.scope.missingR2,[]);assert.equal(scope.missingR2.length,2);
});
test('unexpected missing qualification or different scope cannot be waived',()=>{
 const {scope,selection}=fixture();
 assert.throws(()=>prepareResume({...scope,missingR2:[...scope.missingR2,{drawKey:'other'}]},selection),/missing R2/);
 assert.throws(()=>prepareResume({...scope,expectedResolved:864},selection),/scope/);
});
test('missing, extra and duplicated saved documents block resume',()=>{
 const {scope,selection}=fixture();
 assert.throws(()=>prepareResume(scope,{documents:selection.documents.slice(1)}),/missing, extra or duplicated/);
 assert.throws(()=>prepareResume(scope,{documents:[...selection.documents,selection.documents[0]]}),/missing, extra or duplicated/);
 const docs=selection.documents.slice();docs[0]={...docs[0],drawKey:'other'};
 assert.throws(()=>prepareResume(scope,{documents:docs}),/missing, extra or duplicated/);
});
test('corrupt source metadata or unverified acquisition blocks resume',()=>{
 for(const field of [{sha256:'wrong'},{bytes:0},{chunkCount:0},{matchCount:0},{acquisitionState:'archived_unverified'}]){
  const {scope,selection}=fixture();selection.documents[0]={...selection.documents[0],...field};
  assert.throws(()=>prepareResume(scope,selection),/Invalid saved source document/);
 }
});
