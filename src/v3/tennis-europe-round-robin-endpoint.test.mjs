import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {recoverDrawWalkovers,isRecoveredDrawWalkover} from './tennis-europe-draw-walkovers.mjs';
const id='00523E1D-06C9-430A-B8B9-851B401381E3',url='https://te.tournamentsoftware.com/tournament/'+id+'/draw/1';
const shell=await fs.readFile(new URL('./fixtures/te-round-robin-raw-shell.html',import.meta.url),'utf8'),content=await fs.readFile(new URL('./fixtures/te-round-robin-matches-content.html',import.meta.url),'utf8');
const tournament={competitionId:id,startDate:'2026-07-11',endDate:'2026-07-18'};
function network(page=shell,body=content){const calls=[];return{calls,get:async(u,headers)=>{calls.push({u,headers});if(u.endsWith('/draws'))return `<a href="${url}">BS12 - Group A</a>`;if(u===url)return page;if(/\/GetMatchesContent\?tabindex=1$/i.test(u)){assert.equal(headers['x-requested-with'],'XMLHttpRequest');assert.equal(headers.referer,url);return body;}throw Error('unexpected request '+u);}};}
test('official raw round robin shell loads GetMatchesContent, never GetStandings',async()=>{
 assert(!shell.includes('class="match"'));const n=network(),matches=[],p=await recoverDrawWalkovers({tournament,matches,get:n.get});assert.equal(p.status,'checked');assert.deepEqual(p.issues,[]);assert.equal(matches.length,0);assert.equal(n.calls.filter(c=>/GetMatchesContent/i.test(c.u)).length,1);assert(n.calls.every(c=>!c.u.includes('GetStandings')));
});
test('W/O in asynchronously loaded real card structure is recovered with its official date',async()=>{
 // Six real dated cards; replace the first result with a synthetic W/O.
 const starts=[...content.matchAll(/<div class="match">/g)].map(m=>m.index);assert.equal(starts.length,6);
 let first=content.slice(starts[0],starts[1]);first=first.replace(/<ul\b[^>]*class="[^"]*\bpoints\b[^"]*"[^>]*>[\s\S]*?<\/ul>/g,'').replace('<div class="match">','<div class="match"><span class="match__message">Walkover</span>');
 const body=content.slice(0,starts[0])+first+content.slice(starts[1]),n=network(shell,body),matches=[],p=await recoverDrawWalkovers({tournament,matches,get:n.get});assert.equal(p.status,'checked');assert.equal(matches.length,1);assert.equal(matches[0].date,'2026-07-13');assert.equal(matches[0].roundRobin,true);assert.equal(matches[0].score,'W/O');assert(isRecoveredDrawWalkover(matches[0]));
});
test('failed group endpoint keeps existing OOP rows and reports acquisition failure',async()=>{
 const n=network(),get=n.get;n.get=async(u,h)=>{if(/GetMatchesContent/i.test(u))throw Error('503 upstream');return get(u,h);};const matches=[{id:'existing',competitionId:id,event:'BS12',round:'Round 1',players:[]}],p=await recoverDrawWalkovers({tournament,matches,get:n.get});assert.equal(matches.length,1);assert(p.issues.some(x=>x.reason==='draw_acquisition_failed'));
});
for(const [name,alter] of [['external host',s=>s.replaceAll('action="/tournament/','action="https://untrusted.example/tournament/')],['different draw',s=>s.replace('/Draw/1/GetMatchesContent','/Draw/19/GetMatchesContent')]])test('rejects '+name+' before fetching group content',async()=>{
 const n=network(alter(shell)),p=await recoverDrawWalkovers({tournament,matches:[],get:n.get});assert(p.issues.some(x=>x.reason==='draw_acquisition_failed'&&x.error==='unexpected_draw_endpoint'));assert(n.calls.every(c=>!c.u.includes('GetMatchesContent')));
});
test('standings alone are never treated as verified match results',async()=>{
 const page=shell.replace(/<form\b[^>]*action="[^"]*GetMatchesContent[^"]*"[^>]*>[\s\S]*?<\/form>/i,''),n=network(page),p=await recoverDrawWalkovers({tournament,matches:[],get:n.get});assert(p.issues.some(x=>x.reason==='draw_content_endpoint_missing'));assert(n.calls.every(c=>!c.u.includes('GetStandings')));
});
