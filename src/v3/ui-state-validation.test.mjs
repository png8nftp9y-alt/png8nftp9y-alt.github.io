import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('function validUiState('),source.indexOf('function savedActiveOpponent('));
function context(raw){const c={UI_STATE_CACHE:'others',localStorage:{getItem:()=>raw,setItem(){}}};vm.createContext(c);vm.runInContext(functions,c);return c;}
const plain=value=>JSON.parse(JSON.stringify(value));
test('null, primitive, array and invalid JSON preferences never stop startup',()=>{
 for(const raw of ['null','[]','12','true','"old"','{broken'])assert.deepEqual(plain(context(raw).savedUiState()),{});
});
test('invalid dates are ignored while valid selections and filters survive',()=>{
 const saved=context(JSON.stringify({month:'2026-99',agenda:'2026-02-31',selected:['known-player'],agendaMode:'chronological'})).savedUiState();
 assert.deepEqual(plain(saved),{selected:['known-player'],agendaMode:'chronological'});
 for(const day of ['2026-00-10','2026-13-01','2026-04-31','2026-02-29','not-a-date'])assert.equal(context(JSON.stringify({agenda:day})).savedUiState().agenda,undefined);
 assert.equal(context('{"agenda":"2024-02-29","month":"2024-02"}').savedUiState().agenda,'2024-02-29');
});
test('malformed map entries cannot crash initialization of saved rankings or opponents',()=>{
 const c=context(JSON.stringify([null,{},42,'broken',[1,{}],['empty',null],['array',[]],['known',{tournaments:[{id:'preserved'}]}]]));
 const entries=c.savedEntries('cache');assert.equal(entries.length,1);assert.equal(new Map(entries).get('known').tournaments[0].id,'preserved');
});
test('blocked Web Storage is optional for reading and saving UI preferences',()=>{
 const c=context(null);Object.defineProperty(c,'localStorage',{get(){throw Error('SecurityError')}});
 assert.deepEqual(plain(c.savedUiState()),{});assert.deepEqual(plain(c.savedEntries('cache')),[]);assert.doesNotThrow(()=>c.saveEntries('cache',new Map()));
});
