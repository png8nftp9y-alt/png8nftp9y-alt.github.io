import test from 'node:test';
import assert from 'node:assert/strict';
import {itfEventFilters,publishedItfDraw,officialItfDrawLinks} from '../lib/official-itf-draw-links.mjs';
const t={competitionId:'J-J30-SRB-2026-002',sourceUrl:'https://www.itftennis.com/en/tournament/j30-nis/srb/2026/j-j30-srb-2026-002/'};
const combo=(sex='B',kind='S')=>({tournamentId:123,playerTypeCode:sex,matchTypeCode:kind,eventClassificationCode:'M',drawsheetStructureCode:'KO'});
test('event filters retain only valid official draw combinations',()=>{
 assert.equal(itfEventFilters({filters:[combo(),combo(),{...combo(),drawsheetStructureCode:'WRONG'}]}).length,1);
 assert.equal(itfEventFilters({tournamentId:123,children:[{dataName:'playerTypeCode',valueCode:'G',matchTypeCode:'D',eventClassificationCode:'M',drawsheetStructureCode:'RR'}]})[0].event,'G-D-M-RR');
});
test('only a draw with a published player provides a display link',()=>{
 assert.equal(publishedItfDraw({matches:[{teams:[{players:[{playerId:800123456,givenName:'Test',familyName:'Player'}]}]}]}),true);
 assert.equal(publishedItfDraw({matches:[{teams:[]}]}),false);assert.equal(publishedItfDraw({playerId:1,name:'BYE'}),false);
});
test('unacquired published ITF draws are discovered while unpublished draws are omitted',async()=>{
 const seen=[];const fetcher=async url=>{seen.push(url);if(url.includes('GetEventFilters'))return Response.json({filters:[combo(),combo('G'),combo('G','D')]});return Response.json(url.includes('playerTypeCode=B')?{players:[{playerId:800123456,familyName:'Player'}]}:{matches:[]});};
 const result=await officialItfDrawLinks(t,{fetcher});assert.equal(result.draws.length,1);assert.equal(result.draws[0].event,'B-S-M-KO');assert.equal(result.complete,true);assert.equal(seen.length,4);
});
test('source failure retains proven links and never manufactures a new draw',async()=>{
 const known=[{event:'B-S-M-KO',drawUrl:t.sourceUrl+'draws-and-results/'}];let calls=0;
 const fetcher=async url=>{calls++;return url.includes('GetEventFilters')?Response.json({filters:[combo(),combo('G')]}):new Response('blocked',{status:403});};
 const result=await officialItfDrawLinks(t,{fetcher,known});assert.deepEqual(result.draws,known);assert.equal(result.complete,false);assert.equal(calls,2);
});
test('official RR sheet produces external ITF links and retains round/participant context',async()=>{
 const fetcher=async url=>Response.json(url.includes('GetEventFilters')?{filters:[{...combo('G'),drawsheetStructureCode:'RR'}]}:{rrGroups:['A','B'].map((groupName,i)=>({groupName,rounds:[{roundDesc:'Round 1',matches:[{teams:[{players:[{playerId:800792690+i,givenName:'Player',familyName:groupName}]}]}]}]}))});
 const result=await officialItfDrawLinks(t,{fetcher,withParticipants:true});assert.equal(result.draws.length,2);assert.equal(result.draws[0].group,'A');assert.equal(result.draws[1].group,'B');assert.match(result.draws[0].drawUrl,/itftennis\.com.*print\//);assert.match(result.draws[0].drawUrl,/drawsheetStructureCode=RR/);assert.equal(result.draws[0].matches[0].round,'Round 1');assert.equal(result.draws[1].participants[0].name,'Player B');
});
