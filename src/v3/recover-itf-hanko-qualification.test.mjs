import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryTask,requireRecoveredDraw,COMPETITION,EVENT} from './recover-itf-hanko-qualification.mjs';
test('recovery requests only the official Hanko girls singles qualification',()=>{
 const task=recoveryTask({tournaments:[{competitionId:COMPETITION,sourceUrl:'https://www.itftennis.com/en/tournament/j30-hanko/fin/2026/j-j30-fin-2026-004/',events:[{event:'G-S-M-RR',tournamentId:1100202439},{event:EVENT,tournamentId:1100202439,tourType:'N',weekNumber:0}]}]});
 assert.equal(task.event,EVENT);assert.equal(task.eventClassificationCode,'Q');assert.equal(task.drawsheetStructureCode,'KO');assert.equal(task.tournamentId,1100202439);
});
test('recovery fails on empty/technical replies and accepts only target populated content',()=>{
 const empty={competitionId:COMPETITION,event:EVENT,status:'complete',players:[],matches:[]};assert.throws(()=>requireRecoveredDraw(empty));assert.throws(()=>requireRecoveredDraw({...empty,status:'retry',error:'incapsula'}));
 const valid={...empty,players:[{name:'Test player'}],matches:[{matchId:'1',teams:[{players:[{name:'Test player'}]}]}]};assert.equal(requireRecoveredDraw(valid).acquisitionState,'complete');assert.throws(()=>requireRecoveredDraw({...valid,event:'G-S-M-RR'}));
});
