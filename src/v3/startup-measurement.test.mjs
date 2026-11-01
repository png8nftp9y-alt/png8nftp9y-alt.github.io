import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../v3.js',import.meta.url),'utf8');
const helper=source.slice(0,source.indexOf('const V3 ='));
function context(search){
 const nodes=[];let panel;
 const document={getElementById:()=>panel,createElement:tag=>{const el={tag,style:{},textContent:'',append(...children){this.children=children},querySelector:()=>el.children[1]};nodes.push(el);return el},body:{append:el=>panel=el}};
 const ctx={location:{search},document,Date,URLSearchParams};vm.createContext(ctx);vm.runInContext(helper,ctx);return{ctx,nodes,get panel(){return panel}};
}
test('startup measurement is absent by default and keeps only bounded timings when explicitly requested',()=>{
 const normal=context('');normal.ctx.recordStartupTiming('snapshot',Date.now());assert.equal(normal.nodes.length,0);
 const measured=context('?group=others&loadTiming=1');
 for(let i=0;i<100;i++)measured.ctx.recordStartupTiming('snapshot_body',Date.now(),{status:200});
 assert.equal(measured.nodes.length,3);const rows=measured.panel.children[1].textContent.trim().split('\n').map(JSON.parse);
 assert.ok(rows.length<=40);assert.equal(rows.at(-1).status,200);assert.equal(rows.at(-1).stage,'snapshot_body');assert.equal(typeof rows.at(-1).elapsedMs,'number');
});
test('measurement failure cannot break startup',()=>{
 const {ctx}=context('?loadTiming=1');ctx.document.getElementById=()=>{throw Error('DOM unavailable')};assert.doesNotThrow(()=>ctx.recordStartupTiming('snapshot',Date.now()));
});
