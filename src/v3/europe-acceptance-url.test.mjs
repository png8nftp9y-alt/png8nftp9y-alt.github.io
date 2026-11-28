import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../../v3.js',import.meta.url),'utf8'),ctx={URL,circuit:t=>t.circuit};vm.createContext(ctx);vm.runInContext(js.slice(js.indexOf('function tournamentAcceptanceUrl('),js.indexOf('function itfAcceptanceListUrl(')),ctx);
const id='E6C27FE1-A487-440E-9C38-AE8717B4FDE5',base={circuit:'tennis-europe',competitionId:id},url=`https://te.tournamentsoftware.com/sport/acceptancelist.aspx?id=${id}`;
test('Rotterdam catalogue missing .aspx is repaired; observed links retain their event parameter',()=>{
 assert.equal(ctx.tournamentAcceptanceUrl({...base,acceptanceListUrl:url.replace('.aspx','')}),url);
 assert.equal(ctx.tournamentAcceptanceUrl({...base,acceptanceListUrl:url+'&event=2'}),url+'&event=2');
 assert.equal(ctx.tournamentAcceptanceUrl({...base,sourceUrl:url.replace('.aspx','')}),url);
 assert.equal(ctx.tournamentAcceptanceUrl({...base,acceptanceListUrl:'/sport/acceptancelist?id='+id}),url);
});
test('invalid or different-tournament acceptance metadata falls back to this tournament',()=>{
 for(const acceptanceListUrl of ['null','https://example.invalid/acceptancelist?id='+id,url.replace(id,'OTHER'),'javascript:alert(1)'])assert.equal(ctx.tournamentAcceptanceUrl({...base,acceptanceListUrl}),url);
 assert.equal(ctx.tournamentAcceptanceUrl(base),url);assert.equal(ctx.tournamentAcceptanceUrl({...base,circuit:'itf'}),'');assert.equal(ctx.tournamentAcceptanceUrl({...base,manualEvent:true}),'');
});
