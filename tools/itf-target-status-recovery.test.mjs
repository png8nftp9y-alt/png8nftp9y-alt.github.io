import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {recoverTournament,validateDocument,summarizePair,sectionKey} from './itf-target-status-recovery.mjs';
const id='J-J30-VIE-2026-007',event='B-S-Q-KO';
const combo={tournamentId:1100204552,playerTypeCode:'B',matchTypeCode:'S',eventClassificationCode:'Q',drawsheetStructureCode:'KO'};
const tournament={competitionId:id,sourceUrl:'https://www.itftennis.com/en/tournament/example/'};
const document={koGroups:[{rounds:[{matches:[{matchId:1183706228,playStatusDesc:'Not played',playStatusCode:'NP',resultStatusDesc:'Walkover',resultStatusCode:'WO',teams:[null,{players:[null,{playerId:800687542}]}]}]}]}]};
const row={competitionId:id,event,document};
const block=async()=>{throw Error('GetEventFilters_incapsula_challenge')};
test('retained valid document triggers no source reads',async()=>{
 const result=await recoverTournament({tournament,events:[event],saved:new Map([[sectionKey(id,event),row]]),inventory:()=>assert.fail('inventory'),draw:()=>assert.fail('draw'),browser:()=>assert.fail('browser')});
 assert.equal(result.sections.length,1);assert.deepEqual(result.failures,[]);
});
test('direct success saves once and never opens browser',async()=>{
 const saved=[];const result=await recoverTournament({tournament,events:[event],inventory:async()=>[combo],draw:async()=>document,browser:()=>assert.fail('browser'),onDocument:async r=>saved.push(r)});
 assert.equal(saved.length,1);assert.equal(result.sections.length,1);
});
test('blocked inventory uses browser with only requested event',async()=>{
 const result=await recoverTournament({tournament,events:[event],inventory:block,draw:()=>assert.fail('draw'),browser:async(t,options)=>{assert.deepEqual(options,{events:[event]});return {outcomes:[{combo,json:document}]}}});
 assert.equal(result.sections.length,1);assert.equal(result.failures.length,0);
});
test('partial direct failure retries only the missing section',async()=>{
 const other={...combo,eventClassificationCode:'M'},events=[event,'B-S-M-KO'];
 const result=await recoverTournament({tournament,events,inventory:async()=>[combo,other],draw:async c=>{if(c===combo)throw Error('blocked');return document},browser:async(t,options)=>{assert.deepEqual(options.events,[event]);assert.deepEqual(options.tasks,[combo]);return{outcomes:[{combo,json:document}]}}});
 assert.equal(result.sections.length,2);assert.equal(result.failures.length,0);
});
test('browser protection failure remains explicit',async()=>{
 const result=await recoverTournament({tournament,events:[event],inventory:block,browser:async()=>{throw Error('browser_incapsula_challenge')}});
 assert.equal(result.sections.length,0);assert.deepEqual(result.failures,[{event,error:'browser_incapsula_challenge'}]);
});
test('missing official event remains unresolved',async()=>{
 const result=await recoverTournament({tournament,events:[event],inventory:async()=>[],browser:async()=>({outcomes:[]})});
 assert.equal(result.sections.length,0);assert.match(result.failures[0].error,/event_not_returned/);
});
test('walkover survives null player slots without asserting played participation',()=>{
 const result=summarizePair('800687542',[row]);assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].resultStatus,'Walkover');assert.equal(result.matches[0].resultStatusCode,'WO');assert.equal(result.matches[0].playStatusCode,'NP');
 assert.equal(summarizePair('another-player',[row]).status,'unresolved');assert.equal('played' in result,false);
});
test('malformed or empty saved documents cannot claim completeness',()=>{
 assert.throws(()=>validateDocument({...row,document:{}}),/invalid_draw/);
 assert.throws(()=>validateDocument({...row,document:{koGroups:[]}}),/empty_draw/);
});
test('checkpoint write failure stops instead of reporting source success',async()=>{
 await assert.rejects(recoverTournament({tournament,events:[event],inventory:async()=>[combo],draw:async()=>document,onDocument:async()=>{throw Error('disk full')},browser:()=>assert.fail('browser')}),/disk full/);
});
test('real browser reader filters unrelated events before draw requests',async()=>{
 const calls=[];let closed=false;
 const page={goto:async()=>{},reload:async()=>{},evaluate:async(fn,url)=>{calls.push(url);return {status:200,text:JSON.stringify(url.includes('GetEventFilters')?{combos:[combo,{...combo,matchTypeCode:'D'}]}:document)}}};
 const context={chromium:{launch:async()=>({newContext:async()=>({newPage:async()=>page}),close:async()=>{closed=true}})},API:'https://www.itftennis.com/tennis/api/TournamentApi',eventCombinations:x=>x.combos,setTimeout:fn=>fn(),URLSearchParams,Set,Error,JSON};
 vm.createContext(context);
 const source=readFileSync(new URL('../src/v3/read-itf-draws-browser.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export async function readTournamentDrawsInBrowser','async function readTournamentDrawsInBrowser');
 vm.runInContext(source+';globalThis.run=readTournamentDrawsInBrowser;',context);
 const result=await context.run(tournament,{events:[event]});assert.equal(result.outcomes.length,1);assert.equal(closed,true);
 assert.equal(calls.filter(x=>x.includes('GetDrawsheet')).length,1);
 assert.match(calls.find(x=>x.includes('GetDrawsheet')),/matchTypeCode=S/);
});
