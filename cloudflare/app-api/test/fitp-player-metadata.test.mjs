import test from 'node:test';import assert from 'node:assert/strict';
import {parseFitpSheet,fetchFitpSheet,fitpCycle,fitpScheduledDay,enrichFitpMetadata} from '../lib/fitp-player-metadata.mjs';
test('official FITP fields and masked card are parsed without guessing identity',()=>{
 assert.deepEqual(parseFitpSheet({player:{MembershipCard:'*******135',tennis_club_name:'TENNIS CLUB',Ranking:'2.7'}},'6783352135'),{membership_card:'6783352135',club:'Tennis Club',ranking:'2.7'});
 assert.equal(parseFitpSheet({player:{Ranking:'4NC'}},'6783352135').ranking,'4.NC');
 assert.throws(()=>parseFitpSheet({player:{MembershipCard:'*******999'}},'6783352135'),/identity_mismatch/);
 assert.throws(()=>parseFitpSheet({},'6783352135'),/missing/);
});
test('schedule remains exactly 21 days across month and year boundaries',()=>{
 const epoch=Date.UTC(2026,9,18);for(let day=0;day<100;day++)assert.equal(fitpScheduledDay(epoch+day*86400000),day%21===0);
 assert.equal(fitpCycle(Date.UTC(2026,10,7)),'2026-10-18');assert.equal(fitpCycle(Date.UTC(2026,10,8)),'2026-11-08');
});
test('source outage is requested once, 404 is unavailable, no retries',async()=>{
 let calls=0;await assert.rejects(fetchFitpSheet('6783352135',async()=>{calls++;return new Response('',{status:429})}),/http_429/);assert.equal(calls,1);
 const missing=await fetchFitpSheet('123456',async()=>new Response('',{status:404}));assert.equal(missing.availability,'not_found');assert.equal(missing.club,'');
});
test('metadata reads exact FITP cards in batches, never names; deployment compatibility is narrow',async()=>{
 const a={id:'a',name:'Same',membershipCard:'123456',club:'Old',ranking:'4.1'},b={id:'b',name:'Same',membershipCard:'999999'};
 const seen=[];const db={prepare(sql){assert.match(sql,/membership_card IN/);return{bind(cards){seen.push(JSON.parse(cards));return{all:async()=>({results:[{membership_card:'123456',club:'New',ranking:'2.7',updated_at:'today'}]})}}}}};
 await enrichFitpMetadata(db,[a,b]);assert.equal(a.club,'New');assert.equal(a.fitpRanking,'2.7');assert.equal(a.ranking,'2.7');assert.equal(b.club,undefined);assert.equal(seen.length,1);
 await enrichFitpMetadata({prepare(){throw Error('no such table: fitp_player_metadata')}},[a]);
 await assert.rejects(enrichFitpMetadata({prepare(){throw Error('D1 unavailable')}},[a]),/unavailable/);
});
