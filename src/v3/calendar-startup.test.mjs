import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const restore=source.slice(source.indexOf('function restoreCachedProjectionBeforeFirstRender()'),source.indexOf('function saveCachedData(data)'));
const filter=source.slice(source.indexOf('function renderFilters()'),source.indexOf('function matchTournament('));
const readable=source.slice(source.indexOf('const readablePerson ='),source.indexOf('const IOC_REGION ='));
test('cached personal players and tournaments exist before the first route without awaiting network',()=>{
 const saved={players:[{id:'c',name:'Camilla Frigerio'},{id:'p',name:'Paolo Brambilla'},{id:'r',name:'Riccardo Galbiati'}],tournaments:[{playerId:'c',name:'Cantù'},{playerId:'p',name:'Cantù'},{playerId:'r',name:'Cantù'}]};
 const ctx={cachedData:()=>saved,state:{data:null,selected:new Set(['c','p','r'])},uiSelectionRestored:true};
 vm.createContext(ctx);vm.runInContext(restore,ctx);
 assert.equal(ctx.restoreCachedProjectionBeforeFirstRender(),true);
 assert.equal(ctx.state.data.tournaments.length,3);assert.equal(ctx.state.selected.size,3);
 const boot=source.slice(source.lastIndexOf('restoreCachedProjectionBeforeFirstRender();'));
 assert.ok(boot.indexOf('restoreCachedProjectionBeforeFirstRender();')<boot.indexOf('route();'));
 assert.ok(boot.indexOf('route();')<boot.indexOf('load();'));
});
test('restoring cache preserves deselect all and an explicit player subset',()=>{
 const saved={players:[{id:'a'},{id:'b'}],tournaments:[]};
 for(const selected of [[],['b']]){
  const ctx={cachedData:()=>saved,state:{data:null,selected:new Set(selected)},uiSelectionRestored:true};
  vm.createContext(ctx);vm.runInContext(restore,ctx);ctx.restoreCachedProjectionBeforeFirstRender();
  assert.deepEqual(Array.from(ctx.state.selected),selected);
 }
});
test('no cache does not create an empty fabricated projection',()=>{
 const ctx={cachedData:()=>null,state:{data:null,selected:new Set()},uiSelectionRestored:false};
 vm.createContext(ctx);vm.runInContext(restore,ctx);
 assert.equal(ctx.restoreCachedProjectionBeforeFirstRender(),false);assert.equal(ctx.state.data,null);
});
test('select-deselect calendar chips are alphabetical and keep the chosen IDs',()=>{
 const nodes={},players=[{id:'r',name:'RICCARDO GALBIATI'},{id:'p',name:'PAOLO BRAMBILLA'},{id:'c',name:'CAMILLA FRIGERIO'},{id:'a',name:'Anna Test'}];
 const state={data:{players},selected:new Set(['p','c']),sexFilter:'all',categoryFilters:new Set()};
 const ctx={state,readableText:x=>String(x||''),$:id=>nodes[id]??={},
 calendarEligiblePlayers:()=>players,esc:x=>String(x??''),document:{querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext(readable+filter,ctx);ctx.renderFilters();
 const html=nodes.playerFilters.innerHTML;
 assert.ok(html.indexOf('Anna Test')<html.indexOf('Camilla Frigerio'));
 assert.ok(html.indexOf('Camilla Frigerio')<html.indexOf('Paolo Brambilla'));
 assert.ok(html.indexOf('Paolo Brambilla')<html.indexOf('Riccardo Galbiati'));
 assert.deepEqual(Array.from(state.selected),['p','c']);
 assert.deepEqual(players.map(p=>p.id),['r','p','c','a']);
});
