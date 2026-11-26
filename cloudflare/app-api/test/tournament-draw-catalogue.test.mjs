import test from 'node:test';
import assert from 'node:assert/strict';
import {europeCatalogueDraws,itfCatalogueDraws,createTournamentDrawCatalogue} from '../lib/tournament-draw-catalogue.mjs';
const id='5C795C29-2EB4-40E7-B1EB-F49A08231149';
const t={circuit:'tennis-europe',competitionId:id};
const html=`<a href="/tournament/${id}/draw/1">BS14 - Boys Singles 14 Main Draw</a><a href="/sport/draw.aspx?id=${id}&amp;draw=2">GD14 - Girls Doubles 14 Main Draw</a>`;
test('Europe catalog includes every official linked draw and rejects unrelated IDs and origins',()=>{
 const rows=europeCatalogueDraws(html+`<a href="https://evil.test/tournament/${id}/draw/3">BS14</a><a href="/tournament/OTHER/draw/4">BS14</a><a href="/tournament/${id}/draw/1">BS14</a>`,id);
 assert.equal(rows.length,2);assert.equal(rows[1].drawId,'2');assert.match(rows[1].drawUrl,/draw\/2$/);
});
test('public catalog cache shares a request without storing private player scope',async()=>{
 const load=createTournamentDrawCatalogue();let calls=0;const fetcher=async()=>{calls++;return new Response(html)};
 const [a,b]=await Promise.all([load(t,{fetcher}),load(t,{fetcher})]);assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.draws.length,2);
 assert.equal((await load(t,{fetcher})).draws.length,2);assert.equal(calls,1);assert.deepEqual(Object.keys(a).sort(),['circuit','competitionId','complete','draws']);
});
test('source blockage or incomplete HTML is not cached as zero published draws',async()=>{
 for(const body of ['Incapsula challenge','<html>unrelated response</html>']){
  const load=createTournamentDrawCatalogue();let calls=0;const fetcher=async()=>{calls++;return new Response(body)};
  await assert.rejects(load(t,{fetcher}));await assert.rejects(load(t,{fetcher}));assert.equal(calls,4);
 }
});
test('explicit empty publication is distinct from a technical failure',async()=>{
 const r=await createTournamentDrawCatalogue()(t,{fetcher:async()=>new Response('No draws available')});assert.deepEqual(r.draws,[]);assert.equal(r.complete,true);
});
const itf={circuit:'itf',competitionId:'J-J30-SRB-2026-002',sourceUrl:'https://www.itftennis.com/en/tournament/j30-nis/srb/2026/j-j30-srb-2026-002/'};
test('ITF uses all acquired events from R2, independent of observed players, and exposes incomplete scope',()=>{
 const row={competitionId:itf.competitionId,classification:'missing_draws',checks:[{event:'B-S-M-KO',acquired:true},{event:'G-S-M-KO',acquired:true},{event:'G-D-M-KO',acquired:false}]};
 let r=itfCatalogueDraws({tournaments:[row]},itf);assert.equal(r.draws.length,2);assert.equal(r.complete,false);assert(r.draws.every(d=>d.drawUrl.endsWith('/draws-and-results/')));
 r=itfCatalogueDraws({tournaments:[{...row,classification:'complete'}]},itf);assert.equal(r.complete,true);
 assert.deepEqual(itfCatalogueDraws({tournaments:[{...row,classification:'cancelled_no_draws'}]},itf),{draws:[],complete:true});
});
test('ITF archive inventory is reused across different tournaments with no D1 access',async()=>{
 const load=createTournamentDrawCatalogue();let gets=0;const archive={get:async key=>{gets++;assert.equal(key,'itf/audits/official-draw-parity/coverage-v3-current.json');return {json:async()=>({tournaments:[]})}}};
 assert.equal((await load(itf,{archive,fetcher:async()=>Response.json({filters:[]})})).complete,false);await load(itf,{archive,fetcher:async()=>Response.json({filters:[]})});assert.equal(gets,1);
});
test('invalid identifiers never cause upstream calls',async()=>{
 let calls=0;const load=createTournamentDrawCatalogue();await assert.rejects(load({...t,competitionId:'../../private'},{fetcher:async()=>{calls++}}));assert.equal(calls,0);
});

test('Europe canonical listing fallback and same-origin redirects recover published links',async()=>{
 const seen=[];const fetcher=async url=>{seen.push(url);if(url.includes('draws.aspx'))return new Response(null,{status:302,headers:{location:`/tournament/${id}/draws`}});return new Response(html);};
 const result=await createTournamentDrawCatalogue()(t,{fetcher});assert.equal(result.draws.length,2);assert.match(seen[0],/sport\/draws\.aspx/);assert.equal(seen.length,2);
 await assert.rejects(createTournamentDrawCatalogue()(t,{fetcher:async()=>new Response(null,{status:302,headers:{location:'https://evil.test/private'}})}));
});
test('real Europe source HTML retains full age in the qualifying draw label',async()=>{
 const fs=await import('node:fs/promises');const pages=JSON.parse(await fs.readFile(new URL('../../../src/v3/fixtures/europe-draw-results/pages.json',import.meta.url),'utf8'));
 const realId='F065F194-9CF9-46A7-92C9-E97A47ECA6EA';const rows=europeCatalogueDraws(pages['romania-shell.html'],realId);assert.equal(rows.length,1);assert.equal(rows[0].drawId,'7');assert.equal(rows[0].event,'Boys Singles 14 Qualifying');
});
