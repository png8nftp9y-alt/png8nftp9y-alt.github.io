import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {itfDocumentDraws,acquiredItfDraws,drawGroupPage} from '../lib/acquired-tournament-draws.mjs';
const t={circuit:'itf',competitionId:'J-J30-HUN-2026-002',name:'J30 Szentes',sourceUrl:'https://www.itftennis.com/en/tournament/j30-szentes/hun/2026/j-j30-hun-2026-002/'};
const match=group=>({group,round:'Round 1',teams:[{players:[{id:'800792690',name:'Martina Danesi'}],score:'6 6'},{players:[{id:'800123456',name:'Other Player'}],score:'2 3'}]});
test('ITF RR groups are individual exact links with only their own players and matches',()=>{
 const draws=itfDocumentDraws({event:'G-S-M-RR',matches:[match('A'),{...match('B'),teams:[{players:[{id:'800234567',name:'Another Player'}]}]}]},t);assert.equal(draws.length,2);assert.equal(draws[0].group,'A');assert.deepEqual(draws[1].participants.map(p=>p.id),['800234567']);assert.match(draws[0].drawUrl,/group=A/);assert.match(draws[1].drawUrl,/group=B/);assert.notEqual(draws[0].drawUrl,draws[1].drawUrl);
 const html=drawGroupPage(t,draws[0]);assert.match(html,/Martina Danesi/);assert.doesNotMatch(html,/Another Player/);assert.match(html,/6 6/);assert.doesNotMatch(drawGroupPage({...t,name:'<script>alert(1)</script>'},draws[0]),/<script>/);
 assert.deepEqual(itfDocumentDraws({event:'G-S-M-RR',matches:[match('')]},t),[]);
});
test('indexed acquired documents verify exact competition, hash and chunk sequence before returning links',async()=>{
 const doc={competitionId:t.competitionId,event:'G-S-M-KO',matches:[match('')]},text=JSON.stringify(doc),hash=createHash('sha256').update(text).digest('hex');let broken=false;const calls=[];
 const db={prepare(sql){calls.push(sql);return {bind(...args){return{all:async()=>({results:sql.includes('FROM itf_draw_documents d')?[{draw_key:'key',content_sha256:hash,event:doc.event,content_bytes:Buffer.byteLength(text),chunk_count:1}]:[{chunk_index:0,content:broken?text+' ':text}]})}}}}};
 const rows=await acquiredItfDraws(db,t);assert.equal(rows.length,1);assert.equal(rows[0].participants[0].id,'800792690');assert(calls[0].includes('WHERE competition_id=?'));assert(calls[0].includes('NOT EXISTS'));assert(calls[1].includes('LIMIT 8'));broken=true;await assert.rejects(acquiredItfDraws(db,t),/integrity/);
});
test('both draw endpoints reject unauthenticated requests before any document read',async()=>{
 const {default:worker}=await import('../src/index.js');let reads=0;
 for(const path of ['tournament-draw-links','tournament-draw-view']){const response=await worker.fetch(new Request('https://app.test/app/api/'+path+'?circuit=itf&competitionId='+t.competitionId),{DB:{prepare(){reads++;throw Error('unexpected read')}}});assert.equal(response.status,401);}
 assert.equal(reads,0);
});
