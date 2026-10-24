import test from 'node:test';
import assert from 'node:assert/strict';
import {fitpCategoryCode,fitpDrawLinks,loadFitpDrawLinks} from '../lib/fitp-draw-links.mjs';
const id='A62D829E-687A-4DC8-A2F8-FBEFEB690167';
const p1='CFE780A3-8CF2-4684-A51D-B1B3B0EECA0C',p2='EDAC2D97-1957-4081-852F-3D490CF411A3';
const section=(code,name)=>({SectionCode:code,SectionDescription:name,CompetitionId:id});
const singles={TournamentId:111,Gender:'M',IsDoubleTournament:false,TournamentDescription:'Singolare Maschile Under 14',Sections:[section(p1,'TABELLONE INIZIALE'),section(p2,'TABELLONE INTERMEDIO')]};
const doubles={TournamentId:222,Gender:'F',IsDoubleTournament:true,TournamentDescription:'Doppio Femminile Under 14',Sections:[section(p1,'TABELLONE FINALE')]};
test('SM14 has phase suffixes; a category with one draw has only DF14',()=>{
 const rows=fitpDrawLinks({Tournaments:[singles,doubles]},id);
 assert.deepEqual(rows.map(r=>r.label),['SM14 iniziale','SM14 intermedio','DF14']);
 assert.match(rows[0].url,new RegExp('tournamentId=111&phaseId='+p1));assert.match(rows[1].url,new RegExp('phaseId='+p2));assert.match(rows[2].url,/tournamentId=222/);
 assert.equal(rows[2].phase,'TABELLONE FINALE');
});
test('age is never guessed from a list of admitted ages and official phase details remain',()=>{
 assert.equal(fitpCategoryCode({...doubles,TournamentDescription:'Doppio Femminile Open',CategoryAge:'U12,U14,U16'}),'DF');
 assert.equal(fitpCategoryCode({...doubles,TournamentDescription:'Doppio Femminile',CategoryAge:'U14'}),'DF14');
 const t=structuredClone(singles);t.Sections[0].SectionDescription='TABELLONE INIZIALE - 4 CATEGORIA';assert.equal(fitpDrawLinks({Tournaments:[t]},id)[0].label,'SM14 iniziale 4 categoria');
});
test('duplicates, foreign competition IDs, invalid phases and round robin are not mislinked',()=>{
 const t=structuredClone(singles);t.Sections.push(t.Sections[0],{...t.Sections[0],SectionCode:'invalid'},{...t.Sections[0],CompetitionId:p2},{...t.Sections[0],IsGroup:1});assert.equal(fitpDrawLinks({Tournaments:[t]},id).length,2);
});
test('one official detail request, validated identity and explicit upstream failure',async()=>{
 let calls=0;const data=await loadFitpDrawLinks(id,async(url,options)=>{calls++;assert.match(url,/competizione\/dettaglio$/);assert.deepEqual(JSON.parse(options.body),{competitionUid:id});return Response.json({CompetitionUid:id,Tournaments:[doubles]})});assert.equal(calls,1);assert.equal(data.draws[0].label,'DF14');
 await assert.rejects(loadFitpDrawLinks('invalid',()=>{throw Error('no network')}),{status:400});
 await assert.rejects(loadFitpDrawLinks(id,async()=>Response.json({CompetitionUid:p2,Tournaments:[]})),/mismatch/);
 await assert.rejects(loadFitpDrawLinks(id,async()=>new Response('',{status:503})),/unavailable/);
 assert.deepEqual((await loadFitpDrawLinks(id,async()=>Response.json({Tournaments:[]}))).draws,[]);
});
