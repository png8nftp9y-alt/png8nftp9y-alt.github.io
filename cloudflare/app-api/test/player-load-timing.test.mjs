import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {playerLoadTiming} from '../lib/player-load-timing.mjs';

test('parallel stage durations overlap; body, status and privacy headers remain intact',async()=>{
 let clock=0,release;const timing=playerLoadTiming(true,()=>clock);
 const total=timing.measure('total',async()=>{
  const slow=timing.measure('match_history',()=>new Promise(resolve=>{release=resolve}));
  const entries=timing.measure('entries',async()=>{clock=20;return ['entry']});
  await entries;clock=50;release();await slow;
  return new Response('{"private":"unchanged"}',{status:202,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 });
 const response=timing.response(await total);
 assert.equal(response.status,202);assert.equal(await response.text(),'{"private":"unchanged"}');
 assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 assert.equal(response.headers.get('Server-Timing'),'entries;dur=20.0, match_history;dur=50.0, total;dur=50.0');
});
test('disabled timing never reads the clock or changes the response, and errors propagate unchanged',async()=>{
 const timing=playerLoadTiming(false,()=>{throw Error('must not read clock')});
 const response=new Response('original');assert.equal(timing.response(response),response);
 assert.equal(await timing.measure('anything',async()=>42),42);
 const original=Error('original failure');await assert.rejects(timing.measure('failed',()=>{throw original}),error=>error===original);
 const enabled=playerLoadTiming(true,()=>1);await assert.rejects(enabled.measure('failed',()=>{throw original}),error=>error===original);
 assert.equal(enabled.response(new Response()).headers.get('Server-Timing'),'failed;dur=0.0');
});
test('browser diagnostics contain timings only and cannot fail an application operation',()=>{
 const source=readFileSync(new URL('../../../v3.js',import.meta.url),'utf8');
 const helper=source.slice(source.indexOf('function recordPlayerLoadTiming('),source.indexOf('async function fetchProjection('));
 const logs=[],context={Date:{now:()=>125},console:{info:value=>logs.push(value)}};vm.createContext(context);vm.runInContext(helper,context);
 context.recordPlayerLoadTiming('search_http',100,{status:200,headers:new Headers({'Server-Timing':'search;dur=20.0'})});
 assert.deepEqual(JSON.parse(logs[0].slice('courtwatch_player_timing '.length)),{stage:'search_http',elapsedMs:25,status:200,serverTiming:'search;dur=20.0'});
 context.console.info=()=>{throw Error('console unavailable')};assert.doesNotThrow(()=>context.recordPlayerLoadTiming('snapshot_http',100));
});
