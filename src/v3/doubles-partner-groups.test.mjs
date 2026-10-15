import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const ctx={readableText:v=>String(v||'').trim(),matchMeta:m=>({isDouble:m.matchType==='doubles'}),
 partnerHtml:m=>`<button data-id="${m.linkId||'pending'}">${m.partner}${m.ranking?' n°'+m.ranking:''}</button>`,
 matchHistoryRowHtml:m=>`<div class="row">${m.id}:${m.score||''}</div>`,
 opponentHistoryPersonHtml:p=>`<button data-id="${p.profileId||'pending'}">${p.name}${p.ranking?' n°'+p.ranking:''}</button>`,
 opponentHistoryMatchRowHtml:m=>`<div class="row">${m.id}:${m.score||''}</div>`};
ctx.circuit=m=>m.circuit;
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function agendaKey('),source.indexOf('function mergeKnownMatches(')),ctx);
vm.runInContext(source.slice(source.indexOf('const readablePerson ='),source.indexOf('const IOC_REGION =')),ctx);
vm.runInContext(source.slice(source.indexOf('function doublesPartnerGroupKey('),source.indexOf('function renderOpponentHistory(')),ctx);
vm.runInContext(source.slice(source.indexOf('function matchHistorySectionsHtml('),source.indexOf('function tournamentOfficialUrl(')),ctx);
const full={id:'13-october',matchType:'doubles',partner:'Ivona Dirnbek',ranking:384,linkId:'official-id',score:'6-0 7-5'};
const tomorrow={...full,id:'14-october',ranking:null,linkId:'another-link',score:''};
const headings=html=>(html.match(/<h5 /g)||[]).length;
test('Cereghini completed and future doubles share a heading despite different ranking and links',()=>{
 for(const rows of [[full,tomorrow],[tomorrow,full]]){
  const html=ctx.matchHistorySectionsHtml(rows);
  assert.equal(headings(html),1);assert.match(html,/Doppio con/);
  assert.match(html,/13-october:6-0 7-5/);assert.match(html,/14-october:/);
 }
});
test('same partner with case, repeated surname or diacritics does not split the group',()=>{
 for(const partner of ['IVONA DIRNBEK','Ivona Dirnbek DIRNBEK','Ivona Dírnbek'])
  assert.equal(headings(ctx.matchHistorySectionsHtml([full,{...tomorrow,partner}])),1);
});
test('singles, different partners and doubles without known partners remain distinct',()=>{
 const html=ctx.matchHistorySectionsHtml([full,tomorrow,{...full,id:'different',partner:'Another Partner'},
  {...full,id:'unknown',partner:''},{id:'single',matchType:'singles'}]);
 assert.equal(headings(html),4);assert.match(html,/>Singolare</);assert.match(html,/>Doppio</);
 assert.equal((html.match(/class="row"/g)||[]).length,5);
});
test('opponent history also groups the same partner independently of ranking/profile link markup',()=>{
 const rows=[{id:'old',partners:[{name:'Ivona Dirnbek',ranking:384,profileId:'id'}],score:'6-0 7-5'},
  {id:'next',partners:[{name:'IVONA DIRNBEK',profileId:'different'}]}];
 const html=ctx.opponentHistoryMatchSectionsHtml(rows);
 assert.equal(headings(html),1);assert.match(html,/old:6-0 7-5/);assert.match(html,/next:/);
});
