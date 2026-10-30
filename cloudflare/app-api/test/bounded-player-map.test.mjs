import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedPlayerMap} from '../lib/bounded-player-map.mjs';
test('three players start together, a fourth waits, and out-of-order completion preserves input order',async()=>{
 const started=[],gates=new Map();let active=0,peak=0;
 const pending=boundedPlayerMap([0,1,2,3,4],async n=>{started.push(n);peak=Math.max(peak,++active);await new Promise(resolve=>gates.set(n,resolve));active--;return n*10;});
 assert.deepEqual(started,[0,1,2]);gates.get(2)();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(started,[0,1,2,3]);gates.get(0)();await new Promise(resolve=>setImmediate(resolve));gates.get(1)();gates.get(3)();await new Promise(resolve=>setImmediate(resolve));gates.get(4)();assert.deepEqual(await pending,[0,10,20,30,40]);assert.equal(peak,3);
});
test('empty selection performs no operation; errors stop queued players and reject the snapshot',async()=>{
 assert.deepEqual(await boundedPlayerMap([],()=>assert.fail()),[]);
 const seen=[];await assert.rejects(boundedPlayerMap([0,1,2],async n=>{seen.push(n);throw Error('source_failure')},1),/source_failure/);assert.deepEqual(seen,[0]);await assert.rejects(boundedPlayerMap([1],x=>x,0),/concurrency/);
});
