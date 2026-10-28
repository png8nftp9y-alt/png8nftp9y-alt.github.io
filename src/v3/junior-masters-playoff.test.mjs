import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const ctx={readableText:v=>String(v||''),state:{data:{matches:[]}}};vm.createContext(ctx);
function extract(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}
vm.runInContext(extract('fullMatchRoundLabel')+'\n'+extract('agendaRoundCode'),ctx);
const match={circuit:'tennis-europe',tournamentName:'Tennis Europe Junior Masters',event:'BS16',round:'Round 1'};
test('Junior Masters placement Round 1 is Playoff in match rows and agenda',()=>{
 for(const playerName of ['Mitchell','Conticello']){
  const m={...match,playerName};assert.equal(ctx.fullMatchRoundLabel(m),'Playoff');assert.equal(ctx.agendaRoundCode(m),'Playoff');
 }
});
test('Junior Masters actual group rounds remain round robin',()=>{
 for(const m of [{...match,round:'Round Robin'},{...match,roundRobin:true},{...match,isRoundRobin:true},{...match,draw:'Round Robin BS16'}]){
  assert.equal(ctx.fullMatchRoundLabel(m),'Round robin');assert.equal(ctx.agendaRoundCode(m),'RR');
 }
});
test('ordinary Europe and ITF first rounds and Masters final stages retain their labels',()=>{
 assert.equal(ctx.fullMatchRoundLabel({...match,tournamentName:'Other Europe tournament'}),'Round 1');
 assert.equal(ctx.fullMatchRoundLabel({...match,circuit:'itf'}),'Round 1');
 assert.equal(ctx.fullMatchRoundLabel({...match,round:'Semi final'}),'Semi final');
 assert.equal(ctx.fullMatchRoundLabel({...match,round:'Final'}),'Final');
 assert.equal(ctx.fullMatchRoundLabel({...match,round:'Round of 16'}),'Round of 16');
});
test('opponent history passes the parent tournament identity to nested matches',()=>{
 const c={...ctx,mergeAgenda:(_old,rows)=>rows,groupedMatchSections:(rows,render)=>rows.map(render),opponentHistoryMatchRowHtml:(match,rows)=>ctx.fullMatchRoundLabel(match,rows)};
 vm.createContext(c);vm.runInContext(extract('opponentHistoryMatchSectionsHtml'),c);
 const rows=[{round:'Round 1',date:'2026-10-20'},{round:'Round Robin',date:'2026-10-19'}];
 assert.deepEqual(Array.from(c.opponentHistoryMatchSectionsHtml(rows,{name:'Tennis Europe Junior Masters',circuit:'tennis-europe'})),['Round robin','Playoff']);
 assert.deepEqual(Array.from(c.opponentHistoryMatchSectionsHtml(rows,{name:'Other tournament',circuit:'tennis-europe'})),['Round robin','Round 1']);
 assert.equal(rows[0].tournamentName,undefined);
 assert.ok(source.includes('opponentHistoryMatchSectionsHtml(tournament.matches || [], tournament)'));
});
