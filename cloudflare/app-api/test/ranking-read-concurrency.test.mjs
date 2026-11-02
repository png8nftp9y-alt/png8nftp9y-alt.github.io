import test from 'node:test';
import assert from 'node:assert/strict';
import {completeAppRankings} from '../lib/missing-match-rankings.mjs';
const players=()=>Array.from({length:200},(_,i)=>({id:'p'+i,name:'Player Person '+i,sex:'F',birthYear:2012}));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('ranking pages overlap up to four reads and preserve results despite reversed completion',async()=>{
 const people=players(),pending=[];let active=0,max=0,reads=0;
 const db={prepare(sql){assert.match(sql,/^SELECT /);return{bind(value){const names=JSON.parse(value);return{all(){reads++;active++;max=Math.max(max,active);return new Promise(resolve=>pending.push(()=>{active--;resolve({results:names.filter(name=>name.startsWith('player person ')).map(name=>({profile_id:name,normalized_name:name,category:'G14',ranking:100+Number(name.split(' ').at(-1)),ranking_date:'2026-10-13'}))})}))}}}}}};
 const task=completeAppRankings(db,people,[],{G14:'2026-10-13'},'2026-10-14');
 await tick();assert.equal(reads,4);assert.equal(active,4);
 pending[3]();await tick();assert.equal(reads,5);assert.equal(active,4);
 for(const i of [4,2,1,0])pending[i]();await task;
 assert.equal(max,4);assert.equal(reads,5);
 assert.deepEqual(people.map(p=>p.tennisEuropeRankings.u14),Array.from({length:200},(_,i)=>100+i));
});
test('failed ranking page stops queued reads without retrying',async()=>{
 let reads=0;const db={prepare(){return{bind(){return{all:async()=>{reads++;throw Error('D1 unavailable')}}}}}};
 await assert.rejects(completeAppRankings(db,players(),[],{G14:'2026-10-13'},'2026-10-14'),/D1 unavailable/);
 assert.equal(reads,4);
});
