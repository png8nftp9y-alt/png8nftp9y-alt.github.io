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
 const seen=[];const db={prepare(sql){assert.match(sql,/json_each/);return{bind(cards){seen.push(JSON.parse(cards));return{all:async()=>({results:[{membership_card:'123456',club:'New',ranking:'2.7',updated_at:'today'}]})}}}}};
 await enrichFitpMetadata(db,[a,b]);assert.equal(a.club,'New');assert.equal(a.fitpRanking,'2.7');assert.equal(a.ranking,'2.7');assert.equal(b.club,undefined);assert.equal(seen.length,1);
 await enrichFitpMetadata({prepare(){throw Error('no such table: fitp_player_metadata')}},[a]);
 await assert.rejects(enrichFitpMetadata({prepare(){throw Error('D1 unavailable')}},[a]),/unavailable/);
});

test('malformed successful responses remain technical errors, null player remains explicitly unavailable',async()=>{
 for(const value of ['',null,[],'not a profile'])await assert.rejects(fetchFitpSheet('123456',async()=>new Response(JSON.stringify(value))),/invalid_response/);
 await assert.rejects(fetchFitpSheet('123456',async()=>new Response(JSON.stringify({player:null}))),/profile_missing/);
});

test('latest registration overrides sheet even when ranking worsens; club still comes from sheet',async()=>{
 const p={membershipCard:'123456',ranking:'2.5'};
 const db={prepare(){return{bind(){return{all:async()=>({results:[{membership_card:'123456',club:'Club',ranking:'2.5',entry_ranking:JSON.stringify({ranking:'2.6',subscriptionDate:'2026-10-15'})}]})}}}}};
 await enrichFitpMetadata(db,[p]);assert.equal(p.ranking,'2.6');assert.equal(p.fitpRanking,'2.6');assert.equal(p.club,'Club');
});

test('indexed join reads registration even when no sheet metadata exists',async()=>{
 const {database}=await import('./search-sqlite-fixture.mjs');const d=database();try{
 d.execute('CREATE TABLE fitp_player_metadata(membership_card TEXT PRIMARY KEY,club TEXT,ranking TEXT,updated_at TEXT)');
 d.execute('INSERT INTO observed_players(source_key,circuit,official_id,normalized_name,display_name,payload) VALUES(?,?,?,?,?,?)',['fitp|id:9879449037','fitp','9879449037','DANESI MARTINA','Martina Danesi',JSON.stringify({fitpEntryRanking:{ranking:'2.5',subscriptionDate:'2026-10-15'}})]);
 const p={membershipCard:'9879449037',ranking:'2.6'};await enrichFitpMetadata(d.db,[p]);assert.equal(p.ranking,'2.5');
 }finally{d.close()}
});
