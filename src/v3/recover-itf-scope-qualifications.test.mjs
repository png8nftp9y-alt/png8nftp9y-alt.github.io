import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {TARGETS,EVENT,recoveryTasks,requireRecoveredQualification} from './recover-itf-scope-qualifications.mjs';
const baseline=JSON.parse(fs.readFileSync('src/v3/itf-audit-baseline-20261001.json','utf8'));
test('uses saved official IDs and acquires only the two exact boys qualification draws',()=>{
 const tasks=recoveryTasks(baseline);assert.equal(tasks.length,2);assert.deepEqual(tasks.map(t=>t.tournamentId),[1100203824,1100202687]);
 for(const t of tasks){assert.equal(t.event,EVENT);assert.equal(t.playerTypeCode,'B');assert.equal(t.matchTypeCode,'S');assert.equal(t.eventClassificationCode,'Q');assert.equal(t.drawsheetStructureCode,'KO');}
});
test('missing parameters, swapped IDs and external source URLs cannot change the recovery target',()=>{
 assert.throws(()=>recoveryTasks({tournaments:[]}));
 for(const change of [t=>{t.events.find(e=>e.event===EVENT).tournamentId=1100202687;},t=>{t.sourceUrl='https://example.invalid/'+t.competitionId.toLowerCase()+'/';}]){const b=structuredClone(baseline);change(b.tournaments.find(t=>t.competitionId===TARGETS[0].competitionId));assert.throws(()=>recoveryTasks(b));}
});
test('empty, retry, technical error and wrong-event replies never certify recovery',()=>{
 for(const target of TARGETS){const empty={competitionId:target.competitionId,event:EVENT,status:'complete',players:[],matches:[]};assert.throws(()=>requireRecoveredQualification(empty));assert.throws(()=>requireRecoveredQualification({...empty,status:'retry',error:'timeout'}));
 const valid={...empty,players:[{id:'8001',name:'Test'}],matches:[{matchId:'1',teams:[{players:[{id:'8001',name:'Test'}]}]}]};assert.equal(requireRecoveredQualification(valid).acquisitionState,'complete');assert.throws(()=>requireRecoveredQualification({...valid,event:'B-S-M-KO'}));}
});
test('workflow persists and verifies D1 through its existing serialized writer, with no Scope relaunch',()=>{
 const s=fs.readFileSync('.github/workflows/courtwatch-itf-scope-qualification-recovery.yml','utf8');assert.match(s,/needs: persist/);assert.match(s,/uses: \.\/\.github\/workflows\/courtwatch-itf-draw-d1-sync.yml/);assert.match(s,/require_artifacts: true/);assert.doesNotMatch(s,/gh run rerun|workflow_dispatch.*scope|verify-itf-opponent-scope/);
});
