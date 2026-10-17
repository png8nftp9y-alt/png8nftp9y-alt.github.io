import test from 'node:test';import assert from 'node:assert/strict';import {assertRuntimeSourceOrder} from '../lib/runtime-source-order.mjs';
test('shallow checkouts retain anti-rollback guarantees using authoritative comparison',async()=>{
 let calls=0;await assertRuntimeSourceOrder('same','same',{local:()=>{throw Error()},compare:()=>{throw Error()}});
 await assertRuntimeSourceOrder('old','new',{local:()=>true,compare:()=>{throw Error()}});
 await assertRuntimeSourceOrder('old','new',{local:()=>{throw Error('shallow')},compare:()=>{calls++;return'ahead'}});assert.equal(calls,1);
 for(const status of ['behind','diverged','unknown'])await assert.rejects(assertRuntimeSourceOrder('old','new',{local:()=>false,compare:()=>status}),/blocked/);
});
