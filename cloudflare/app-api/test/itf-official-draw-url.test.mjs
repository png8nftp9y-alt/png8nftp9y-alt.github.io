import test from 'node:test';import assert from 'node:assert/strict';import {officialItfDrawUrl} from '../lib/itf-official-draw-url.mjs';
const t={competitionId:'J-J30-HUN-2026-002',sourceUrl:'https://www.itftennis.com/en/tournament/j30-szentes/hun/2026/j-j30-hun-2026-002/'};
test('verified Szentes numeric ID links to the official filtered print view, not an app URL',()=>{
 const a=new URL(officialItfDrawUrl(t,'G-S-M-RR'));assert.equal(a.origin,'https://www.itftennis.com');assert.equal(a.pathname,'/en/tournament/draws-and-results/print/');assert.equal(a.searchParams.get('tournamentId'),'1100202888');assert.equal(a.searchParams.get('drawsheetStructureCode'),'RR');assert.equal(a.searchParams.get('playerTypeCode'),'G');assert.equal(a.searchParams.get('matchTypeCode'),'S');assert.equal(a.searchParams.get('eventClassificationCode'),'M');
 assert.notEqual(a.href,officialItfDrawUrl(t,'G-S-Q-KO'));assert.notEqual(officialItfDrawUrl(t,'G-S-M-KO'),officialItfDrawUrl(t,'G-D-M-KO'));assert.doesNotMatch(a.href,/group=|app\/api/);
});
test('all known Agno editions retain their distinct verified IDs',()=>{
 const ids=['002','003','004','005','006'].map(n=>new URL(officialItfDrawUrl({...t,competitionId:'J-J30-SUI-2026-'+n},'G-S-M-KO')).searchParams.get('tournamentId'));assert.equal(new Set(ids).size,5);assert(ids.every(x=>/^1100\d+$/.test(x)));assert.equal(ids[4],'1100203183');
});
test('unknown native ID falls back to the validated official tournament URL, never a fabricated print ID',()=>{
 const unknown={competitionId:'J-J30-ITA-2026-999',sourceUrl:'https://www.itftennis.com/en/tournament/test/ita/2026/j-j30-ita-2026-999/'};assert.equal(officialItfDrawUrl(unknown,'G-S-M-KO'),unknown.sourceUrl+'draws-and-results/');assert.equal(officialItfDrawUrl({...unknown,sourceUrl:'https://evil.test/'+unknown.competitionId},'G-S-M-KO'),'');
});
