import test from 'node:test';
import assert from 'node:assert/strict';
import {readD1Rows} from '../lib/d1-read-retry.mjs';
import {personalPlayerAdditions} from '../lib/courtwatch-player-additions.mjs';

test('D1 internal read retries retain the exact SQL and parameters and stop at three attempts',async()=>{
 const calls=[],waits=[],error=Error('[{"code":7500,"message":"internal error; reference = fixture"}]');
 const db={prepare(sql){return{bind(...params){return{async all(){calls.push({sql,params});if(calls.length<3)throw error;return{results:[{payload:'saved'}]}}}}}}};
 assert.deepEqual(await readD1Rows(db,'SELECT payload FROM search_acquired_players WHERE source_key=?',['acquired|id:1'],{wait:async ms=>waits.push(ms)}),[{payload:'saved'}]);
 assert.deepEqual(waits,[200,600]);assert.equal(calls.length,3);assert.ok(calls.every(c=>c.sql===calls[0].sql&&c.params[0]==='acquired|id:1'));
 calls.length=0;db.prepare=()=>({bind:()=>({all:async()=>{calls.push(1);throw error}})});
 await assert.rejects(readD1Rows(db,'SELECT payload FROM search_acquired_players',[],{wait:async()=>{}}),e=>e===error);assert.equal(calls.length,3);
});
test('permanent SQL and permission failures are not retried; writes cannot enter the retry helper',async()=>{
 for(const message of ['no such table: missing','not authorized','syntax error']){
  let attempts=0;const error=Error(message),db={prepare:()=>({bind:()=>({all:async()=>{attempts++;throw error}})})};
  await assert.rejects(readD1Rows(db,'SELECT payload FROM missing',[],{wait:async()=>assert.fail('must not wait')}),e=>e===error);assert.equal(attempts,1);
 }
 await assert.rejects(readD1Rows({prepare:()=>assert.fail('must not prepare a write')},'UPDATE app_players SET payload=?',['x']),/read_only_guard/);
});
for(const group of ['main','others'])test(`${group}: actual personal projection keeps membership and acquired metadata after one transient D1 failure`,async()=>{
 const person={id:'cw-read',name:'Read Player',sourceKey:'acquired|itf|id:100',sourceCircuit:'itf',userAdded:true};
 let attempts=0,writes=0,persistent=false;
 const db={prepare(sql){let params=[];return{bind(...values){params=values;return this},async all(){
  if(sql.startsWith('SELECT a.payload')){assert.match(sql,new RegExp(group==='others'?'JOIN user_app_other_players':'JOIN user_app_players'));return{results:params[0]==='owner'?[{payload:JSON.stringify(person),observed_payload:null}]:[]};}
  if(sql.startsWith('SELECT source_key,payload FROM search_acquired_players')){attempts++;assert.deepEqual(params,[person.sourceKey]);if(persistent||attempts===1)throw Error('D1_ERROR: internal error; reference = fixture');return{results:[{source_key:person.sourceKey,payload:JSON.stringify({nationality:'NED',birthYear:2009})}]};}
  if(sql.startsWith('WITH requested'))return{results:[]};
  throw Error('unexpected SQL: '+sql);
 },run(){writes++;throw Error('unexpected write')}}},batch(){writes++;throw Error('unexpected write')}};
 const players=await personalPlayerAdditions({DB:db},'owner',group);
 assert.equal(players.length,1);assert.equal(players[0].id,person.id);assert.equal(players[0].birthYear,2009);assert.equal(players[0].nationality,'NED');assert.equal(attempts,2);assert.equal(writes,0);
 assert.deepEqual(await personalPlayerAdditions({DB:db},'different-owner',group),[]);assert.equal(writes,0);
 persistent=true;attempts=0;await assert.rejects(personalPlayerAdditions({DB:db},'owner',group),/D1_ERROR: internal error/);assert.equal(attempts,3);assert.equal(writes,0);
});
